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
// ① 实例化 Gemini（速度优先可用 "gemini-2.0-flash"；稳妥可用 "gemini-1.5-pro"）



// 2) 定义“模型节点”：把累积的 messages 丢给模型
/**
 *
 * @param {typeof MessagesAnnotation.State} state
 * @returns
 */
const callModel = async (state) => {
  const response = await llm.invoke(state.messages);
  return { messages: response }; // LangGraph 会把它并进消息状态
};

// 3) 组装工作流（一个节点，从 START → model → END）
const workflow = new StateGraph(MessagesAnnotation)
  .addNode("model", callModel)
  .addEdge(START, "model")
  .addEdge("model", END);

// 4) 打开内存型检查点（持久化消息历史）
const app = workflow.compile({ checkpointer: new MemorySaver() });

// 5) 一个便捷方法：执行一次，并返回最后一条回复和 threadId
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
      const { reply } = await runTime(text, threadId);
      console.log("🤖:", reply);
    } catch (err) {
      console.error("调用失败：", err);
    }
  }
  rl.close();
  console.log("👋 Bye");
}

main().catch(console.error);
