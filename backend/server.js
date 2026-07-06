import express from 'express';
import cors from 'cors';
import {
  EPISODES, DATASETS, TRAINING_JOBS, PIPELINE_JOBS, ANNO_TASKS, CLEAN_RULES,
  STATUS_FLOW, SCENES, TASKS, ROBOTS, SOURCES, GRADES, buildStats, countBy,
} from './data.js';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

/* 看板聚合统计 */
app.get('/api/stats', (_req, res) => res.json(buildStats()));

/* 枚举/筛选项 */
app.get('/api/meta', (_req, res) => res.json({
  statusFlow: STATUS_FLOW, scenes: SCENES, tasks: TASKS, robots: ROBOTS, sources: SOURCES, grades: GRADES,
}));

/* episode 列表（多维筛选 + 分页） */
app.get('/api/episodes', (req, res) => {
  const { scene, task, robot, source, status, grade, q, page = 1, size = 50 } = req.query;
  let list = EPISODES.filter((e) =>
    (!scene || e.scene === scene) && (!task || e.task === task) &&
    (!robot || e.robot === robot) && (!source || e.source === source) &&
    (!status || e.status === status) && (!grade || e.quality_grade === grade) &&
    (!q || (e.task + e.object + e.episode_id).toLowerCase().includes(String(q).toLowerCase())));
  const total = list.length;
  const p = Math.max(1, +page), s = Math.max(1, +size);
  const items = list.slice((p - 1) * s, p * s);
  res.json({ total, page: p, size: s, items });
});

/* episode 详情 */
app.get('/api/episodes/:id', (req, res) => {
  const e = EPISODES.find((x) => x.episode_id === req.params.id);
  if (!e) return res.status(404).json({ error: 'not found' });
  // 附带模拟传感器信号
  const N = 120;
  const gen = (ph) => Array.from({ length: N }, (_, i) => +(Math.sin(i / 9 + ph)).toFixed(3));
  res.json({
    ...e,
    signals: {
      joint_0: gen(0), joint_1: gen(1.5),
      gripper: Array.from({ length: N }, (_, i) => (i % 40 < 20 ? 1 : 0)),
    },
    subtasks: [
      { name: '接近', start: 0, end: 3.2 }, { name: '抓取', start: 3.2, end: 6.8 },
      { name: '移动', start: 6.8, end: 9.4 }, { name: '放置', start: 9.4, end: 12 },
    ],
  });
});

/* 混合检索：结构化(tags AND) + 全文 + 语义(模拟) */
app.get('/api/search', (req, res) => {
  const { tags = '', q = '', semantic = 'true' } = req.query;
  const tagList = String(tags).split(',').filter(Boolean);
  const query = String(q).trim().toLowerCase();
  let list = EPISODES.filter((e) => tagList.every((t) => e.tags.includes(t)));
  if (query) {
    list = list.filter((e) =>
      (e.task + e.object + e.scene + (e.success ? '成功' : '失败')).toLowerCase().includes(query)
      || (semantic === 'true' && Math.random() > 0.6));
  }
  const scored = list.map((e) => ({ ...e, relevance: +(0.7 + Math.random() * 0.3).toFixed(3) }))
    .sort((a, b) => b.relevance - a.relevance);
  const facets = {};
  ['scene', 'task', 'robot', 'source'].forEach((k) => { facets[k] = countBy(list, (e) => e[k]); });
  res.json({ total: scored.length, items: scored.slice(0, 80), facets });
});

app.get('/api/datasets', (_req, res) => res.json(DATASETS));
app.get('/api/training', (_req, res) => res.json(TRAINING_JOBS));
app.get('/api/pipeline', (_req, res) => res.json({ jobs: PIPELINE_JOBS, cleanRules: CLEAN_RULES }));
app.get('/api/annotations', (_req, res) => res.json(ANNO_TASKS));
app.get('/api/tags', (_req, res) => {
  const stats = buildStats();
  res.json({ tagCount: stats.tagCount });
});

app.get('/api/health', (_req, res) => res.json({ ok: true, episodes: EPISODES.length }));

app.listen(PORT, () => console.log(`[backend] API running on http://localhost:${PORT}`));
