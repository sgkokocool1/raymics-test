# 后端 API

Express (ESM) REST API，支持两种数据源，通过 `DATA_BACKEND` 环境变量切换：

| DATA_BACKEND | 数据源 | 说明 |
| --- | --- | --- |
| `memory`（默认） | 内存 mock | 零依赖，`npm start` 直接可用 |
| `db` | PostgreSQL (+ 可选 Elasticsearch) | 元数据/统计走 PG，检索走 ES；ES 不可用时自动回退 PG |

## 环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `PORT` | `4000` | 监听端口 |
| `DATA_BACKEND` | `memory` | `memory` / `db` |
| `DATABASE_URL` | `postgres://embodied:embodied@localhost:5432/embodied` | PostgreSQL 连接串 |
| `ELASTICSEARCH_URL` | 空 | 例：`http://localhost:9200`；不设置则检索回退 PG |

## 内存模式（零依赖）

```bash
npm install
npm start
```

## 数据库模式（PostgreSQL + Elasticsearch）

```bash
export DATA_BACKEND=db
export DATABASE_URL="postgres://embodied:embodied@localhost:5432/embodied"
export ELASTICSEARCH_URL="http://localhost:9200"   # 可选

npm install
node seed.js     # 建表 + 灌数据 + 索引到 ES（幂等）
npm start
```

`GET /api/health` 会返回当前数据源与检索引擎，例如：

```json
{ "ok": true, "source": "postgres", "episodes": 320, "search": "elasticsearch" }
```

## 架构

```
server.js  →  repository/index.js  →  repository/memory.js   (内存)
                                    └→ repository/db.js       (PG + ES)
                                          ├─ db/pg.js         (pg 连接池)
                                          └─ db/es.js         (ES 客户端 + 可用性探测)
data.js    确定性种子数据生成（memory 与 seed 共用）
seed.js    建表 / 灌 PG / 索引 ES
```

## 端点

`/api/stats` `/api/meta` `/api/episodes` `/api/episodes/:id` `/api/search` `/api/datasets` `/api/training` `/api/pipeline` `/api/annotations` `/api/tags` `/api/health`
