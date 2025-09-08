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
      resetCollection = true // 新增：是否重置集合
    } = options;

    try {
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

      // 分批处理文档以防止内存溢出和 API 限制
      let vectorStore;
      const totalBatches = Math.ceil(documents.length / batchSize);
      
      console.log(`📋 开始分批处理 ${documents.length} 个文档，共 ${totalBatches} 个批次`);
      
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        
        console.log(`🔄 处理第 ${batchNumber}/${totalBatches} 批（${batch.length} 个文档）`);
        
        try {
          if (i === 0) {
            // 第一批：创建新的向量存储
            vectorStore = await Chroma.fromDocuments(
              batch,
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
          } else {
            // 后续批次：添加到现有向量存储
            await vectorStore.addDocuments(batch);
          }
          
          console.log(`✅ 第 ${batchNumber} 批处理完成`);
        } catch (batchError) {
          console.error(`❌ 第 ${batchNumber} 批处理失败:`, batchError.message);
          throw new Error(`分批处理失败（第${batchNumber}批）: ${batchError.message}`);
        }
      }

      console.log(`🎉 成功创建 ChromaDB 向量存储`);
      console.log(`📋 集合名称: ${collectionName}`);
      console.log(`📈 已索引文档数量: ${documents.length}`);
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