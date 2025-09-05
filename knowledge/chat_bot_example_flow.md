# utils/chat_bot_example.js 流程图（修正版）

本流程图基于源码梳理整体逻辑，已避免 Mermaid 解析冲突（去除引号、花括号等特殊字符）。

```text
简洁文本流程图（逻辑骨架）

[初始化]
  ├─ 导入依赖 → 构建 Prompt → 构建 Chain → 配置 trimMessages
  ├─ 定义节点 callModel（裁剪 → 调用 chain → 返回 messages）
  └─ 构建 StateGraph：START → model → END；compile 使用 MemorySaver → app

[两种运行路径]
  1) runTime(userText, threadId?)
     → 生成/复用 thread_id
     → app.invoke({ messages }, { thread_id })
     → 取最后一条 AI 消息
     → 返回 { reply, threadId }

  2) CLI main()
     → 生成 threadId 并提示
     → 循环读取输入：
         · '/exit' → 退出
         · '/new'  → 重置 threadId
         · 其他文本 → app.streamEvents({ messages }, { version:v2, thread_id })
           ↳ 仅处理 on_chat_model_stream：拼接 chunk 内容并输出；流结束换行
           ↳ 异常时打印错误并继续
```

```mermaid
flowchart LR
  %% =============== 初始化与图构建 ===============
  subgraph Init[初始化与图构建]
    A0[导入依赖<br/>langgraph core uuid readline] --> A1[构建 Prompt<br/>system 加 MessagesPlaceholder]
    A1 --> A2[构建 Chain<br/>prompt.pipe llm]
    A2 --> A3[消息裁剪器<br/>trimMessages 配置]
    A3 --> A4[节点函数 callModel<br/>裁剪 然后 调用 chain 返回 messages]
    A4 --> A5[构建 StateGraph<br/>添加节点 model]
    A5 --> A6[添加连边<br/>START 到 model 到 END]
    A6 --> A7[编译工作流<br/>MemorySaver 作为 checkpointer]
  end

  %% =============== CLI 交互主循环 ===============
  subgraph CLI[CLI 交互 main]
    B0[启动 main<br/>生成并打印 threadId] --> B1{读取输入}
    B1 -- /exit --> B9[关闭并退出]
    B1 -- /new --> B2[重置 threadId 并提示] --> B1
    B1 -- 普通文本 --> B3[调用 app.streamEvents<br/>传入 thread_id]
    B3 --> B4{事件是 on_chat_model_stream 吗}
    B4 -- 是 --> B5[解析 chunk content<br/>拼接并输出]
    B5 --> B6{首次输出}
    B6 -- 是 --> B7[打印前缀 助手] --> B8[写入片段]
    B6 -- 否 --> B8
    B4 -- 否 --> B10[忽略其他事件]
    B8 --> B11[流结束换行] --> B1
  end

  %% =============== 一次性函数调用 ===============
  subgraph Once[一次性调用 runTime]
    C0[传入 userText 与可选 threadId] --> C1[生成或复用 thread_id]
    C1 --> C2[调用 app.invoke<br/>传入 messages 与 config]
    C2 --> C3[取最后一条 AI 消息]
    C3 --> C4[返回 reply 与 threadId]
  end

  A7 --> Once
  A7 --> CLI
```

## 关键点
- 记忆分线程：MemorySaver 配合 `configurable.thread_id` 持久化上下文；输入 `/new` 更换会话轨迹。
- 流式输出：`app.streamEvents` 仅消费 `on_chat_model_stream`，增量拼接输出；异常打印错误并继续循环。
- 消息裁剪：`trimMessages` 使用 last 策略，保留 system，近似 token 计数避免上下文过长。
- 图结构：极简单链路 START → model → END；`model` 节点即 `callModel`。
- 复用：CLI 交互与 `runTime` 共用同一 `app` 与记忆机制。

文件：`utils/chat_bot_example.js`
入口：文件底部 `main()`（可 `node utils/chat_bot_example.js` 运行）
