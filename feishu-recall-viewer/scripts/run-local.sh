#!/usr/bin/env bash
# 本机启动撤回查看服务（桌面 App 照常聊天，不改客户端）
# 用法：
#   1. 复制 .env.example 为 .env 并填写飞书应用凭证
#   2. ./scripts/run-local.sh
#   3. 另开终端用 ngrok/frp 把 3000 端口暴露为 HTTPS，填到飞书「事件订阅」请求地址
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ ! -f .env ]]; then
  echo "缺少 .env，请先: cp .env.example .env 并填写 FEISHU_* 配置"
  exit 1
fi
npm install
echo "服务启动后："
echo "  - 查看面板: http://localhost:3000"
echo "  - 事件地址: https://你的公网域名/webhook/event"
echo "  - 桌面飞书 App 无需改动，把机器人拉进目标群即可"
npm start
