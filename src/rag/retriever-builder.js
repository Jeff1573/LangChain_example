import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { DocumentLoader } from "./document-loader.js";
import { DocumentProcessor } from "./document-processor.js";
import { VectorStoreFactory } from "./vector-store-factory.js";

/**
 * 检索器构建器 - 协调各个模块构建检索器的主类
 */
export class RetrieverBuilder {
  constructor(options = {}) {
    this.knowledgeDir = options.knowledgeDir || "knowledge";
    this.embeddingModel = options.embeddingModel || "text-embedding-004";
    this.processorOptions = {
      chunkSize: options.chunkSize || 800,
      chunkOverlap: options.chunkOverlap || 200,
    };
    
    this.documentLoader = new DocumentLoader(this.knowledgeDir);
    this.documentProcessor = new DocumentProcessor(this.processorOptions);
    this.embeddings = new GoogleGenerativeAIEmbeddings({
      model: this.embeddingModel,
    });
  }

  /**
   * 构建内存检索器
   * @param {Object} options 配置选项
   * @returns {Promise<Object>} 检索器实例
   */
  async buildMemoryRetriever(options = {}) {
    const { k = 4 } = options;
    
    const rawDocs = await this.documentLoader.loadDocuments();
    const splitDocs = await this.documentProcessor.splitDocuments(rawDocs);
    const vectorStore = await VectorStoreFactory.createMemoryStore(splitDocs, this.embeddings);
    
    return vectorStore.asRetriever({ k });
  }

  /**
   * 构建 ChromaDB 检索器
   * @param {Object} options 配置选项
   * @returns {Promise<Object>} 检索器实例
   */
  async buildChromaRetriever(options = {}) {
    const { k = 20, ...chromaOptions } = options;
    
    const rawDocs = await this.documentLoader.loadDocuments();
    const splitDocs = await this.documentProcessor.splitDocuments(rawDocs);
    const sanitizedDocs = this.documentProcessor.sanitizeMetadata(splitDocs);
    
    const vectorStore = await VectorStoreFactory.createChromaStore(
      sanitizedDocs, 
      this.embeddings, 
      chromaOptions
    );
    
    return vectorStore.asRetriever({ k });
  }

  /**
   * 连接到现有 ChromaDB 集合并创建检索器
   * @param {Object} options 配置选项
   * @returns {Object} 检索器实例
   */
  connectToExistingRetriever(options = {}) {
    const { k = 4, ...chromaOptions } = options;
    
    const vectorStore = VectorStoreFactory.connectToExistingChroma(
      this.embeddings, 
      chromaOptions
    );
    
    return vectorStore.asRetriever({ k });
  }
}