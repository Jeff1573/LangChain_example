// LangGraph 状态机和记忆管理
import {
  START,
  END,
  MessagesAnnotation,
  StateGraph,
  MemorySaver,
} from "@langchain/langgraph";

// 工具和 UUID 生成
import { v4 as uuidv4 } from "uuid";

// LLM 模型和消息处理
import llm from "./utils/generate_mode.js";
import { trimMessages } from "@langchain/core/messages";

// CLI 交互
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

// Prompt 模板
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
  PromptTemplate,
} from "@langchain/core/prompts";

// RAG 相关模块
import { buildInMemoryRetriever, buildChromaRetriever } from "./rag/retriever.js";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createRetrievalChain } from "langchain/chains/retrieval";

// 环境变量加载
import dotenv from "dotenv";

// 加载环境变量
dotenv.config();

// === Google Gemini LLM 模型配置 ===
// 从 generate_mode.js 导入已配置好的 Google Gemini 模型实例
// 默认使用 "gemini-2.5-flash" 模型，支持流式输出

// === RAG 检索器配置 ===
// 强制使用 ChromaDB 持久化存储，确保数据安全
const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000';

// 移除内存存储选项，仅支持 ChromaDB
console.log(`🏗️  强制使用 ChromaDB 持久化存储模式`);
console.log(`🔗 ChromaDB 地址: ${CHROMA_URL}`);

// 初始化检索器（仅支持 ChromaDB 模式）
// 针对大文件优化：使用更高的 k 值以获取更多相关结果
const retriever = await buildChromaRetriever({ 
  k: 30,
  chromaUrl: CHROMA_URL,
  batchSize: 200, // 写入批量大幅提升吞吐
  embedSubBatchSize: 32, // 嵌入子批量，兼顾稳定性
  preEmbedFilter: true, // 关闭预嵌入过滤，降低额外开销
  resetCollection: true, // 首次或全量重建时为 true，增量可设为 false
});

console.log(`🔧 使用向量存储类型: ChromaDB (持久性存储)`);
console.log(`📚 知识库初始化完成，检索器已准备好`);

// === Prompt 模板定义 ===
// 常规对话 Prompt 模板
const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful assistant. Answer clearly and concisely in Chinese."],
  new MessagesPlaceholder("messages"),
]);

// RAG 专用 Prompt 模板（包含上下文和来源信息）
// Task 4: 优化RAG Prompt模板 - 平衡检索内容与对话历史，支持多轮对话
const ragPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    [
      "你是一个有帮助的智能助手。请基于给定的 CONTEXT 来回答问题。",
      "如果答案不在上下文中，请诚实地说你不知道。",
      "请用中文回答。在回答结束后，请列出 SOURCES（去重）来自元数据。",
      "请综合分析所有相关的上下文片段，提供完整的解答。",
      "请结合对话历史和检索到的上下文信息来提供连贯的回答。",
      "",
      "CONTEXT:",
      "{context}",
    ].join("\n"),
  ],
  new MessagesPlaceholder("chat_history"),
  ["human", "{input}"],
]);

// 文档格式化模板（用于 RAG 显示来源）
const documentPrompt = PromptTemplate.fromTemplate(
  "SOURCE: {source}\n{page_content}"
);

// 组装基础对话链：prompt -> 模型
const chain = prompt.pipe(llm);

// === 消息裁剪器配置 ===
// 防止上下文窗口溢出，控制历史消息长度
const trimmer = trimMessages({
  maxTokens: 1000, // 安全上限，防止模型窗口溢出
  strategy: "last", // 保留最近的对话
  includeSystem: true, // 始终保留系统消息
  allowPartial: true, // 允许截断过长的单条消息
  // 简易 Token 估算：中文约 2 字符 = 1 token，英文约 4 字符 = 1 token
  tokenCounter: (msgs) => {
    const text = msgs
      .map((m) =>
        typeof m.content === "string" ? m.content : JSON.stringify(m.content)
      )
      .join(" ");
    return Math.ceil(text.length / 3); // 中文优化的估算
  },
});

// === 模型调用节点定义 ===
/**
 * 处理状态中的消息，调用 LLM 生成回复
 * @param {typeof MessagesAnnotation.State} state - LangGraph 状态对象
 * @returns {Object} 返回新的消息状态
 */
const callModel = async (state) => {
  // 裁剪历史消息防止上下文过长
  const trimmed = await trimmer.invoke(state.messages);
  // 调用基础对话链生成回复
  const response = await chain.invoke({ messages: trimmed });
  return { messages: response }; // 返回给 LangGraph 的消息状态
};

/**
 * RAG 专用状态机节点：处理检索增强生成
 * @param {typeof MessagesAnnotation.State} state - LangGraph 状态对象
 * @returns {Object} 返回新的消息状态
 */
