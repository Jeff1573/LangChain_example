import { Chroma } from "@langchain/community/vectorstores/chroma";
import { ChromaClient } from "chromadb";
import { MemoryVectorStore } from "langchain/vectorstores/memory";

/**
 * 向量存储工厂 - 优先支持ChromaDB持久化存储，保障数据安全
 */
export class VectorStoreFactory {
  /**
   * 创建内存向量存储（已弃用，仅保留兼容性）
   * @deprecated 请使用 createChromaStore 以获得更好的数据持久化
   * @param {Array} documents 文档数组
   * @param {Object} embeddings 嵌入模型
   * @returns {Promise<MemoryVectorStore>} 内存向量存储实例
   */
  static async createMemoryStore(documents, embeddings) {
    console.warn('⚠️  不推荐使用内存存储，建议使用 ChromaDB 以获得数据持久化');
    return await MemoryVectorStore.fromDocuments(documents, embeddings);
  }

  /**
   * 创建 ChromaDB 向量存储（分批处理大量文档）
   * @param {Array} documents 文档数组
   * @param {Object} embeddings 嵌入模型
   * @param {Object} options 配置选项
   * @returns {Promise<Chroma>} ChromaDB 向量存储实例
   */
  static async createChromaStore(documents, embeddings, options = {}) {
    const {
      collectionName = "langchain-docs",
      chromaUrl = "http://localhost:8000",
      batchSize = 100, // 新增：分批处理大小
      resetCollection = true, // 新增：是否重置集合
      embedSubBatchSize = 32, // 新增：嵌入子批量大小（加速且更稳）
      preEmbedFilter = true // 新增：是否在写入前预嵌入并过滤空向量
    } = options;

    try {
      // Task 1: 过滤空内容文档并输出统计
      const originalCount = documents.length;
      const filteredDocuments = documents.filter(d => {
        const content = d?.pageContent;
        return typeof content === 'string' && content.trim().length > 0;
      });
      const removed = originalCount - filteredDocuments.length;
      if (removed > 0) {
        console.log(`🧹 过滤空内容文档: 移除 ${removed} 条，保留 ${filteredDocuments.length}/${originalCount}`);
      } else {
        console.log(`🧹 未发现空内容文档，待入库数量: ${filteredDocuments.length}`);
      }

      const url = new URL(chromaUrl);
      const client = new ChromaClient({
        host: url.hostname,
        port: url.port || '8000',
        ssl: url.protocol === 'https:',
      });

      // 集合管理
      if (resetCollection) {
        try {
          await client.deleteCollection({ name: collectionName });
          console.log(`✅ 已删除现有集合: ${collectionName}`);
        } catch (error) {
          console.log(`📁 集合 ${collectionName} 不存在，将创建新集合`);
        }
      }

      // Task 2: 使用过滤后文档进行分批处理并更新日志
      let vectorStore;
      const totalBatches = Math.ceil(filteredDocuments.length / batchSize) || 0;
      let insertedTotal = 0;
      
      console.log(`📋 开始分批处理 ${filteredDocuments.length} 个文档，共 ${totalBatches} 个批次`);
      
      for (let i = 0; i < filteredDocuments.length; i += batchSize) {
        const batch = filteredDocuments.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        
        console.log(`🔄 处理第 ${batchNumber}/${totalBatches} 批（${batch.length} 个文档）`);
        
        try {
          // Task 3: 批次失败时输出诊断信息（首条长度等）
          const firstLen = batch[0]?.pageContent?.length ?? 0;
          const lastLen = batch[batch.length - 1]?.pageContent?.length ?? 0;
          console.log(`   ↪️ 批次首/尾文档长度: ${firstLen}/${lastLen}`);
          // 子批量预嵌入过滤：可开关（preEmbedFilter）
          const processDocsWithOptionalPreEmbed = async (docs) => {
            if (!preEmbedFilter) return { cleanedDocs: docs, removedCount: 0 };
            const isArrayLike = (v) => (Array.isArray(v) || (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView && ArrayBuffer.isView(v))) && typeof v.length === 'number';
            const cleaned = [];
            let removed = 0;
            for (let s = 0; s < docs.length; s += embedSubBatchSize) {
              const sub = docs.slice(s, s + embedSubBatchSize);
              const texts = sub.map(d => d.pageContent);
              let vectors;
              try {
                vectors = await embeddings.embedDocuments(texts);
              } catch (embedErr) {
                console.error(`   ❌ 子批嵌入失败: ${embedErr.message}`);
                throw new Error(`嵌入计算失败（第${batchNumber}批 子批${Math.floor(s/embedSubBatchSize)+1}）: ${embedErr.message}`);
              }
              vectors.forEach((vec, idx) => {
                if (isArrayLike(vec) && vec.length > 0) {
                  cleaned.push(sub[idx]);
                } else {
                  removed += 1;
                }
              });
            }
            return { cleanedDocs: cleaned, removedCount: removed };
          };

          const { cleanedDocs, removedCount } = await processDocsWithOptionalPreEmbed(batch);
          if (removedCount > 0) {
            console.warn(`   🧯 过滤空向量文档: ${removedCount} 条`);
          }
          if (!cleanedDocs.length) {
            console.warn(`   ⚠️ 清洗后本批无有效文档，跳过该批`);
            continue;
          }

          // 写入：首批创建，其余批追加
          if (!vectorStore) {
            vectorStore = await Chroma.fromDocuments(
              cleanedDocs,
              embeddings,
              {
                collectionName,
                url: chromaUrl,
                collectionMetadata: {
                  "hnsw:space": "cosine",
                  "created_at": new Date().toISOString(),
                  "batch_size": batchSize
                },
              }
            );
            insertedTotal += cleanedDocs.length;
          } else {
            await vectorStore.addDocuments(cleanedDocs);
            insertedTotal += cleanedDocs.length;
          }
          
          console.log(`✅ 第 ${batchNumber} 批处理完成`);
        } catch (batchError) {
          console.error(`❌ 第 ${batchNumber} 批处理失败:`, batchError.message);
          throw new Error(`分批处理失败（第${batchNumber}批）: ${batchError.message}`);
        }
      }

      console.log(`🎉 成功创建 ChromaDB 向量存储`);
      console.log(`📋 集合名称: ${collectionName}`);
      console.log(`📈 实际写入文档数量: ${insertedTotal}`);
      console.log(`🔄 分批处理: ${totalBatches} 个批次，每批 ${batchSize} 个文档`);
      
      return vectorStore;
    } catch (error) {
      console.error("❌ 创建 ChromaDB 向量存储时发生错误:", error.message);
      throw new Error(`ChromaDB 连接失败: ${error.message}`);
    }
  }

