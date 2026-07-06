/* 具身智能数据平台 - 原型 Mock 数据 (全局变量，兼容 file:// 直接打开) */

const SCENES = ['厨房', '工厂', '商超', '客厅', '仓库', '办公室'];
const TASKS = ['抓取', '放置', '折叠衣物', '开门', '倒水', '插拔', '擦拭', '分拣'];
const OBJECTS = ['红色杯子', '衣物', '螺丝刀', '抽屉', '水瓶', '盘子', '纸箱', '开关'];
const ROBOTS = ['单臂夹爪', '双臂', '人形', '移动底盘+臂'];
const SOURCES = ['真机遥操', '无本体采集', '仿真', '第三方导入'];
const DEVICES = ['MEgo-View', 'MEgo-Gripper', 'TeleXperience', 'iPhone-Pro-Rig', 'SimEngine'];
const USERS = ['张伟', '李娜', '王强', '刘洋', '陈静', '赵磊'];
const MODALITIES = ['rgb', 'depth', 'imu', 'force', 'pose', 'audio', 'pointcloud'];
const GRADES = ['A', 'B', 'C'];

const STATUS_FLOW = [
  { key: 'uploaded', label: '已上传' },
  { key: 'scanned', label: '已入库' },
  { key: 'raw', label: '原始待处理' },
  { key: 'cleaning', label: '清洗中' },
  { key: 'preprocessed', label: '已预处理' },
  { key: 'annotating', label: '标注中' },
  { key: 'annotated', label: '已标注' },
  { key: 'asset', label: '数据资产' },
  { key: 'in_dataset', label: '已进数据集' },
  { key: 'training', label: '训练中' },
  { key: 'archived', label: '归档' },
];
const STATUS_LABEL = Object.fromEntries(STATUS_FLOW.map((s) => [s.key, s.label]));

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function pad(n, w) { return String(n).padStart(w, '0'); }

function randomModalities() {
  const base = ['rgb', 'pose'];
  MODALITIES.forEach((m) => { if (!base.includes(m) && Math.random() > 0.45) base.push(m); });
  return base;
}

function randomDate() {
  const start = new Date('2026-01-01').getTime();
  const end = new Date('2026-07-05').getTime();
  return new Date(start + Math.random() * (end - start));
}

/* 生成 episode 数据 */
const EPISODES = [];
for (let i = 1; i <= 320; i++) {
  const source = rand(SOURCES);
  const scene = rand(SCENES);
  const task = rand(TASKS);
  const obj = rand(OBJECTS);
  const robot = rand(ROBOTS);
  const score = randInt(45, 99);
  const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : 'C';
  const success = Math.random() > 0.28;
  const date = randomDate();
  // 状态按漏斗概率分布，越靠后越少
  const r = Math.random();
  let status;
  if (r < 0.12) status = 'raw';
  else if (r < 0.22) status = 'cleaning';
  else if (r < 0.34) status = 'preprocessed';
  else if (r < 0.46) status = 'annotating';
  else if (r < 0.58) status = 'annotated';
  else if (r < 0.78) status = 'asset';
  else if (r < 0.9) status = 'in_dataset';
  else if (r < 0.96) status = 'training';
  else status = 'scanned';
  if (grade === 'C' && Math.random() > 0.6) status = 'cleaning';

  const modalities = randomModalities();
  const tags = [scene, task, obj, robot, source, success ? '成功' : '失败', rand(['白天', '夜晚', '强光', '遮挡'])];

  EPISODES.push({
    episode_id: `ep_2026${pad(randInt(1, 7), 2)}${pad(randInt(1, 28), 2)}_${pad(i, 5)}`,
    project: rand(['抓取泛化', '家庭服务', '工业分拣', '柔性操作']),
    batch: `batch_${pad(randInt(1, 20), 3)}`,
    source, scene, task, object: obj, robot,
    status,
    duration: +(Math.random() * 110 + 8).toFixed(1),
    fps: rand([20, 30, 60]),
    frames: randInt(300, 3600),
    cameras: randInt(1, 4),
    modalities,
    action_dim: rand([6, 7, 12, 14]),
    quality_score: score,
    quality_grade: grade,
    success,
    collected_by: rand(USERS),
    device: rand(DEVICES),
    collected_at: date.toISOString().slice(0, 10),
    size_gb: +(Math.random() * 9 + 0.5).toFixed(2),
    tags,
    version: randInt(1, 4),
  });
}

/* 数据集 */
const DATASETS = [
  { id: 'ds_grasp_v3', name: '通用抓取 v3', episodes: 128, hours: 42.6, version: 3, format: 'LeRobot v3', splits: { train: 0.88, val: 0.08, test: 0.04 }, status: 'ready', tags: ['抓取', '多场景'] },
  { id: 'ds_fold_v1', name: '折叠衣物 v1', episodes: 64, hours: 31.2, version: 1, format: 'HDF5', splits: { train: 0.8, val: 0.1, test: 0.1 }, status: 'ready', tags: ['折叠衣物', '客厅'] },
  { id: 'ds_sort_v2', name: '工业分拣 v2', episodes: 96, hours: 55.8, version: 2, format: 'LeRobot v3', splits: { train: 0.85, val: 0.1, test: 0.05 }, status: 'building', tags: ['分拣', '工厂'] },
  { id: 'ds_home_mix', name: '家庭混合数据集', episodes: 210, hours: 88.4, version: 5, format: 'MCAP', splits: { train: 0.9, val: 0.07, test: 0.03 }, status: 'ready', tags: ['家庭服务', '厨房', '客厅'] },
];

