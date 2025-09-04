import {
  START,
  END,
  MessagesAnnotation,
  StateGraph,
  MemorySaver,
} from "@langchain/langgraph";
import { v4 as uuidv4 } from "uuid";
import llm from "./generate_mode.js";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { trimMessages } from "@langchain/core/messages";

// ① 实例化 Gemini（速度优先可用 "gemini-2.0-flash"；稳妥可用 "gemini-1.5-pro"）

// === 定义一个可复用的 Prompt（含 system + 历史占位） ===
const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful assistant. Answer clearly and concisely."],
  // 这里把状态里的历史消息插进来
  new MessagesPlaceholder("messages"),
]);
// === 组装链：prompt -> 模型 ===
const chain = prompt.pipe(llm);

// === 定义裁剪器：控制历史长度，防止窗口爆掉 ===
const trimmer = trimMessages({
  maxTokens: 1000, // 自行按需调整；先给一个安全上限
  strategy: "last", // 保留最近的对话
  includeSystem: true, // 始终保留最前面的 system
  allowPartial: true, // 必要时允许截断一条过长消息
  // 简易估算 token 数，够用即可；要精确可换成专用 tokenizer
  tokenCounter: (msgs) => {
    const text = msgs
      .map((m) =>
        typeof m.content === "string" ? m.content : JSON.stringify(m.content)
      )
      .join(" ");
    // 英文大约 4 字符 ≈ 1 token；中文可把分母改小些（比如 2）
    return Math.ceil(text.length / 4);
  },
});

/**
 * 把累积的 messages 丢给模型
 * @param {typeof MessagesAnnotation.State} state
 * @returns
 */
const callModel = async (state) => {
  const trimmed = await trimmer.invoke(state.messages);
  const response = await chain.invoke({ messages: trimmed });
  return { messages: response }; // 仍然返给 LangGraph 的消息状态
};
// 组装工作流（一个节点，从 START → model → END）
const workflow = new StateGraph(MessagesAnnotation)
  .addNode("model", callModel)
  .addEdge(START, "model")
  .addEdge("model", END);

// 打开内存型检查点（持久化消息历史）
const app = workflow.compile({ checkpointer: new MemorySaver() });

// 一个便捷方法：执行一次，并返回最后一条回复和 threadId
/**
 *
 * @param {string} userText
 * @param {string} threadId
 * @returns
 */
export async function runTime(userText, threadId) {
  const config = { configurable: { thread_id: threadId ?? uuidv4() } }; // 关键：thread_id
  const output = await app.invoke(
    { messages: [{ role: "user", content: userText }] },
    config
  );
  const last = output.messages[output.messages.length - 1];
  return { reply: last.content, threadId: config.configurable.thread_id };
}

async function main() {
  let threadId = uuidv4();
  console.log("当前线程:", threadId);
  console.log("💬 Chat started. Commands: /new 开新会话, /exit 退出");

  // 解释：读取输入流，创建一个readline接口，用于读取用户输入
  const rl = readline.createInterface({ input, output });
  while (true) {
    const q = await rl.question("> ");
    const text = q.trim();
    if (!text) continue;
    if (text === "/exit") break;
    if (text === "/new") {
      threadId = uuidv4();
      console.log("✅ 新线程:", threadId);
      continue;
    }

    try {
      // === 改成事件流：保持 thread_id 以维持记忆 ===
      const stream = await app.streamEvents(
        { messages: [{ role: "user", content: text }] },
        { version: "v2", configurable: { thread_id: threadId } }
      );

      let first = true;
      for await (const ev of stream) {
        if (ev.event === "on_chat_model_stream") {
          const chunk = ev.data?.chunk;
          // chunk.content 可能是字符串或富文本片段数组，这里做兼容拼接
          const piece = Array.isArray(chunk?.content)
            ? chunk.content
                .map((c) => (typeof c === "string" ? c : c?.text ?? ""))
                .join("")
            : chunk?.content ?? "";
          if (first) {
            process.stdout.write("🤖: ");
            first = false;
          }
          process.stdout.write(piece);
        }
      }
      process.stdout.write("\n");
    } catch (err) {
      console.error("调用失败：", err);
    }
  }

  rl.close();
  console.log("👋 Bye");
}

main().catch(console.error);
