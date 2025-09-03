import {
  START,
  END,
  MessagesAnnotation,
  StateGraph,
  MemorySaver,
} from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
dotenv.config();
// ① 实例化 Gemini（速度优先可用 "gemini-2.0-flash"；稳妥可用 "gemini-1.5-pro"）
const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  temperature: 0,
  apiKey: process.env.GOOGLE_API_KEY,
});

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
export async function chatBotExample(userText, threadId) {
  const config = { configurable: { thread_id: threadId ?? uuidv4() } }; // 关键：thread_id
  const output = await app.invoke(
    { messages: [{ role: "user", content: userText }] },
    config
  );
  const last = output.messages[output.messages.length - 1];
  return { reply: last.content, threadId: config.configurable.thread_id };
}
export default chatBotExample;
