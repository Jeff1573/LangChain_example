import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

import translateExample from "./utils/translate_example.js";
import chatBotExample from "./utils/chat_bot_example.js";
// import dotenv from "dotenv";
// dotenv.config();

// ① 实例化 Gemini（速度优先可用 "gemini-2.0-flash"；稳妥可用 "gemini-1.5-pro"）
// const model = new ChatGoogleGenerativeAI({
//   model: "gemini-2.5-flash",
//   temperature: 0,
//   apiKey: process.env.GOOGLE_API_KEY,
// });

// 翻译示例
// translateExample(model);

async function main() {
  // 第一次：新线程
  const first = await chatBotExample("嗨，我叫小王。");
  console.log("A1:", first.reply, "thread:", first.threadId);

  // 第二次：复用同一个线程，应该“记住我叫小王”
  const second = await chatBotExample("我刚才说我叫什么来着？", first.threadId);
  console.log("A2:", second.reply);
}

main().catch(console.error);
