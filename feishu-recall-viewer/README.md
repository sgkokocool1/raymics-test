# 飞书撤回消息查看器

提供两种合规路径：

| 方案 | 目录 | 适合谁 |
| --- | --- | --- |
| **本地不入侵（油猴）** | [`userscript/`](./userscript/) | 个人本机、不想接开放平台、只看自己已经看过的消息 |
| **开放平台机器人** | 本目录 `npm start` | 需要群内自动存档、可服务端检索（可能要企业敏感权限） |

---

## 方案 A：本地不入侵（推荐先试）

不破解客户端、不读加密库、不申请企业权限。用 Tampermonkey 在飞书**网页版**归档你已经看到的消息，撤回后本地还原。

→ 安装与说明见 **[`userscript/README.md`](./userscript/README.md)**  
→ 脚本文件：[`userscript/feishu-recall-local.user.js`](./userscript/feishu-recall-local.user.js)

边界：脚本启动前 / 从未打开过的会话里的撤回，**无法**还原。

**只用桌面 App、不能开网页？** 见 [`userscript/DESKTOP.md`](./userscript/DESKTOP.md)。桌面客户端没有插件口；不入侵时请用下面的方案 B（本机跑机器人，聊天仍用 App）。

---

## 方案 B：开放平台机器人（桌面 App 也适用）

基于飞书开放平台的**消息留存 + 撤回事件**应用：机器人先把会话消息存下来，再监听 `im.message.recalled_v1`，在 Web 面板查看被撤回的原文。

> **重要限制（官方能力）**  
> 飞书撤回事件**不包含消息原文**，只给 `message_id`。因此必须先订阅并保存 `im.message.receive_v1`。  
> 机器人只能覆盖**自己所在会话**；群内收全量消息需要敏感权限 `im:message.group_msg`（需企业审批）。  
> 请仅用于你有权管理的会话，并遵守企业合规与隐私政策。本工具**不是**破解客户端本地缓存的浏览器插件。

## 功能

- 接收飞书事件：消息接收 / 消息撤回 / URL 校验 / Encrypt Key 解密
- 本地 JSON 持久化（零原生依赖，易部署）
- Web 面板：撤回列表、搜索、统计、演示数据
- 可选 `VIEWER_TOKEN` 保护查看接口

## 快速开始（演示模式）

```bash
cd feishu-recall-viewer
npm install
npm run seed:demo    # 写入演示撤回消息
npm start            # http://localhost:3000
```

浏览器打开 http://localhost:3000 即可看到演示数据。

## 接入真实飞书

### 1. 创建应用

1. 打开 [飞书开放平台](https://open.feishu.cn/) → 创建**企业自建应用**
2. 开启**机器人**能力
3. 复制 `App ID` / `App Secret`

### 2. 权限

在「权限管理」至少申请：

| 权限 | 用途 |
| --- | --- |
| `im:message` 或 `im:message:readonly` | 订阅撤回事件所需 |
| `im:message.p2p_msg` / `im:message.p2p_msg:readonly` | 收用户与机器人的单聊 |
| `im:message.group_msg`（敏感） | **收群内全部用户消息**（看撤回最常用） |
| 或 `im:message.group_at_msg:readonly` | 仅收 @ 机器人的群消息（覆盖面小） |

申请后发布应用版本，敏感权限需管理员审批。

### 3. 事件订阅

1. 「事件与回调」→ 请求地址填写：`https://你的公网域名/webhook/event`
2. 配置 Verification Token（建议）与 Encrypt Key（可选，更安全）
3. 订阅事件：
   - `im.message.receive_v1`（接收消息）
   - `im.message.recalled_v1`（撤回消息）

本地开发可用 [ngrok](https://ngrok.com/) / frp 把 `localhost:3000` 暴露为 HTTPS。

### 4. 环境变量

复制 `.env.example` 为 `.env`：

```bash
PORT=3000
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=xxx
FEISHU_VERIFICATION_TOKEN=你在后台看到的 Verification Token
FEISHU_ENCRYPT_KEY=          # 若开启了加密则必填
VIEWER_TOKEN=可选面板口令     # 设置后访问 /?token=口令
```

```bash
npm start
```

### 5. 拉机器人进群

把机器人拉进需要监控的群。之后：

1. 群里有人发消息 → 服务收到 `receive` → 入库  
2. 有人撤回 → 服务收到 `recalled` → 按 `message_id` 标记撤回  
3. 打开 Web 面板查看原文

## API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/webhook/event` | 飞书事件回调 |
| GET | `/api/health` | 健康检查 |
| GET | `/api/stats` | 统计 |
| GET | `/api/messages?recalledOnly=true&q=` | 消息列表 |
| GET | `/api/messages/:id` | 详情 |

若设置了 `VIEWER_TOKEN`，查看类接口需 Header `x-viewer-token` 或 Query `?token=`。

## 目录

```
feishu-recall-viewer/
├── public/index.html   # 查看面板
├── src/
│   ├── server.js       # Express 服务 + Webhook
│   ├── feishu.js       # 验签/解密/文本解析
│   ├── store.js        # JSON 存储
│   └── seed-demo.js    # 演示数据
├── data/               # 运行时数据（gitignore）
├── .env.example
└── package.json
```

## 常见问题

**为什么面板里是「撤回前未收到该消息原文」？**  
机器人入群前的历史消息、或没有 `group_msg` 权限时收不到原文，只能记到撤回事件本身。

**能做成浏览器插件直接读飞书网页吗？**  
不建议也不在本项目范围内：会触及客户端私有接口/本地缓存，稳定性与合规风险高。开放平台机器人方案才是官方支持路径。

**图片/文件能恢复吗？**  
本版本保存了 `image_key` / 文件元信息文本；真正下载文件需再调飞书消息资源接口（可后续扩展）。