/* 训练任务 */
const TRAINING_JOBS = [
  { id: 'job_2041', name: 'ACT-grasp-0706', dataset: 'ds_grasp_v3', policy: 'ACT', status: 'running', progress: 68, success_rate: 0.74, gpu: '8×H100' },
  { id: 'job_2038', name: 'pi0-fold-0705', dataset: 'ds_fold_v1', policy: 'π0', status: 'success', progress: 100, success_rate: 0.81, gpu: '4×A100' },
  { id: 'job_2035', name: 'smolvla-home', dataset: 'ds_home_mix', policy: 'SmolVLA', status: 'success', progress: 100, success_rate: 0.69, gpu: '8×H100' },
  { id: 'job_2030', name: 'ACT-sort-retry', dataset: 'ds_sort_v2', policy: 'ACT', status: 'failed', progress: 32, success_rate: 0, gpu: '4×A100' },
  { id: 'job_2028', name: 'pi0-grasp-base', dataset: 'ds_grasp_v3', policy: 'π0', status: 'queued', progress: 0, success_rate: 0, gpu: '8×H100' },
];

/* 处理任务(流水线) */
const PIPELINE_JOBS = [
  { id: 'scan_9001', type: '扫描入库', target: 'batch_014', status: 'success', count: 42 },
  { id: 'clean_9002', type: '清洗', target: 'batch_014', status: 'running', count: 30 },
  { id: 'pre_9003', type: '预处理', target: 'batch_013', status: 'success', count: 38 },
  { id: 'pre_9004', type: '预处理', target: 'batch_015', status: 'running', count: 12 },
  { id: 'anno_9005', type: '预标注', target: 'batch_012', status: 'success', count: 55 },
  { id: 'scan_9006', type: '扫描入库', target: 'batch_016', status: 'failed', count: 0 },
];

/* 标注任务 */
const ANNO_TASKS = [
  { id: 'at_501', episode: 'ep_20260706_00012', type: '时序分割', assignee: '李娜', status: '待质检', progress: 100 },
  { id: 'at_502', episode: 'ep_20260706_00048', type: '语言标注', assignee: '王强', status: '标注中', progress: 60 },
  { id: 'at_503', episode: 'ep_20260706_00071', type: 'bbox/keypoint', assignee: '张伟', status: '一审通过', progress: 100 },
  { id: 'at_504', episode: 'ep_20260706_00090', type: '成败标注', assignee: '陈静', status: '待分配', progress: 0 },
];

/* ---------- 聚合统计（供看板使用） ---------- */
function countBy(arr, keyFn) {
  const m = {};
  arr.forEach((x) => { const k = keyFn(x); m[k] = (m[k] || 0) + 1; });
  return m;
}

const STATS = {
  total: EPISODES.length,
  totalHours: +(EPISODES.reduce((s, e) => s + e.duration, 0) / 60).toFixed(1),
  totalSize: +(EPISODES.reduce((s, e) => s + e.size_gb, 0)).toFixed(1),
  assetCount: EPISODES.filter((e) => ['asset', 'in_dataset', 'training', 'archived'].includes(e.status)).length,
  bySource: countBy(EPISODES, (e) => e.source),
  byScene: countBy(EPISODES, (e) => e.scene),
  byTask: countBy(EPISODES, (e) => e.task),
  byRobot: countBy(EPISODES, (e) => e.robot),
  byStatus: countBy(EPISODES, (e) => e.status),
  byGrade: countBy(EPISODES, (e) => e.quality_grade),
  byUser: countBy(EPISODES, (e) => e.collected_by),
  byDevice: countBy(EPISODES, (e) => e.device),
  successCount: EPISODES.filter((e) => e.success).length,
  tagCount: countBy(EPISODES.flatMap((e) => e.tags), (t) => t),
};

/* 按日期趋势 */
const TREND = (() => {
  const m = {};
  EPISODES.forEach((e) => {
    const month = e.collected_at.slice(0, 7);
    m[month] = (m[month] || 0) + 1;
  });
  return Object.keys(m).sort().map((k) => ({ month: k, count: m[k] }));
})();

/* 漏斗（生命周期转化） */
const FUNNEL = (() => {
  const order = ['scanned', 'raw', 'cleaning', 'preprocessed', 'annotated', 'asset', 'in_dataset'];
  // 累计口径：达到或超过该阶段
  const idx = Object.fromEntries(STATUS_FLOW.map((s, i) => [s.key, i]));
  return order.map((k) => ({
    stage: STATUS_LABEL[k],
    value: EPISODES.filter((e) => idx[e.status] >= idx[k]).length,
  }));
})();
