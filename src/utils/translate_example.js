import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

async function translateExample(model) {
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
}

export default translateExample;
