#!/usr/bin/env node

/**
 * ChromaDB 向量数据库清理工具
 * 用于清理现有向量数据库，特别是在更换嵌入模型后
 */

import { VectorStoreFactory } from "./src/rag/vector-store-factory.js";
import dotenv from "dotenv";

// 加载环境变量
dotenv.config();

const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000';

/**
 * 主清理函数
 */
async function main() {
    console.log('🗑️  ChromaDB 向量数据库清理工具');
    console.log('=====================================');
    console.log(`🔗 ChromaDB 地址: ${CHROMA_URL}`);
    console.log('');

    try {
        // 步骤 1: 列出现有集合
        console.log('📋 正在获取现有集合...');
        const collections = await VectorStoreFactory.listChromaCollections({
            chromaUrl: CHROMA_URL
        });

        if (collections.length === 0) {
            console.log('✅ 没有找到需要清理的集合');
            return;
        }

        // 步骤 2: 清理默认集合
        console.log('🗑️  正在清理默认集合 "langchain-docs"...');
        const cleaned = await VectorStoreFactory.cleanChromaCollection({
            collectionName: "langchain-docs",
            chromaUrl: CHROMA_URL
        });

        if (cleaned) {
            console.log('✅ 向量数据库清理完成！');
            console.log('');
            console.log('💡 清理完成后，您可以：');
            console.log('   1. 重新运行聊天机器人: npm run chat');
            console.log('   2. 重新运行 agent: node src/agent.js');
            console.log('   3. 系统会使用新的嵌入模型重新构建向量索引');
        } else {
            console.log('❌ 向量数据库清理失败');
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ 清理过程中发生错误:', error.message);

        // 提供具体的错误处理建议
        if (error.message.includes('ECONNREFUSED')) {
            console.error('💡 ChromaDB 服务未启动，请先启动:');
            console.error('   docker run -p 8000:8000 chromadb/chroma');
        } else if (error.message.includes('network') || error.message.includes('timeout')) {
            console.error('💡 网络连接问题，请检查 ChromaDB 服务状态');
        }

        process.exit(1);
    }
}

// 如果直接运行此脚本
// if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
// }

export { main as cleanVectorDatabase };