/* 建表 + 灌入 mock 数据到 PostgreSQL，并（若配置）索引到 Elasticsearch。幂等可重复执行。 */
import { query, closePool } from './db/pg.js';
import { getClient, esAvailable, ES_INDEX, resetAvailability } from './db/es.js';
import { EPISODES, DATASETS, TRAINING_JOBS, PIPELINE_JOBS, ANNO_TASKS, CLEAN_RULES } from './data.js';

async function createSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS episodes (
      episode_id TEXT PRIMARY KEY,
      project TEXT, batch TEXT, source TEXT, scene TEXT, task TEXT, object TEXT, robot TEXT,
      status TEXT, duration REAL, fps INT, frames INT, cameras INT,
      modalities TEXT[], action_dim INT, quality_score INT, quality_grade TEXT,
      success BOOLEAN, collected_by TEXT, device TEXT, collected_at DATE,
      size_gb REAL, tags TEXT[], version INT
    );
    CREATE INDEX IF NOT EXISTS idx_ep_status ON episodes(status);
    CREATE INDEX IF NOT EXISTS idx_ep_scene ON episodes(scene);
    CREATE INDEX IF NOT EXISTS idx_ep_task ON episodes(task);
    CREATE INDEX IF NOT EXISTS idx_ep_tags ON episodes USING GIN(tags);
    CREATE TABLE IF NOT EXISTS datasets (id TEXT PRIMARY KEY, data JSONB);
    CREATE TABLE IF NOT EXISTS training_jobs (id TEXT PRIMARY KEY, data JSONB);
    CREATE TABLE IF NOT EXISTS pipeline_jobs (id TEXT PRIMARY KEY, data JSONB);
    CREATE TABLE IF NOT EXISTS anno_tasks (id TEXT PRIMARY KEY, data JSONB);
    CREATE TABLE IF NOT EXISTS clean_rules (id TEXT PRIMARY KEY, data JSONB);
  `);
}

async function seedEpisodes() {
  await query('TRUNCATE episodes');
  const cols = ['episode_id', 'project', 'batch', 'source', 'scene', 'task', 'object', 'robot', 'status', 'duration', 'fps', 'frames', 'cameras', 'modalities', 'action_dim', 'quality_score', 'quality_grade', 'success', 'collected_by', 'device', 'collected_at', 'size_gb', 'tags', 'version'];
  // 分批插入
  const CHUNK = 50;
  for (let i = 0; i < EPISODES.length; i += CHUNK) {
    const batch = EPISODES.slice(i, i + CHUNK);
    const values = [];
    const params = [];
    batch.forEach((e, bi) => {
      const base = bi * cols.length;
      values.push(`(${cols.map((_, ci) => `$${base + ci + 1}`).join(',')})`);
      params.push(e.episode_id, e.project, e.batch, e.source, e.scene, e.task, e.object, e.robot, e.status,
        e.duration, e.fps, e.frames, e.cameras, e.modalities, e.action_dim, e.quality_score, e.quality_grade,
        e.success, e.collected_by, e.device, e.collected_at, e.size_gb, e.tags, e.version);
    });
    await query(`INSERT INTO episodes (${cols.join(',')}) VALUES ${values.join(',')}`, params);
  }
  console.log(`[seed] episodes: ${EPISODES.length}`);
}

async function seedRef(table, rows) {
  await query(`TRUNCATE ${table}`);
  for (const [i, r] of rows.entries()) {
    await query(`INSERT INTO ${table} (id, data) VALUES ($1, $2)`, [r.id || `${table}_${i}`, JSON.stringify(r)]);
  }
  console.log(`[seed] ${table}: ${rows.length}`);
}

async function seedES() {
  resetAvailability();
  if (!(await esAvailable())) { console.log('[seed] Elasticsearch 未配置/不可用，跳过索引（检索将回退 PostgreSQL）'); return; }
  const es = getClient();
  const exists = await es.indices.exists({ index: ES_INDEX });
  if (exists) await es.indices.delete({ index: ES_INDEX });
  await es.indices.create({
    index: ES_INDEX,
    mappings: {
      properties: {
        episode_id: { type: 'keyword' }, project: { type: 'keyword' }, batch: { type: 'keyword' },
        source: { type: 'keyword' }, scene: { type: 'keyword' }, task: { type: 'text', fields: { kw: { type: 'keyword' } } },
        object: { type: 'text' }, robot: { type: 'keyword' }, status: { type: 'keyword' },
        quality_grade: { type: 'keyword' }, quality_score: { type: 'integer' }, success: { type: 'boolean' },
        tags: { type: 'keyword' }, outcome: { type: 'text' }, collected_at: { type: 'date' },
        duration: { type: 'float' }, fps: { type: 'integer' }, frames: { type: 'integer' },
        cameras: { type: 'integer' }, modalities: { type: 'keyword' }, action_dim: { type: 'integer' },
        collected_by: { type: 'keyword' }, device: { type: 'keyword' }, size_gb: { type: 'float' }, version: { type: 'integer' },
      },
    },
  });
  const ops = EPISODES.flatMap((e) => [
    { index: { _index: ES_INDEX, _id: e.episode_id } },
    { ...e, task: e.task, outcome: e.success ? '成功' : '失败' },
  ]);
  const resp = await es.bulk({ operations: ops, refresh: true });
  if (resp.errors) console.warn('[seed] ES bulk 存在错误项');
  console.log(`[seed] elasticsearch: ${EPISODES.length} docs -> index "${ES_INDEX}"`);
}

async function main() {
  console.log('[seed] 连接 PostgreSQL 并建表…');
  await createSchema();
  await seedEpisodes();
  await seedRef('datasets', DATASETS);
  await seedRef('training_jobs', TRAINING_JOBS);
  await seedRef('pipeline_jobs', PIPELINE_JOBS.map((j) => ({ ...j, id: j.id })));
  await seedRef('anno_tasks', ANNO_TASKS);
  await seedRef('clean_rules', CLEAN_RULES.map((r, i) => ({ ...r, id: `rule_${i}` })));
  await seedES();
  await closePool();
  console.log('[seed] 完成 ✅');
}

main().catch((e) => { console.error('[seed] 失败:', e); process.exit(1); });
