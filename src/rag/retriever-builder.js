import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { DocumentLoader } from "./document-loader.js";
import { DocumentProcessor } from "./document-processor.js";
import { VectorStoreFactory } from "./vector-store-factory.js";

/**
 * 检索器构建器 - 优化为仅支持ChromaDB持久化存储，确保数据安全
 */
export class RetrieverBuilder {
  constructor(options = {}) {
    this.knowledgeDir = options.knowledgeDir || "knowledge";
    this.embeddingModel = options.embeddingModel || "gemini-embedding-001";
    // 针对大文件优化的处理参数
    this.processorOptions = {
      chunkSize: options.chunkSize || 1200,
      chunkOverlap: options.chunkOverlap || 300,
    };
    // ChromaDB 配置
    this.chromaOptions = {
      batchSize: options.batchSize || 100,
      collectionName: options.collectionName || "langchain-docs",
      chromaUrl: options.chromaUrl || process.env.CHROMA_URL || "http://localhost:8000"
    };
    
    this.documentLoader = new DocumentLoader(this.knowledgeDir);
    this.documentProcessor = new DocumentProcessor(this.processorOptions);
    this.embeddings = new GoogleGenerativeAIEmbeddings({
      model: this.embeddingModel,
    });
  }

  /**
   * 构建内存检索器（已弃用，自动转为ChromaDB）
   * @deprecated 已弃用，自动使用 buildChromaRetriever
   * @param {Object} options 配置选项
   * @returns {Promise<Object>} 检索器实例
   */
  async buildMemoryRetriever(options = {}) {
    console.warn('⚠️  buildMemoryRetriever 已弃用，自动转为 ChromaDB 模式');
    return await this.buildChromaRetriever(options);
  }

  /**
   * 构建 ChromaDB 检索器（增强版，包含完整性验证）
   * @param {Object} options 配置选项
   * @returns {Promise<Object>} 检索器实例
   */
  async buildChromaRetriever(options = {}) {
    const { k = 30, ...customOptions } = options;
    const chromaOptions = { ...this.chromaOptions, ...customOptions };
    
    console.log('📁 开始构建 ChromaDB 检索器...');
    
    try {
      // 步骤 1: 加载原始文档
      console.log('📚 正在加载文档...');
      const rawDocs = await this.documentLoader.loadDocuments();
      console.log(`✅ 已加载 ${rawDocs.length} 个原始文档`);
      
      // 步骤 2: 文档切分
      console.log('✂️ 正在切分文档...');
      const splitDocs = await this.documentProcessor.splitDocuments(rawDocs);
      console.log(`✅ 已切分为 ${splitDocs.length} 个文档块`);
      
      // 步骤 3: 元数据清理
      console.log('🧤 正在清理元数据...');
      const sanitizedDocs = this.documentProcessor.sanitizeMetadata(splitDocs);
      
      // 步骤 4: 完整性验证
      const integrityReport = this.documentProcessor.validateProcessingIntegrity(rawDocs, sanitizedDocs);
      console.log('📊 文档处理完整性报告:');
      console.log(`   - 原始文档: ${integrityReport.originalDocsCount} 个`);
      console.log(`   - 处理后块数: ${integrityReport.processedChunksCount} 个`);
      console.log(`   - 内容保留率: ${integrityReport.contentRetentionRate}%`);
      console.log(`   - 平均切分数: ${integrityReport.averageChunksPerDoc}`);
      
      // 步骤 5: 创建向量存储
      console.log('📦 正在创建向量存储...');
      const vectorStore = await VectorStoreFactory.createChromaStore(
        sanitizedDocs, 
        this.embeddings, 
        chromaOptions
      );
      
      // 步骤 6: 数据库完整性验证
      console.log('🔍 正在验证数据库完整性...');
      const dbIntegrity = await VectorStoreFactory.validateDatabaseIntegrity(
        vectorStore, 
        sanitizedDocs.length
      );
      
      if (dbIntegrity.isValid) {
        console.log(`✅ 数据库验证成功`);
        console.log(`   - 预期数量: ${dbIntegrity.expectedCount}`);
        console.log(`   - 实际数量: ${dbIntegrity.actualCount}`);
      } else {
        console.warn(`⚠️ 数据库验证失败: ${dbIntegrity.error}`);
      }
      
      // 步骤 7: 创建检索器
      const retriever = vectorStore.asRetriever({ k });
      console.log(`🎉 ChromaDB 检索器构建完成，检索参数 k=${k}`);
      
      return retriever;
    } catch (error) {
      console.error('❌ ChromaDB 检索器构建失败:', error.message);
      throw new Error(`检索器构建失败: ${error.message}`);
    }
  }

  /**
   * 连接到现有 ChromaDB 集合并创建检索器（增强版）
   * @param {Object} options 配置选项
   * @returns {Object} 检索器实例
   */
  connectToExistingRetriever(options = {}) {
    const { k = 30, ...customOptions } = options;
    const chromaOptions = { ...this.chromaOptions, ...customOptions };
    
    try {
      console.log(`🔗 正在连接到现有 ChromaDB 集合: ${chromaOptions.collectionName}`);
      
      const vectorStore = VectorStoreFactory.connectToExistingChroma(
        this.embeddings, 
        chromaOptions
      );
      
      const retriever = vectorStore.asRetriever({ k });
      console.log(`✅ 成功连接到现有检索器，检索参数 k=${k}`);
      
      return retriever;
    } catch (error) {
      console.error('❌ 连接现有检索器失败:', error.message);
      throw new Error(`连接失败: ${error.message}`);
    }
  }
}