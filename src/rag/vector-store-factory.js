import { Chroma } from "@langchain/community/vectorstores/chroma";
import { ChromaClient } from "chromadb";
import { MemoryVectorStore } from "langchain/vectorstores/memory";

/**
 * 向量存储工厂 - 负责创建不同类型的向量存储
 */
export class VectorStoreFactory {
  /**
   * 创建内存向量存储
   * @param {Array} documents 文档数组
   * @param {Object} embeddings 嵌入模型
   * @returns {Promise<MemoryVectorStore>} 内存向量存储实例
   */
  static async createMemoryStore(documents, embeddings) {
    return await MemoryVectorStore.fromDocuments(documents, embeddings);
  }

  /**
   * 创建 ChromaDB 向量存储
   * @param {Array} documents 文档数组
   * @param {Object} embeddings 嵌入模型
   * @param {Object} options 配置选项
   * @returns {Promise<Chroma>} ChromaDB 向量存储实例
   */
  static async createChromaStore(documents, embeddings, options = {}) {
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

      try {
        await client.deleteCollection({ name: collectionName });
        console.log(`已删除现有集合: ${collectionName}`);
      } catch (error) {
        console.log(`集合 ${collectionName} 不存在，将创建新集合`);
      }

      const vectorStore = await Chroma.fromDocuments(
        documents,
        embeddings,
        {
          collectionName,
          url: chromaUrl,
          collectionMetadata: {
            "hnsw:space": "cosine",
          },
        }
      );

      console.log(`成功创建 ChromaDB 向量存储，集合名称: ${collectionName}`);
      console.log(`已索引文档数量: ${documents.length}`);
      
      return vectorStore;
    } catch (error) {
      console.error("创建 ChromaDB 向量存储时发生错误:", error);
      throw error;
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
}