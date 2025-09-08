/**
 * RAG 模块统一导出
 * 提供检索增强生成相关的所有功能
 */

// 核心类导出
export { DocumentLoader } from "./document-loader.js";
export { DocumentProcessor } from "./document-processor.js";
export { VectorStoreFactory } from "./vector-store-factory.js";
export { RetrieverBuilder } from "./retriever-builder.js";

// 向后兼容的函数导出
export { 
  buildInMemoryRetriever, 
  buildChromaRetriever, 
  connectToExistingChromaCollection 
} from "./retriever.js";