  /**
   * 连接到现有的 ChromaDB 集合
   * @param {Object} embeddings 嵌入模型
   * @param {Object} options 配置选项
   * @returns {Chroma} ChromaDB 向量存储实例
   */
  static connectToExistingChroma(embeddings, options = {}) {
    const {
      collectionName = "langchain-docs",
      chromaUrl = "http://localhost:8000",
    } = options;

    try {
      const vectorStore = new Chroma(embeddings, {
        collectionName,
        url: chromaUrl,
      });

      console.log(`成功连接到现有 ChromaDB 集合: ${collectionName}`);
      return vectorStore;
    } catch (error) {
      console.error("连接到 ChromaDB 集合时发生错误:", error);
      throw error;
    }
  }

  /**
   * 清理指定的 ChromaDB 集合
   * @param {Object} options 配置选项
   * @returns {Promise<boolean>} 清理是否成功
   */
  static async cleanChromaCollection(options = {}) {
    const {
      collectionName = "langchain-docs",
      chromaUrl = "http://localhost:8000",
    } = options;

    try {
      const url = new URL(chromaUrl);
      const client = new ChromaClient({
        host: url.hostname,
        port: url.port || '8000',
        ssl: url.protocol === 'https:',
      });

      console.log(`🗑️ 正在清理 ChromaDB 集合: ${collectionName}...`);
      
      try {
        await client.deleteCollection({ name: collectionName });
        console.log(`✅ 成功删除集合: ${collectionName}`);
        return true;
      } catch (error) {
        if (error.message.includes('does not exist')) {
          console.log(`📁 集合 ${collectionName} 不存在，无需清理`);
          return true;
        } else {
          console.error(`❌ 删除集合失败: ${error.message}`);
          return false;
        }
      }
    } catch (error) {
      console.error(`❌ 连接 ChromaDB 失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 列出所有 ChromaDB 集合
   * @param {Object} options 配置选项
   * @returns {Promise<Array>} 集合列表
   */
  static async listChromaCollections(options = {}) {
    const {
      chromaUrl = "http://localhost:8000",
    } = options;

    try {
      const url = new URL(chromaUrl);
      const client = new ChromaClient({
        host: url.hostname,
        port: url.port || '8000',
        ssl: url.protocol === 'https:',
      });

      const collections = await client.listCollections();
      console.log(`📁 找到 ${collections.length} 个集合:`);
      collections.forEach(collection => {
        console.log(`   - ${collection.name}`);
      });
      
      return collections;
    } catch (error) {
      console.error(`❌ 获取集合列表失败: ${error.message}`);
      return [];
    }
  }

  /**
   * 验证数据库中的数据完整性
   * @param {Chroma} vectorStore 向量存储实例
   * @param {number} expectedCount 预期的文档数量
   * @returns {Promise<Object>} 验证结果
   */
  static async validateDatabaseIntegrity(vectorStore, expectedCount) {
    try {
      // 获取数据库中的数据量
      const testQuery = await vectorStore.similaritySearch("测试查询", 1);
      const collectionInfo = await vectorStore.client?.getCollection({ name: vectorStore.collectionName });
      
      return {
        isValid: true,
        expectedCount,
        actualCount: collectionInfo?.count || 'unknown',
        testQuerySuccess: testQuery.length > 0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        isValid: false,
        error: error.message,
        expectedCount,
        timestamp: new Date().toISOString()
      };
    }
  }
}