import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { TextLoader } from "langchain/document_loaders/fs/text";

/**
 * 文档加载器 - 负责从指定目录加载各种格式的文档
 */
export class DocumentLoader {
  constructor(knowledgeDir = "knowledge") {
    this.knowledgeDir = knowledgeDir;
    this.supportedFormats = {
      ".pdf": (path) => new PDFLoader(path),
      ".txt": (path) => new TextLoader(path),
      ".md": (path) => new TextLoader(path),
    };
  }

  /**
   * 加载指定目录下的所有文档
   * @returns {Promise<Array>} 原始文档数组
   */
  async loadDocuments() {
    const loader = new DirectoryLoader(this.knowledgeDir, this.supportedFormats);
    return await loader.load();
  }

  /**
   * 添加新的文件格式支持
   * @param {string} extension 文件扩展名
   * @param {Function} loaderFactory 加载器工厂函数
   */
  addFormat(extension, loaderFactory) {
    this.supportedFormats[extension] = loaderFactory;
  }
}