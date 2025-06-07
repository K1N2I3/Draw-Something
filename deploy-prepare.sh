#!/bin/bash

echo "🚀 准备部署你画我猜游戏..."

# 检查是否已经初始化Git
if [ ! -d ".git" ]; then
    echo "📁 初始化Git仓库..."
    git init
    git add .
    git commit -m "Initial commit: 你画我猜游戏 v1.0"
    echo "✅ Git仓库已初始化"
else
    echo "📁 Git仓库已存在，添加最新更改..."
    git add .
    git commit -m "Update: 准备部署版本"
    echo "✅ 代码已提交到Git"
fi

# 检查依赖
echo "📦 检查项目依赖..."
npm list --depth=0

echo ""
echo "🎯 下一步部署选项："
echo "1. Railway (免费推荐):"
echo "   - 访问 https://railway.app/"
echo "   - 连接你的GitHub仓库"
echo "   - 自动部署"
echo ""
echo "2. Render (免费备选):"
echo "   - 访问 https://render.com/"
echo "   - 连接GitHub仓库"
echo "   - 构建命令: npm install"
echo "   - 启动命令: npm start"
echo ""
echo "3. 阿里云/腾讯云 (国内推荐):"
echo "   - 购买轻量应用服务器"
echo "   - 安装Node.js"
echo "   - 克隆代码并运行"
echo ""
echo "📖 详细部署指南请查看: 部署指南.md"
echo "🎉 项目已准备就绪，可以开始部署了！" 