import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { TextLoader } from "langchain/document_loaders/fs/text"; // 文本加载器仍在主包入口
import { MemoryVectorStore } from "langchain/vectorstores/memory";


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

  // 4) 存入向量库（内存版），并转成 Retriever
  const vectorstore = await MemoryVectorStore.fromDocuments(docs, embeddings);
  return vectorstore.asRetriever({ k: 4 });
}
