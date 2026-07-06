/* 内存数据源：零依赖，默认使用（无需数据库即可运行） */
import {
  EPISODES, DATASETS, TRAINING_JOBS, PIPELINE_JOBS, ANNO_TASKS, CLEAN_RULES,
  STATUS_FLOW, SCENES, TASKS, ROBOTS, SOURCES, GRADES, buildStats, countBy,
} from '../data.js';

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

export const memoryRepo = {
  name: 'memory',
  async init() {},
  async stats() { return buildStats(); },
  async meta() { return { statusFlow: STATUS_FLOW, scenes: SCENES, tasks: TASKS, robots: ROBOTS, sources: SOURCES, grades: GRADES }; },
  async episodes({ scene, task, robot, source, status, grade, q, page = 1, size = 50 }) {
    let list = EPISODES.filter((e) =>
      (!scene || e.scene === scene) && (!task || e.task === task) &&
      (!robot || e.robot === robot) && (!source || e.source === source) &&
      (!status || e.status === status) && (!grade || e.quality_grade === grade) &&
      (!q || (e.task + e.object + e.episode_id).toLowerCase().includes(String(q).toLowerCase())));
    const total = list.length;
    const p = Math.max(1, +page), s = Math.max(1, +size);
    return { total, page: p, size: s, items: list.slice((p - 1) * s, p * s) };
  },
  async episode(id) {
    const e = EPISODES.find((x) => x.episode_id === id);
    return e ? withSignals(e) : null;
  },
  async search({ tags = [], q = '', semantic = true }) {
    let list = EPISODES.filter((e) => tags.every((t) => e.tags.includes(t)));
    if (q) {
      const query = q.toLowerCase();
      list = list.filter((e) =>
        (e.task + e.object + e.scene + (e.success ? '成功' : '失败')).toLowerCase().includes(query)
        || (semantic && Math.random() > 0.6));
    }
    const scored = list.map((e) => ({ ...e, relevance: +(0.7 + Math.random() * 0.3).toFixed(3) }))
      .sort((a, b) => b.relevance - a.relevance);
    const facets = {};
    ['scene', 'task', 'robot', 'source'].forEach((k) => { facets[k] = countBy(list, (e) => e[k]); });
    return { total: scored.length, items: scored.slice(0, 80), facets, engine: 'memory' };
  },
  async datasets() { return DATASETS; },
  async training() { return TRAINING_JOBS; },
  async pipeline() { return { jobs: PIPELINE_JOBS, cleanRules: CLEAN_RULES }; },
  async annotations() { return ANNO_TASKS; },
  async tags() { return { tagCount: buildStats().tagCount }; },
  async health() { return { ok: true, source: 'memory', episodes: EPISODES.length }; },
};
