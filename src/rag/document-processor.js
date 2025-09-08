import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

/**
 * 文档处理器 - 负责文档切分和元数据清理
 */
export class DocumentProcessor {
  constructor(options = {}) {
    // 针对大文件优化的切分参数
    this.chunkSize = options.chunkSize || 1200;
    this.chunkOverlap = options.chunkOverlap || 300;
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
   * 注意：此方法不会触发向量重新计算，仅处理元数据格式
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
      // 添加处理时间戳，便于跟踪
      sanitizedMetadata.processed_at = new Date().toISOString();
      
      return {
        ...doc,
        metadata: sanitizedMetadata
      };
    });
  }

  /**
   * 验证文档处理的完整性
   * @param {Array} originalDocs 原始文档
   * @param {Array} processedDocs 处理后的文档
   * @returns {Object} 完整性报告
   */
  validateProcessingIntegrity(originalDocs, processedDocs) {
    const originalSize = originalDocs.reduce((acc, doc) => acc + (doc.pageContent?.length || 0), 0);
    const processedSize = processedDocs.reduce((acc, doc) => acc + (doc.pageContent?.length || 0), 0);
    const retentionRate = originalSize > 0 ? (processedSize / originalSize * 100).toFixed(2) : 0;
    
    return {
      originalDocsCount: originalDocs.length,
      processedChunksCount: processedDocs.length,
      originalTotalSize: originalSize,
      processedTotalSize: processedSize,
      contentRetentionRate: parseFloat(retentionRate),
      averageChunksPerDoc: (processedDocs.length / originalDocs.length).toFixed(2)
    };
  }
}