import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import dotenv from "dotenv";
dotenv.config();

// ① 实例化 Gemini（速度优先可用 "gemini-2.0-flash"；稳妥可用 "gemini-1.5-pro"）
const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  temperature: 0,
  apiKey: process.env.GOOGLE_API_KEY,
});

// ② 定义 Prompt 模板（系统消息 + 用户消息）
const prompt = ChatPromptTemplate.fromMessages([
  ["system", "Translate the following from English into {language}"],
  ["user", "{text}"],
]);

const promptValue = await prompt.invoke({
  language: "italian",
  text: "hi!",
});
console.log(promptValue.toChatMessages());

// ③ 串成一条链：Prompt → Model
// 串上 StringOutputParser，把 AIMessageChunk -> 字符串
const chain = prompt.pipe(model).pipe(new StringOutputParser());

// ④ 运行：把变量注入模板再调用模型
// const out1 = await chain.invoke({ language: "japanese", text: "How are you?" });
// console.log(out1.content); // 例如：お元気ですか？
// stream 输出
try {
  const stream = await chain.stream({
    language: "japanese",
    text: "How are you?",
  });
  for await (const token of stream) {
    process.stdout.write(token);
  }
} catch (err) {
  console.error("Streaming failed:", err);
} finally {
  process.stdout.write("\n");
}

// 非 stream 输出
// const out2 = await chain.invoke({
//   language: "chinese",
//   text: "translate the following from english into chinese",
// });
// console.log(out2.content); // 例如：J'adore programmer.
