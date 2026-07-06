/* 数据库数据源：PostgreSQL 存储元数据/统计，Elasticsearch 提供检索（不可用时回退 PG） */
import { query } from '../db/pg.js';
import { getClient, esAvailable, ES_INDEX } from '../db/es.js';
import { STATUS_FLOW, SCENES, TASKS, ROBOTS, SOURCES, GRADES } from '../data.js';

const STATUS_ORDER = STATUS_FLOW.map((s) => s.key);
const rowsToCount = (rows) => Object.fromEntries(rows.map((r) => [r.k, Number(r.c)]));

function withSignals(e) {
  const N = 120;
  const gen = (ph) => Array.from({ length: N }, (_, i) => +(Math.sin(i / 9 + ph)).toFixed(3));
  return {
    ...e,
    signals: { joint_0: gen(0), joint_1: gen(1.5), gripper: Array.from({ length: N }, (_, i) => (i % 40 < 20 ? 1 : 0)) },
    subtasks: [
      { name: '接近', start: 0, end: 3.2 }, { name: '抓取', start: 3.2, end: 6.8 },
      { name: '移动', start: 6.8, end: 9.4 }, { name: '放置', start: 9.4, end: 12 },
    ],
  };
}

export const dbRepo = {
  name: 'postgres',
  async init() {
    // 简单探测连接
    await query('SELECT 1');
  },

  async stats() {
    const groupBy = async (col) => rowsToCount(await query(`SELECT ${col} AS k, COUNT(*)::int AS c FROM episodes GROUP BY ${col}`));
    const [totals] = await query('SELECT COUNT(*)::int AS total, ROUND((SUM(duration)/60.0)::numeric, 1) AS total_hours, ROUND(SUM(size_gb)::numeric, 1) AS total_size, COUNT(*) FILTER (WHERE success) AS success_count, COUNT(*) FILTER (WHERE status IN (\'asset\',\'in_dataset\',\'training\',\'archived\')) AS asset_count FROM episodes');
    const [bySource, byScene, byTask, byRobot, byStatus, byGrade, byUser, byDevice] = await Promise.all([
      groupBy('source'), groupBy('scene'), groupBy('task'), groupBy('robot'),
      groupBy('status'), groupBy('quality_grade'), groupBy('collected_by'), groupBy('device'),
    ]);
    const tagRows = await query('SELECT tag AS k, COUNT(*)::int AS c FROM episodes, UNNEST(tags) AS tag GROUP BY tag');
    const trend = (await query("SELECT TO_CHAR(collected_at, 'YYYY-MM') AS month, COUNT(*)::int AS count FROM episodes GROUP BY month ORDER BY month"))
      .map((r) => ({ month: r.month, count: Number(r.count) }));
    // 漏斗：达到或超过某阶段的累计数量
    const idx = Object.fromEntries(STATUS_ORDER.map((k, i) => [k, i]));
    const funnelStages = ['scanned', 'raw', 'cleaning', 'preprocessed', 'annotated', 'asset', 'in_dataset'];
    const allStatus = await query('SELECT status, COUNT(*)::int AS c FROM episodes GROUP BY status');
    const funnel = funnelStages.map((stage) => ({
      stage: STATUS_FLOW.find((s) => s.key === stage).label,
      value: allStatus.filter((r) => idx[r.status] >= idx[stage]).reduce((a, r) => a + Number(r.c), 0),
    }));
    const flywheel = [
      { round: '第1轮', data: 80, success: 52 }, { round: '第2轮', data: 140, success: 61 },
      { round: '第3轮', data: 210, success: 69 }, { round: '第4轮', data: 280, success: 74 },
      { round: '第5轮', data: 320, success: 79 },
    ];
    return {
      total: Number(totals.total), totalHours: Number(totals.total_hours), totalSize: Number(totals.total_size),
      assetCount: Number(totals.asset_count), successCount: Number(totals.success_count),
      bySource, byScene, byTask, byRobot, byStatus, byGrade, byUser, byDevice,
      tagCount: rowsToCount(tagRows), trend, funnel, flywheel,
    };
  },

  async meta() { return { statusFlow: STATUS_FLOW, scenes: SCENES, tasks: TASKS, robots: ROBOTS, sources: SOURCES, grades: GRADES }; },

  async episodes({ scene, task, robot, source, status, grade, q, page = 1, size = 50 }) {
    const where = [];
    const params = [];
    const add = (cond, val) => { params.push(val); where.push(cond.replace('?', `$${params.length}`)); };
    if (scene) add('scene = ?', scene);
    if (task) add('task = ?', task);
    if (robot) add('robot = ?', robot);
    if (source) add('source = ?', source);
    if (status) add('status = ?', status);
    if (grade) add('quality_grade = ?', grade);
    if (q) { params.push(`%${String(q).toLowerCase()}%`); where.push(`(LOWER(task) LIKE $${params.length} OR LOWER(object) LIKE $${params.length} OR LOWER(episode_id) LIKE $${params.length})`); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [{ total }] = await query(`SELECT COUNT(*)::int AS total FROM episodes ${clause}`, params);
    const p = Math.max(1, +page), s = Math.max(1, +size);
    params.push(s, (p - 1) * s);
    const items = await query(`SELECT * FROM episodes ${clause} ORDER BY collected_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    return { total: Number(total), page: p, size: s, items };
  },

  async episode(id) {
    const rows = await query('SELECT * FROM episodes WHERE episode_id = $1', [id]);
    return rows[0] ? withSignals(rows[0]) : null;
  },

  async search({ tags = [], q = '', semantic = true }) {
    if (await esAvailable()) return this._searchES({ tags, q });
    return this._searchPG({ tags, q, semantic });
  },

  async _searchES({ tags, q }) {
    const es = getClient();
    const must = [];
    const filter = tags.map((t) => ({ term: { tags: t } }));
    if (q) must.push({ multi_match: { query: q, fields: ['task^2', 'object', 'scene', 'outcome'], fuzziness: 'AUTO' } });
    const body = {
      size: 80,
      query: { bool: { must: must.length ? must : [{ match_all: {} }], filter } },
      aggs: {
        scene: { terms: { field: 'scene', size: 10 } }, task: { terms: { field: 'task.kw', size: 10 } },
        robot: { terms: { field: 'robot', size: 10 } }, source: { terms: { field: 'source', size: 10 } },
      },
    };
    const res = await es.search({ index: ES_INDEX, ...body });
    const items = res.hits.hits.map((h) => ({ ...h._source, relevance: +(h._score ?? 1).toFixed(3) }));
    const facets = {};
    for (const k of ['scene', 'task', 'robot', 'source']) {
      facets[k] = Object.fromEntries((res.aggregations?.[k]?.buckets || []).map((b) => [b.key, b.doc_count]));
    }
    return { total: res.hits.total?.value ?? items.length, items, facets, engine: 'elasticsearch' };
  },

  async _searchPG({ tags, q, semantic }) {
    const params = [];
    const where = [];
    if (tags.length) { params.push(tags); where.push(`tags @> $${params.length}`); }
    if (q) { params.push(`%${String(q).toLowerCase()}%`); where.push(`(LOWER(task) LIKE $${params.length} OR LOWER(object) LIKE $${params.length} OR LOWER(scene) LIKE $${params.length})`); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await query(`SELECT * FROM episodes ${clause} ORDER BY quality_score DESC LIMIT 80`, params);
    const items = rows.map((e) => ({ ...e, relevance: +(0.7 + Math.random() * 0.3).toFixed(3) }));
    const facets = {};
    for (const k of ['scene', 'task', 'robot', 'source']) {
      const fr = await query(`SELECT ${k} AS key, COUNT(*)::int AS c FROM episodes ${clause} GROUP BY ${k} ORDER BY c DESC LIMIT 6`, params);
      facets[k] = Object.fromEntries(fr.map((r) => [r.key, Number(r.c)]));
    }
    const [{ total }] = await query(`SELECT COUNT(*)::int AS total FROM episodes ${clause}`, params);
    return { total: Number(total), items, facets, engine: semantic ? 'postgres(fallback)' : 'postgres' };
  },

  async datasets() { return (await query('SELECT data FROM datasets ORDER BY id')).map((r) => r.data); },
  async training() { return (await query('SELECT data FROM training_jobs ORDER BY id')).map((r) => r.data); },
  async pipeline() {
    const jobs = (await query('SELECT data FROM pipeline_jobs ORDER BY id')).map((r) => r.data);
    const cleanRules = (await query('SELECT data FROM clean_rules ORDER BY id')).map((r) => r.data);
    return { jobs, cleanRules };
  },
  async annotations() { return (await query('SELECT data FROM anno_tasks ORDER BY id')).map((r) => r.data); },
  async tags() {
    const rows = await query('SELECT tag AS k, COUNT(*)::int AS c FROM episodes, UNNEST(tags) AS tag GROUP BY tag');
    return { tagCount: rowsToCount(rows) };
  },
  async health() {
    const [{ c }] = await query('SELECT COUNT(*)::int AS c FROM episodes');
    return { ok: true, source: 'postgres', episodes: Number(c), search: (await esAvailable()) ? 'elasticsearch' : 'postgres(fallback)' };
  },
};
