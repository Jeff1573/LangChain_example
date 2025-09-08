// 统一导出入口 - 保持向后兼容性
import { DocumentLoader } from "./document-loader.js";
import { DocumentProcessor } from "./document-processor.js";
import { VectorStoreFactory } from "./vector-store-factory.js";
import { RetrieverBuilder } from "./retriever-builder.js";

// 导出所有模块类
export { DocumentLoader } from "./document-loader.js";
export { DocumentProcessor } from "./document-processor.js";
export { VectorStoreFactory } from "./vector-store-factory.js";
export { RetrieverBuilder } from "./retriever-builder.js";

/** 向后兼容：构建一个内存型 Retriever（简单、零依赖、适合入门） */
export async function buildInMemoryRetriever(options = {}) {
  const builder = new RetrieverBuilder();
  return await builder.buildMemoryRetriever(options);
}

/** 向后兼容：构建一个 ChromaDB 持久性 Retriever */
export async function buildChromaRetriever(options = {}) {
  const builder = new RetrieverBuilder();
  return await builder.buildChromaRetriever(options);
}

/** 向后兼容：连接到已存在的 ChromaDB 集合 */
export async function connectToExistingChromaCollection(embeddings, options = {}) {
  return VectorStoreFactory.connectToExistingChroma(embeddings, options);
}
