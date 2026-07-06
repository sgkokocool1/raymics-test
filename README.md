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

## 演示

交互操作录屏（总览看板 → 浏览筛选 → 详情 → 清洗预处理 → 标注 → 资产 → 标签 → 检索 → 数据集 → 训练 → 架构流程图）：

https://github.com/user-attachments/assets/demo（见 PR 内嵌视频）

<video src="docs/media/demo.mp4" controls width="900"></video>

## 一键启动（Docker Compose，推荐）

一条命令拉起 **PostgreSQL + Elasticsearch + 后端 + 前端** 全栈：

```bash
docker compose up --build
```

- 前端： http://localhost:5173
- 后端 API： http://localhost:4000/api/health
- PostgreSQL： `localhost:5432`（embodied/embodied）
- Elasticsearch： http://localhost:9200

后端容器启动时会自动建表、灌数据并索引到 Elasticsearch（幂等）。停止并清理：

```bash
docker compose down -v
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
npm start                      # 内存数据源，零依赖

# 或接入真实数据库（PostgreSQL + Elasticsearch）：
export DATA_BACKEND=db
export DATABASE_URL="postgres://embodied:embodied@localhost:5432/embodied"
export ELASTICSEARCH_URL="http://localhost:9200"   # 可选，缺省则检索回退 PG
node seed.js                   # 建表 + 灌数据 + 索引 ES（幂等）
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

## 数据源架构

后端通过仓储抽象（`backend/repository/`）支持两种数据源，`DATA_BACKEND` 切换：

- `memory`（默认）：内存 mock，零依赖
- `db`：**PostgreSQL** 存元数据并用 SQL 聚合驱动看板统计；**Elasticsearch** 提供全文/分面检索（不可用时自动回退 PG）

## 技术栈

- **前端**：React 18 + TypeScript + Vite + React Router + ECharts + Mermaid
- **后端**：Node.js + Express（ESM）+ pg + @elastic/elasticsearch
- **数据库**：PostgreSQL 16 + Elasticsearch 8.15
- **部署**：Docker Compose（postgres / elasticsearch / backend / frontend 四服务）
- **静态原型**：原生 HTML/CSS/JS + ECharts/Mermaid（CDN）
