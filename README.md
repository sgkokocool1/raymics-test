# 具身智能数据平台

调研业界优秀的具身智能（Embodied AI / Physical AI）数据平台，产出**设计调研文档**、**架构/流程图**、**可运行前端原型**，以及**工程化的前后端分离项目**（React + Vite 前端 + Express API 后端）。

## 目录结构

```
.
├── docs/
│   ├── 具身智能数据平台设计调研.md   # 设计调研文档（含 Mermaid 架构/流程图）
│   └── screenshots/                  # 工程化原型截图
├── backend/                          # Express REST API（内置确定性 mock 数据）
├── frontend/                         # React + Vite + TypeScript 前端
└── prototype/                        # 单文件零依赖静态原型（双击即用）
```

## 三种查看方式

### 1. 设计文档
阅读 [`docs/具身智能数据平台设计调研.md`](docs/具身智能数据平台设计调研.md)，包含平台盘点、分层架构、数据全生命周期、存储、数据模型、标签检索、看板设计、技术选型与实施路线，并内嵌 Mermaid 架构/流程图与原型截图。

### 2. 零依赖静态原型（最快）
```bash
cd prototype
python3 -m http.server 8080   # 或直接双击 index.html
```

### 3. 工程化项目（前后端分离，接入真实 API）

启动后端 API（默认 `http://localhost:4000`）：

```bash
cd backend
npm install
npm start
```

启动前端（默认 `http://localhost:5173`，通过 Vite 代理 `/api` 到后端）：

```bash
cd frontend
npm install
npm run dev
```

浏览器打开 http://localhost:5173 。

## 后端 API 端点

| 方法 & 路径 | 说明 |
| --- | --- |
| `GET /api/stats` | 看板聚合统计（分布/占比/漏斗/飞轮） |
| `GET /api/meta` | 枚举/筛选项 |
| `GET /api/episodes` | episode 列表（多维筛选 + 分页） |
| `GET /api/episodes/:id` | episode 详情（含传感器信号、子任务分割） |
| `GET /api/search` | 结构化 + 全文 + 语义混合检索（含分面） |
| `GET /api/datasets` | 数据集列表 |
| `GET /api/training` | 训练任务列表 |
| `GET /api/pipeline` | 清洗/预处理任务与规则命中 |
| `GET /api/annotations` | 标注任务队列 |
| `GET /api/tags` | 标签数量统计 |
| `GET /api/health` | 健康检查 |

## 功能页面

📊 总览看板 · 🗂️ 数据浏览筛选 · 📄 数据详情 · ⚙️ 清洗预处理 · ✏️ 标注工作台 · 💎 数据资产 · 🏷️ 标签管理 · 🔎 检索中心 · 📦 数据集 · 🚀 训练任务 · 🧩 架构流程图

## 技术栈

- **前端**：React 18 + TypeScript + Vite + React Router + ECharts + Mermaid
- **后端**：Node.js + Express（ESM，确定性种子 mock 数据，可平滑替换为真实数据源）
- **静态原型**：原生 HTML/CSS/JS + ECharts/Mermaid（CDN）
