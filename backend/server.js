import express from 'express';
import cors from 'cors';
import { getRepository } from './repository/index.js';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

const repo = await getRepository();
console.log(`[backend] 数据源: ${repo.name}`);

const wrap = (fn) => async (req, res) => {
  try { res.json(await fn(req)); }
  catch (e) { console.error(e); res.status(500).json({ error: String(e.message || e) }); }
};

app.get('/api/stats', wrap(() => repo.stats()));
app.get('/api/meta', wrap(() => repo.meta()));
app.get('/api/episodes', wrap((req) => repo.episodes(req.query)));
app.get('/api/episodes/:id', wrap(async (req) => {
  const e = await repo.episode(req.params.id);
  if (!e) throw Object.assign(new Error('not found'), { status: 404 });
  return e;
}));
app.get('/api/search', wrap((req) => repo.search({
  tags: String(req.query.tags || '').split(',').filter(Boolean),
  q: String(req.query.q || '').trim(),
  semantic: req.query.semantic !== 'false',
})));
app.get('/api/datasets', wrap(() => repo.datasets()));
app.get('/api/training', wrap(() => repo.training()));
app.get('/api/pipeline', wrap(() => repo.pipeline()));
app.get('/api/annotations', wrap(() => repo.annotations()));
app.get('/api/tags', wrap(() => repo.tags()));
app.get('/api/health', wrap(() => repo.health()));

app.listen(PORT, () => console.log(`[backend] API running on http://localhost:${PORT} (source=${repo.name})`));
