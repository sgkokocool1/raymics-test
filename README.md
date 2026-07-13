# raymics-test

## 飞书撤回消息查看器

目录：[`feishu-recall-viewer/`](./feishu-recall-viewer/)

基于飞书开放平台的消息留存 + 撤回事件应用：机器人先存消息，再监听撤回，在 Web 面板查看被撤回原文。

```bash
cd feishu-recall-viewer
npm install
npm run seed:demo
npm start
# 打开 http://localhost:3000
```

详细接入说明见 [`feishu-recall-viewer/README.md`](./feishu-recall-viewer/README.md)。

> 说明：飞书官方撤回事件不含原文，必须先保存 `im.message.receive_v1`。本项目是开放平台机器人方案，不是破解客户端的浏览器插件。