// Task 1: 创建RAG专用状态机节点 - 集成检索器和会话记忆
const callRAGModel = async (state) => {
  // 获取最新的用户消息
  const lastMessage = state.messages[state.messages.length - 1];
  const userInput = lastMessage.content;
  
  // 构建对话历史（排除当前用户消息）
  const chatHistory = state.messages.slice(0, -1);
  
  try {
    // 使用 RAG 检索链进行检索增强生成
    const result = await ragChain.invoke({
      input: userInput,
      chat_history: chatHistory // 传入历史对话上下文
    });
    
    // 提取回复内容
    const reply = result?.answer ?? result?.output_text ?? "⚠️ 未找到相关信息";
    
    // 返回 AI 消息格式
    return {
      messages: [{
        role: "assistant",
        content: reply
      }]
    };
  } catch (error) {
    console.error("RAG 检索失败：", error.message);
    return {
      messages: [{
        role: "assistant",
        content: `❌ RAG 检索失败：${error.message}`
      }]
    };
  }
};

// === StateGraph 状态机架构 ===
// 构建常规对话工作流：START -> model -> END
const workflow = new StateGraph(MessagesAnnotation)
  .addNode("model", callModel) // 添加模型调用节点
  .addEdge(START, "model")     // START 节点连接到 model
  .addEdge("model", END);      // model 节点连接到 END

// Task 1: 创建RAG专用状态机节点 - 构建RAG工作流
const ragWorkflow = new StateGraph(MessagesAnnotation)
  .addNode("ragModel", callRAGModel) // 添加 RAG 模型调用节点
  .addEdge(START, "ragModel")        // START 节点连接到 ragModel
  .addEdge("ragModel", END);         // ragModel 节点连接到 END

// === 记忆检查点配置 ===
// 使用 MemorySaver 实现会话持久化，支持多线程对话
const app = workflow.compile({ 
  checkpointer: new MemorySaver() 
});

// Task 1: 创建RAG专用状态机节点 - 编译RAG工作流为可执行应用
const ragApp = ragWorkflow.compile({
  checkpointer: new MemorySaver()
});

console.log("🏠 状态机和记忆检查点初始化完成");

// === RAG 检索增强生成链 ===
// 构建文档组合链（将检索到的文档与用户查询结合）
const docChain = await createStuffDocumentsChain({
  llm, // 复用 Google Gemini 模型实例
  prompt: ragPrompt, // 使用 RAG 专用的 Prompt 模板
  documentPrompt, // 文档格式化模板，显示来源信息
});

// 构建完整的 RAG 检索链（检索 + 生成）
const ragChain = await createRetrievalChain({
  retriever, // 使用初始化的检索器
  combineDocsChain: docChain, // 使用文档组合链
});

console.log("🔗 RAG 检索增强生成链构建完成");

// === 工具函数 ===
/**
 * 便捷的单次执行函数，返回 AI 回复和线程 ID
 * @param {string} userText - 用户输入内容
 * @param {string} threadId - 线程 ID，用于会话记忆
 * @returns {Promise<{reply: string, threadId: string}>} AI 回复和线程 ID
 */
export async function runTime(userText, threadId) {
  const config = { configurable: { thread_id: threadId ?? uuidv4() } };
  const output = await app.invoke(
    { messages: [{ role: "user", content: userText }] },
    config
  );
  const last = output.messages[output.messages.length - 1];
  return { reply: last.content, threadId: config.configurable.thread_id };
}

/**
 * RAG 模式的便捷执行函数，支持会话持久化
 * @param {string} userText - 用户输入内容
 * @param {string} threadId - 线程 ID，用于会话记忆
 * @returns {Promise<{reply: string, threadId: string}>} RAG 回复和线程 ID
 */
// Task 2: 构建RAG工作流状态机 - 提供 RAG 专用执行函数
export async function runRAG(userText, threadId) {
  const config = { configurable: { thread_id: threadId ?? uuidv4() } };
  const output = await ragApp.invoke(
    { messages: [{ role: "user", content: userText }] },
    config
  );
  const last = output.messages[output.messages.length - 1];
  return { reply: last.content, threadId: config.configurable.thread_id };
}

// === CLI 交互主程序 ===
/**
 * 主 CLI 交互函数，支持对话、RAG 检索和会话管理
 */
