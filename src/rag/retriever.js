import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { TextLoader } from "langchain/document_loaders/fs/text"; // 文本加载器仍在主包入口
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { ChromaClient } from "chromadb";


/** 构建一个内存型 Retriever（简单、零依赖、适合入门） */
export async function buildInMemoryRetriever() {
  // 1) 加载目录
  const loader = new DirectoryLoader("knowledge", {
    ".pdf": (p) => new PDFLoader(p),
    ".txt": (p) => new TextLoader(p),
    ".md": (p) => new TextLoader(p),
  });
  const rawDocs = await loader.load();

  // 2) 切分文档：推荐 500–1000 字符的 chunk，重叠 100–200
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 800,
    chunkOverlap: 200,
  });
  const docs = await splitter.splitDocuments(rawDocs);

  // 3) 向量化：Google text-embedding-004
  const embeddings = new GoogleGenerativeAIEmbeddings({
    model: "text-embedding-004",
  });

  // 4) 存入向量库（ChromaDB 持久性存储版），并转成 Retriever
  const vectorstore = await buildChromaVectorStore(docs, embeddings);
  return vectorstore.asRetriever({ k: 4 });
}

/** 构建一个 ChromaDB 持久性 Retriever */
export async function buildChromaRetriever() {
  // 1) 加载目录
  const loader = new DirectoryLoader("knowledge", {
    ".pdf": (p) => new PDFLoader(p),
    ".txt": (p) => new TextLoader(p),
    ".md": (p) => new TextLoader(p),
  });
  const rawDocs = await loader.load();

  // 2) 切分文档：推荐 500–1000 字符的 chunk，重叠 100–200
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 800,
    chunkOverlap: 200,
  });
  const docs = await splitter.splitDocuments(rawDocs);

  // 3) 向量化：Google text-embedding-004
  const embeddings = new GoogleGenerativeAIEmbeddings({
    model: "text-embedding-004",
  });

  // 4) 存入向量库（ChromaDB 持久性存储），并转成 Retriever
  const vectorstore = await buildChromaVectorStore(docs, embeddings);
  return vectorstore.asRetriever({ k: 4 });
}

/** 
 * 清理文档元数据，确保符合 ChromaDB 的类型要求
 * @param {Array} docs 原始文档数组
 */
function sanitizeDocumentsMetadata(docs) {
  return docs.map(doc => {
    const sanitizedMetadata = {};
    
    // 只保留简单类型的元数据
    if (doc.metadata) {
      Object.entries(doc.metadata).forEach(([key, value]) => {
        // 只保留字符串、数字、布尔值和 null 类型
        if (
          typeof value === 'string' || 
          typeof value === 'number' || 
          typeof value === 'boolean' || 
          value === null
        ) {
          sanitizedMetadata[key] = value;
        } else if (typeof value === 'object' && value !== null) {
          // 对于对象类型，转换为字符串
          sanitizedMetadata[key] = JSON.stringify(value);
        }
      });
    }
    
    // 添加一些基本的元数据信息
    sanitizedMetadata.source = doc.metadata?.source || 'unknown';
    sanitizedMetadata.chunk_size = doc.pageContent?.length || 0;
    
    return {
      ...doc,
      metadata: sanitizedMetadata
    };
  });
}

/** 
 * 构建 ChromaDB 向量存储
 * @param {Array} docs 切分后的文档数组
 * @param {Object} embeddings 嵌入模型实例
 * @param {Object} options 可选配置参数
 */
async function buildChromaVectorStore(docs, embeddings, options = {}) {
  const {
    collectionName = "langchain-docs",
    chromaUrl = "http://localhost:8000",
    numDimensions = null, // 让 ChromaDB 自动推断
  } = options;

  try {
    // 初始化 ChromaDB 客户端（使用新的参数格式）
    const url = new URL(chromaUrl);
    const client = new ChromaClient({
      host: url.hostname,
      port: url.port || '8000',
      ssl: url.protocol === 'https:',
    });

    // 创建或获取集合
    try {
      await client.deleteCollection({ name: collectionName });
      console.log(`已删除现有集合: ${collectionName}`);
    } catch (error) {
      // 集合不存在，忽略错误
      console.log(`集合 ${collectionName} 不存在，将创建新集合`);
    }

    // 清理文档元数据，确保符合 ChromaDB 要求
    const sanitizedDocs = sanitizeDocumentsMetadata(docs);
    console.log(`已清理文档元数据，处理文档数量: ${sanitizedDocs.length}`);

    // 使用 LangChain 的 Chroma 向量存储
    const vectorStore = await Chroma.fromDocuments(
      sanitizedDocs,
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
    console.log(`已索引文档数量: ${sanitizedDocs.length}`);
    
    return vectorStore;
  } catch (error) {
    console.error("创建 ChromaDB 向量存储时发生错误:", error);
    throw error;
  }
}

/** 
 * 连接到已存在的 ChromaDB 集合
 * @param {Object} embeddings 嵌入模型实例
 * @param {Object} options 配置参数
 */
export async function connectToExistingChromaCollection(embeddings, options = {}) {
  const {
    collectionName = "langchain-docs",
    chromaUrl = "http://localhost:8000",
  } = options;

  try {
    // 解析 URL
    const url = new URL(chromaUrl);
    const vectorStore = new Chroma(embeddings, {
      collectionName,
      url: chromaUrl, // LangChain 的 Chroma 包装器仍使用 url 参数
    });

    console.log(`成功连接到现有 ChromaDB 集合: ${collectionName}`);
    return vectorStore;
  } catch (error) {
    console.error("连接到 ChromaDB 集合时发生错误:", error);
    throw error;
  }
}
