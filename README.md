# LangChain_example

一个基于 LangChain 框架与 Google GenAI 集成的示例项目，展示聊天机器人、翻译助手和 RAG（检索增强生成）功能。

## 功能特性

- 🤖 **智能聊天机器人** - 支持多轮对话与记忆管理
- 🌍 **翻译助手** - 基于 AI 的多语言翻译
- 📚 **RAG 检索系统** - 支持知识库问答，现已支持 ChromaDB 持久性存储
- 💾 **双存储模式** - 内存存储（开发）+ ChromaDB（生产）

## 快速开始

### 1. 环境准备
```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入你的 GOOGLE_API_KEY
```

### 2. 基础使用（内存存储）
```bash
# 运行聊天机器人
npm run chat

# 运行翻译助手
npm run translate
```

### 3. ChromaDB 持久性存储（推荐生产环境）

#### 启动 ChromaDB 服务
```bash
# 方式1: Docker（推荐）
docker run -p 8000:8000 chromadb/chroma

# 方式2: Python
pip install chromadb
python -c "import chromadb; chromadb.run_server()"

# 方式3: 命令行
python -m chromadb.cli run --host localhost --port 8000
```

#### 配置使用 ChromaDB
```bash
# 在 .env 文件中设置
USE_CHROMA=true
CHROMA_URL=http://localhost:8000
```

#### 测试 ChromaDB 集成
```bash
# 测试连接
node test_chroma_connection.js

# 测试 RAG 功能
node test_rag_chroma.js

# 运行聊天机器人（ChromaDB 模式）
npm run chat
```

## 项目结构
```
LangChain_example/
├── src/
│   ├── rag/
│   │   └── retriever.js          # 向量检索器（支持双模式）
│   └── utils/
│       ├── chat_bot_example.js   # 聊天机器人示例
│       ├── translate_bot_example.js
│       └── ...
├── knowledge/                    # 知识库文档
│   └── chat_bot_example_flow.md
├── test_chroma_connection.js     # ChromaDB 连接测试
├── test_rag_chroma.js           # RAG 功能测试
├── .env.example                 # 环境配置示例
└── README.md
```

## 环境变量说明

| 变量名 | 默认值 | 描述 |
|--------|--------|------|
| `GOOGLE_API_KEY` | - | Google GenAI API 密钥（必需）|
| `USE_CHROMA` | false | 启用 ChromaDB 持久性存储 |
| `CHROMA_URL` | http://localhost:8000 | ChromaDB 服务地址 |
| `LANGSMITH_TRACING` | true | LangSmith 追踪（可选）|

## 使用示例

### 聊天机器人交互
```bash
# 启动聊天机器人
npm run chat

# 可用命令：
# > 普通对话           - 直接输入问题
# > /rag <问题>        - 基于知识库回答
# > /new              - 开始新会话
# > /exit             - 退出
```

### RAG 检索示例
```bash
> /rag 什么是聊天机器人
📚: 根据知识库内容，聊天机器人是...
```

## ChromaDB vs 内存存储

| 特性 | 内存存储 | ChromaDB |
|------|----------|----------|
| 启动速度 | ⚡ 快速 | 🔄 需启动服务 |
| 数据持久性 | ❌ 重启丢失 | ✅ 持久化存储 |
| 内存占用 | ⚠️ 高（全内存）| ✅ 低（按需加载）|
| 扩展性 | ❌ 受内存限制 | ✅ 支持大规模数据 |
| 生产就绪 | ❌ 仅适合开发 | ✅ 生产环境友好 |

## 故障排除

### ChromaDB 连接问题
```bash
# 检查服务状态
node test_chroma_connection.js

# 常见解决方案：
# 1. 确保 ChromaDB 服务运行在 8000 端口
# 2. 检查防火墙设置
# 3. 验证 .env 中的 CHROMA_URL 配置
```

### 依赖安装问题
```bash
# 如遇到版本冲突
npm install --legacy-peer-deps
```

## 技术栈

- **LLM**: Google Generative AI (Gemini)
- **框架**: LangChain, LangGraph
- **向量数据库**: ChromaDB / MemoryVectorStore
- **文本嵌入**: Google text-embedding-004
- **运行时**: Node.js (ESM)

## 开发指南

详细的开发工作流程和架构说明请参考：
- [ChromaDB 集成工作流程](./.cursor/workflow_chromadb_integration.md)
- [项目架构文档](./AGENTS.md)

## 许可证

MIT License