async function main() {
  let threadId = uuidv4();
  console.log("🔍 当前线程:", threadId);
  console.log("💬 聊天开始。命令：/new 开新会话, /rag <问题> 知识库检索, /exit 退出");
  console.log("💡 提示：在对话中遇到问题时，请检查网络连接和 API 密钥配置");
  console.log("🔥 新增：RAG模式现已支持会话持久化，可记住上下文！\n");

  // 创建 readline 接口用于用户输入
  const rl = readline.createInterface({ 
    input, 
    output,
    // 增加信号处理
    terminal: true
  });
  
  // 优雅地处理退出信号
  process.on('SIGINT', () => {
    console.log("\n\n👋 接收到退出信号，再见！");
    rl.close();
    process.exit(0);
  });
  
  while (true) {
    try {
      const q = await rl.question("> ");
      const text = q.trim();
      if (!text) continue;

      // === 命令处理 ===
      if (text === "/exit") {
        break;
      }
      
      if (text === "/new") {
        threadId = uuidv4();
        console.log("✅ 新线程:", threadId);
        continue;
      }
      
      // 帮助命令
      if (text === "/help" || text === "/h") {
        console.log("\n📚 可用命令：");
        console.log("  /new        - 开始新的对话线程");
        console.log("  /rag <问题>  - 使用 RAG 模式检索知识库（支持会话记忆）");
        console.log("  /help (/h)  - 显示这个帮助信息");
        console.log("  /exit       - 退出程序");
        // Task 5: 更新CLI命令处理 - 添加RAG会话持久化的说明
        console.log("\n🔥 RAG功能升级：");
        console.log("  - 现在支持会话记忆，可以记住上下文");
        console.log("  - 支持多轮对话，可以说'之前提到的...'");
        console.log("  - 与普通聊天共享同一个线程 ID\n");
        continue;
      }

      // === RAG 模式：从知识库检索并回答 ===
      if (text.startsWith("/rag")) {
        const question = text.slice(4).trim();
        if (!question) {
          console.log("⚠️  用法: /rag <问题>");
          console.log("📚 示例: /rag 什么是 RAG?");
          continue;
        }
        try {
          console.log("🔍 正在检索知识库...");
          
          // Task 3: 修改RAG调用逻辑 - 使用状态机驱动的 RAG 流式输出
          const stream = await ragApp.streamEvents(
            { messages: [{ role: "user", content: question }] },
            { version: "v2", configurable: { thread_id: threadId } }
          );

          let first = true;
          let hasContent = false;
          for await (const ev of stream) {
            if (ev.event === "on_chat_model_stream") {
              const chunk = ev.data?.chunk;
              const piece = Array.isArray(chunk?.content)
                ? chunk.content
                    .map((c) => (typeof c === "string" ? c : c?.text ?? ""))
                    .join("")
                : chunk?.content ?? "";
              
              if (first && piece) {
                process.stdout.write("📚 RAG: ");
                first = false;
              }
              if (piece) {
                process.stdout.write(piece);
                hasContent = true;
              }
            }
          }
          
          if (!hasContent) {
            console.log("📚 RAG: 抱歉，未找到相关信息。");
          } else {
            process.stdout.write("\n");
          }
          
        } catch (err) {
          console.error("❌ RAG 检索失败：", err.message);
          if (err.message.includes('API')) {
            console.error("💡 请检查 Google API 密钥是否正确配置");
          } else if (err.message.includes('network') || err.message.includes('ENOTFOUND')) {
            console.error("💡 请检查网络连接是否正常");
          }
        }
        continue;
      }

      // === 常规对话模式：使用流式输出 ===
      const stream = await app.streamEvents(
        { messages: [{ role: "user", content: text }] },
        { version: "v2", configurable: { thread_id: threadId } }
      );

      let first = true;
      let hasContent = false;
      for await (const ev of stream) {
        if (ev.event === "on_chat_model_stream") {
          const chunk = ev.data?.chunk;
          // 兼容处理不同类型的 chunk 内容
          const piece = Array.isArray(chunk?.content)
            ? chunk.content
                .map((c) => (typeof c === "string" ? c : c?.text ?? ""))
                .join("")
            : chunk?.content ?? "";
          
          if (first && piece) {
            process.stdout.write("🤖: ");
            first = false;
          }
          if (piece) {
            process.stdout.write(piece);
            hasContent = true;
          }
        }
      }
      
      if (!hasContent) {
        console.log("🤖: 抱歉，我暂时无法生成回复。请稍后再试。");
      } else {
        process.stdout.write("\n");
      }
      
    } catch (err) {
      console.error("❌ 调用失败：", err.message);
      
      // 提供具体的错误处理建议
      if (err.message.includes('API')) {
        console.error("💡 可能的解决方案：");
        console.error("   1. 检查 .env 文件中的 GOOGLE_API_KEY 是否正确");
        console.error("   2. 确认 API 密钥有效且未超出配额");
      } else if (err.message.includes('network') || err.message.includes('timeout')) {
        console.error("💡 网络相关问题：请检查网络连接和防火墙设置");
      } else {
        console.error("💡 请尝试重新输入或使用 /new 开始新对话");
      }
    }
  }

  rl.close();
  console.log("👋 再见！");
}

// 自动启动 CLI 交互
main().catch(console.error);


