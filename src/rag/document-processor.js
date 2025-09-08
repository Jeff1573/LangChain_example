import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

/**
 * 文档处理器 - 负责文档切分和元数据清理
 */
export class DocumentProcessor {
  constructor(options = {}) {
    this.chunkSize = options.chunkSize || 800;
    this.chunkOverlap = options.chunkOverlap || 200;
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: this.chunkSize,
      chunkOverlap: this.chunkOverlap,
    });
  }

  /**
   * 切分文档为小块
   * @param {Array} documents 原始文档数组
   * @returns {Promise<Array>} 切分后的文档数组
   */
  async splitDocuments(documents) {
    return await this.splitter.splitDocuments(documents);
  }

  /**
   * 清理文档元数据，确保符合向量存储的类型要求
   * @param {Array} docs 文档数组
   * @returns {Array} 清理后的文档数组
   */
  sanitizeMetadata(docs) {
    return docs.map(doc => {
      const sanitizedMetadata = {};
      
      if (doc.metadata) {
        Object.entries(doc.metadata).forEach(([key, value]) => {
          if (
            typeof value === 'string' || 
            typeof value === 'number' || 
            typeof value === 'boolean' || 
            value === null
          ) {
            sanitizedMetadata[key] = value;
          } else if (typeof value === 'object' && value !== null) {
            sanitizedMetadata[key] = JSON.stringify(value);
          }
        });
      }
      
      sanitizedMetadata.source = doc.metadata?.source || 'unknown';
      sanitizedMetadata.chunk_size = doc.pageContent?.length || 0;
      
      return {
        ...doc,
        metadata: sanitizedMetadata
      };
    });
  }
}