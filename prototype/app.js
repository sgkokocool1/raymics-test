/* 具身智能数据平台 - 原型交互逻辑 */

const NAV = [
  { group: '概览', items: [{ id: 'dashboard', icon: '📊', label: '总览看板' }] },
  { group: '数据', items: [
    { id: 'browse', icon: '🗂️', label: '数据浏览筛选' },
    { id: 'pipeline', icon: '⚙️', label: '清洗 · 预处理' },
    { id: 'annotation', icon: '✏️', label: '标注工作台' },
    { id: 'assets', icon: '💎', label: '数据资产' },
    { id: 'tags', icon: '🏷️', label: '标签管理' },
    { id: 'search', icon: '🔎', label: '检索中心' },
  ]},
  { group: '训练', items: [
    { id: 'datasets', icon: '📦', label: '数据集' },
    { id: 'training', icon: '🚀', label: '训练任务' },
  ]},
  { group: '设计', items: [{ id: 'arch', icon: '🧩', label: '架构 · 流程图' }] },
];

const state = { page: 'dashboard', detail: null, charts: [], filters: {}, searchTags: [] };

const PALETTE = ['#4f8cff', '#37e0c8', '#f5a623', '#ff5b6a', '#a97bff', '#2ec17a', '#ff8f5a', '#5ad1ff'];

/* ---------- 通用 ---------- */
function el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
function disposeCharts() { state.charts.forEach((c) => c.dispose && c.dispose()); state.charts = []; }
function mkChart(dom, option) {
  const c = echarts.init(dom, null, { renderer: 'canvas' });
  option.textStyle = { color: '#c7d3e8' };
  option.tooltip = Object.assign({ trigger: 'item', backgroundColor: '#131c31', borderColor: '#26324f', textStyle: { color: '#e6ecf5' } }, option.tooltip || {});
  c.setOption(option);
  state.charts.push(c);
  return c;
}
function toPairs(obj) { return Object.entries(obj).sort((a, b) => b[1] - a[1]); }
function pieData(obj) { return toPairs(obj).map(([name, value]) => ({ name, value })); }

function statusBadge(s) {
  const map = { asset: 'b-ok', in_dataset: 'b-ok', training: 'b-info', archived: 'b-info',
    raw: 'b-warn', cleaning: 'b-warn', annotating: 'b-warn', scanned: 'b-warn',
    preprocessed: 'b-info', annotated: 'b-info' };
  return `<span class="badge ${map[s] || 'b-info'}">${STATUS_LABEL[s] || s}</span>`;
}
function jobBadge(s) {
  const m = { success: ['b-ok', '成功'], running: ['b-info', '运行中'], failed: ['b-err', '失败'], queued: ['b-warn', '排队'], building: ['b-warn', '构建中'], ready: ['b-ok', '就绪'] };
  const [c, t] = m[s] || ['b-info', s]; return `<span class="badge ${c}">${t}</span>`;
}

/* ---------- 导航 ---------- */
function renderNav() {
  const nav = document.getElementById('nav');
  nav.innerHTML = '';
  NAV.forEach((g, gi) => {
    if (gi > 0) nav.appendChild(el(`<div class="nav-group">${g.group}</div>`));
    g.items.forEach((it) => {
      const node = el(`<div class="nav-item ${state.page === it.id ? 'active' : ''}"><span class="ic">${it.icon}</span> ${it.label}</div>`);
      node.onclick = () => { state.page = it.id; state.detail = null; render(); };
      nav.appendChild(node);
    });
  });
}

function topbar(title, sub, extra = '') {
  return `<div class="topbar"><div><h1>${title}</h1><div class="sub">${sub}</div></div><div>${extra}</div></div>`;
}

/* ================= 页面：总览看板 ================= */
function pageDashboard(main) {
  main.innerHTML = topbar('总览看板', '原始数据分布 · 分类占比 · 标签占比 · 执行漏斗 · 训练回流',
    `<span class="pill">数据截止 2026-07-05</span>`) + `
    <div class="grid kpis" style="margin-bottom:16px">
      ${kpi('原始数据总量', STATS.total, '条', '+38 今日', 'up')}
      ${kpi('累计时长', STATS.totalHours, '小时', '+6.2h 今日', 'up')}
      ${kpi('存储总量', STATS.totalSize, 'GB', '冷热分层', '')}
      ${kpi('数据资产', STATS.assetCount, '条', `资产化率 ${(STATS.assetCount / STATS.total * 100).toFixed(0)}%`, 'up')}
      ${kpi('采集成功率', (STATS.successCount / STATS.total * 100).toFixed(0), '%', '成功/失败标签', '')}
    </div>
    <div class="grid cols-2" style="margin-bottom:16px">
      <div class="card"><h3>原始数据分布 · 月度采集趋势</h3><div id="c_trend" class="chart"></div></div>
      <div class="card"><h3>原始数据分布 · 来源占比</h3><div id="c_source" class="chart"></div></div>
    </div>
    <div class="grid cols-3" style="margin-bottom:16px">
      <div class="card"><h3>分类占比 · 场景</h3><div id="c_scene" class="chart sm"></div></div>
      <div class="card"><h3>分类占比 · 任务类型</h3><div id="c_task" class="chart sm"></div></div>
      <div class="card"><h3>分类占比 · 机器人形态</h3><div id="c_robot" class="chart sm"></div></div>
    </div>
    <div class="grid cols-2" style="margin-bottom:16px">
      <div class="card"><h3>标签分类占比 · Top 标签</h3><div id="c_tags" class="chart"></div></div>
      <div class="card"><h3>执行情况 · 生命周期转化漏斗</h3><div id="c_funnel" class="chart"></div></div>
    </div>
    <div class="grid cols-3">
      <div class="card"><h3>执行情况 · 质量分等级</h3><div id="c_grade" class="chart sm"></div></div>
      <div class="card"><h3>执行情况 · 各状态数量</h3><div id="c_status" class="chart sm"></div></div>
      <div class="card"><h3>训练回流 · 数据集成功率</h3><div id="c_train" class="chart sm"></div></div>
    </div>`;

  mkChart(document.getElementById('c_trend'), {
    tooltip: { trigger: 'axis' }, grid: { left: 40, right: 20, top: 20, bottom: 30 },
    xAxis: { type: 'category', data: TREND.map((t) => t.month), axisLine: { lineStyle: { color: '#26324f' } } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#1a2540' } } },
    series: [{ type: 'bar', data: TREND.map((t) => t.count), itemStyle: { color: '#4f8cff', borderRadius: [5, 5, 0, 0] }, barWidth: '48%' },
             { type: 'line', smooth: true, data: TREND.map((t) => t.count), itemStyle: { color: '#37e0c8' }, lineStyle: { width: 3 } }],
  });
  mkChart(document.getElementById('c_source'), donut(pieData(STATS.bySource)));
  mkChart(document.getElementById('c_scene'), donut(pieData(STATS.byScene)));
  mkChart(document.getElementById('c_task'), barH(toPairs(STATS.byTask)));
  mkChart(document.getElementById('c_robot'), donut(pieData(STATS.byRobot)));
  mkChart(document.getElementById('c_tags'), barH(toPairs(STATS.tagCount).slice(0, 12)));
  mkChart(document.getElementById('c_funnel'), {
    tooltip: { trigger: 'item' },
    series: [{ type: 'funnel', left: 20, right: 20, top: 10, bottom: 10, minSize: '30%', label: { color: '#e6ecf5', formatter: '{b}: {c}' },
      data: FUNNEL.map((f, i) => ({ name: f.stage, value: f.value, itemStyle: { color: PALETTE[i % PALETTE.length] } })) }],
  });
  mkChart(document.getElementById('c_grade'), donut(pieData(STATS.byGrade), ['#2ec17a', '#f5a623', '#ff5b6a']));
  mkChart(document.getElementById('c_status'), barH(toPairs(STATS.byStatus).map(([k, v]) => [STATUS_LABEL[k] || k, v])));
  mkChart(document.getElementById('c_train'), {
    tooltip: { trigger: 'axis' }, grid: { left: 90, right: 30, top: 20, bottom: 30 },
    xAxis: { type: 'value', max: 1, splitLine: { lineStyle: { color: '#1a2540' } } },
    yAxis: { type: 'category', data: DATASETS.map((d) => d.name) },
    series: [{ type: 'bar', data: DATASETS.map((d, i) => ({ value: +(0.6 + Math.random() * 0.3).toFixed(2), itemStyle: { color: PALETTE[i % PALETTE.length], borderRadius: [0, 5, 5, 0] } })), barWidth: '50%', label: { show: true, position: 'right', color: '#c7d3e8', formatter: (p) => (p.value * 100).toFixed(0) + '%' } }],
  });
}
function kpi(title, val, unit, delta, dir) {
  return `<div class="card kpi"><h3>${title}</h3><div class="val">${val}<span>${unit}</span></div><div class="delta ${dir}">${delta}</div></div>`;
}
function donut(data, colors) {
  return { color: colors || PALETTE, legend: { bottom: 0, textStyle: { color: '#8aa0c6' }, type: 'scroll' },
    series: [{ type: 'pie', radius: ['42%', '68%'], center: ['50%', '44%'], avoidLabelOverlap: true, itemStyle: { borderColor: '#131c31', borderWidth: 2 }, label: { color: '#c7d3e8', formatter: '{b}\n{d}%' }, data }] };
}
function barH(pairs) {
  return { grid: { left: 90, right: 24, top: 10, bottom: 20 }, tooltip: { trigger: 'axis' },
    xAxis: { type: 'value', splitLine: { lineStyle: { color: '#1a2540' } } },
    yAxis: { type: 'category', data: pairs.map((p) => p[0]).reverse() },
    series: [{ type: 'bar', data: pairs.map((p) => p[1]).reverse(), itemStyle: { color: '#4f8cff', borderRadius: [0, 5, 5, 0] }, barWidth: '55%' }] };
}

/* ================= 页面：数据浏览筛选 ================= */
function pageBrowse(main) {
  const f = state.filters;
  const opts = (arr, cur) => ['<option value="">全部</option>'].concat(arr.map((x) => `<option ${cur === x ? 'selected' : ''}>${x}</option>`)).join('');
  main.innerHTML = topbar('数据浏览 · 筛选', '基于元数据库的多维组合筛选（元数据驱动，原始大文件懒加载）') + `
    <div class="filters">
      <select id="f_scene">${opts(SCENES, f.scene)}</select>
      <select id="f_task">${opts(TASKS, f.task)}</select>
      <select id="f_robot">${opts(ROBOTS, f.robot)}</select>
      <select id="f_source">${opts(SOURCES, f.source)}</select>
      <select id="f_status">${['<option value="">全部状态</option>'].concat(STATUS_FLOW.map((s) => `<option value="${s.key}" ${f.status === s.key ? 'selected' : ''}>${s.label}</option>`)).join('')}</select>
      <select id="f_grade">${opts(GRADES, f.grade)}</select>
      <input id="f_q" placeholder="搜索任务/物体/ID..." value="${f.q || ''}" style="min-width:200px" />
      <button class="btn" id="f_apply">筛选</button>
      <button class="btn ghost" id="f_reset">重置</button>
    </div>
    <div id="browse_result"></div>`;

  const apply = () => {
    state.filters = {
      scene: document.getElementById('f_scene').value, task: document.getElementById('f_task').value,
      robot: document.getElementById('f_robot').value, source: document.getElementById('f_source').value,
      status: document.getElementById('f_status').value, grade: document.getElementById('f_grade').value,
      q: document.getElementById('f_q').value.trim(),
    };
    renderBrowseResult();
  };
  document.getElementById('f_apply').onclick = apply;
  document.getElementById('f_q').onkeydown = (e) => { if (e.key === 'Enter') apply(); };
  document.getElementById('f_reset').onclick = () => { state.filters = {}; render(); };
  renderBrowseResult();
}
function filteredEpisodes() {
  const f = state.filters;
  return EPISODES.filter((e) =>
    (!f.scene || e.scene === f.scene) && (!f.task || e.task === f.task) &&
    (!f.robot || e.robot === f.robot) && (!f.source || e.source === f.source) &&
    (!f.status || e.status === f.status) && (!f.grade || e.quality_grade === f.grade) &&
    (!f.q || (e.task + e.object + e.episode_id).toLowerCase().includes(f.q.toLowerCase())));
}
function renderBrowseResult() {
  const list = filteredEpisodes();
  const wrap = document.getElementById('browse_result');
  wrap.innerHTML = `<div style="color:var(--muted);font-size:13px;margin-bottom:10px">共 <b style="color:#fff">${list.length}</b> 条结果</div>
    <div class="card" style="padding:0"><div class="tbl-wrap"><table>
      <thead><tr><th>Episode ID</th><th>场景</th><th>任务</th><th>机器人</th><th>来源</th><th>时长(s)</th><th>模态</th><th>质量</th><th>状态</th><th>采集人</th><th>日期</th></tr></thead>
      <tbody>${list.slice(0, 120).map(rowEp).join('')}</tbody></table></div></div>`;
  wrap.querySelectorAll('tr[data-id]').forEach((tr) => { tr.onclick = () => { state.detail = tr.dataset.id; render(); }; });
}
function rowEp(e) {
  return `<tr data-id="${e.episode_id}">
    <td class="link">${e.episode_id}</td><td>${e.scene}</td><td>${e.task}</td><td>${e.robot}</td><td>${e.source}</td>
    <td>${e.duration}</td><td>${e.modalities.length} 路</td>
    <td class="grade-${e.quality_grade}">${e.quality_grade} · ${e.quality_score}</td>
    <td>${statusBadge(e.status)}</td><td>${e.collected_by}</td><td>${e.collected_at}</td></tr>`;
}

/* ================= 页面：数据详情 ================= */
function pageDetail(main, id) {
  const e = EPISODES.find((x) => x.episode_id === id);
  if (!e) { state.detail = null; return render(); }
  const flowIdx = STATUS_FLOW.findIndex((s) => s.key === e.status);
  const steps = STATUS_FLOW.map((s, i) => `<div class="step ${i < flowIdx ? 'done' : i === flowIdx ? 'cur' : ''}">${i < flowIdx ? '✓ ' : i === flowIdx ? '● ' : ''}${s.label}</div>`).join('');
  const back = el(`<button class="btn ghost">← 返回列表</button>`); back.onclick = () => { state.detail = null; render(); };
  main.innerHTML = topbar(`数据详情 · ${e.episode_id}`, `${e.project} / ${e.batch}`);
  main.querySelector('.topbar > div:last-child').appendChild(back);
  main.appendChild(el(`
    <div class="card" style="margin-bottom:16px"><h3>生命周期状态</h3><div class="steps">${steps}</div></div>
    <div class="grid cols-2">
      <div class="card"><h3>多路相机同步回放（占位）</h3>
        <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px">
          ${Array.from({ length: e.cameras }).map((_, i) => `<div class="cam"><div class="play">▶</div><div style="position:absolute;bottom:6px;left:8px">cam_${i}</div></div>`).join('')}
        </div>
        <div id="c_signal" class="chart sm" style="margin-top:12px"></div>
      </div>
      <div class="card"><h3>元数据</h3>
        ${metaRow('状态', statusBadge(e.status))}
        ${metaRow('来源', e.source)} ${metaRow('机器人形态', e.robot)}
        ${metaRow('场景 / 任务', e.scene + ' / ' + e.task)} ${metaRow('目标物体', e.object)}
        ${metaRow('时长 / 帧数', e.duration + 's / ' + e.frames)} ${metaRow('FPS / 相机', e.fps + ' / ' + e.cameras + '路')}
        ${metaRow('模态', e.modalities.join(', '))} ${metaRow('动作维度', e.action_dim)}
        ${metaRow('质量分', `<span class="grade-${e.quality_grade}">${e.quality_grade} · ${e.quality_score}</span>`)}
        ${metaRow('采集人 / 设备', e.collected_by + ' / ' + e.device)} ${metaRow('采集日期', e.collected_at)}
        ${metaRow('大小 / 版本', e.size_gb + ' GB / v' + e.version)}
        <div style="margin-top:12px"><h3>标签</h3>${e.tags.map((t) => `<span class="chip on">${t}</span>`).join('')}</div>
      </div>
    </div>`));
  // 传感器曲线（模拟关节/动作信号）
  const N = 120; const xs = Array.from({ length: N }, (_, i) => i);
  const gen = (ph) => xs.map((i) => +(Math.sin(i / 9 + ph) * (0.6 + Math.random() * 0.15)).toFixed(2));
  mkChart(document.getElementById('c_signal'), {
    tooltip: { trigger: 'axis' }, legend: { data: ['joint_0', 'joint_1', 'gripper'], textStyle: { color: '#8aa0c6' }, top: 0 },
    grid: { left: 34, right: 16, top: 30, bottom: 24 },
    xAxis: { type: 'category', data: xs, axisLabel: { show: false } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#1a2540' } } },
    series: [
      { name: 'joint_0', type: 'line', showSymbol: false, smooth: true, data: gen(0), lineStyle: { color: '#4f8cff' } },
      { name: 'joint_1', type: 'line', showSymbol: false, smooth: true, data: gen(1.5), lineStyle: { color: '#37e0c8' } },
      { name: 'gripper', type: 'line', showSymbol: false, step: 'middle', data: xs.map((i) => (i % 40 < 20 ? 1 : 0)), lineStyle: { color: '#f5a623' } },
    ],
  });
}
function metaRow(k, v) { return `<div class="meta-row"><span class="k">${k}</span><span>${v}</span></div>`; }

/* ================= 页面：清洗 · 预处理 ================= */
function pagePipeline(main) {
  main.innerHTML = topbar('清洗 · 预处理流水线', '自动清洗规则 + 质量评分 + 时空对齐 + 6D 轨迹重建 + 标准化转换') + `
    <div class="grid cols-3" style="margin-bottom:16px">
      ${kpi('清洗队列', STATS.byStatus.cleaning || 0, '条', '自动+人工复核', '')}
      ${kpi('预处理完成', STATS.byStatus.preprocessed || 0, '条', '已标准化', 'up')}
      ${kpi('隔离(低质)', EPISODES.filter((e) => e.quality_grade === 'C').length, '条', 'C 级样本', 'down')}
    </div>
    <div class="grid cols-2" style="margin-bottom:16px">
      <div class="card"><h3>处理任务执行情况</h3><div class="tbl-wrap"><table>
        <thead><tr><th>任务ID</th><th>类型</th><th>目标批次</th><th>处理量</th><th>状态</th></tr></thead>
        <tbody>${PIPELINE_JOBS.map((j) => `<tr><td>${j.id}</td><td>${j.type}</td><td>${j.target}</td><td>${j.count}</td><td>${jobBadge(j.status)}</td></tr>`).join('')}</tbody>
      </table></div></div>
      <div class="card"><h3>清洗规则命中分布</h3><div id="c_clean" class="chart"></div></div>
    </div>
    <div class="card"><h3>预处理步骤</h3><div class="steps">
      ${['多源时空对齐', '重采样(亚毫秒)', '6D 轨迹重建', '坐标系统一', '分辨率/帧率归一', '动作/状态归一化', 'LeRobot v3 转换'].map((s) => `<div class="step done">✓ ${s}</div>`).join('')}
    </div></div>`;
  mkChart(document.getElementById('c_clean'), barH([['丢帧超阈', 42], ['时间戳错乱', 18], ['时长过短', 27], ['传感器缺失', 12], ['近重复', 9], ['力/位姿突变', 15]]));
}

/* ================= 页面：标注工作台 ================= */
function pageAnnotation(main) {
  main.innerHTML = topbar('标注工作台', 'AI 预标注 + 人工质检 · 时序分割 / 语言 / bbox / keypoint / 成败') + `
    <div class="grid cols-2" style="margin-bottom:16px">
      <div class="card"><h3>标注画布（占位）</h3>
        <div class="cam" style="height:230px"><div class="play">▶</div>
          <div style="position:absolute;top:40px;left:60px;width:120px;height:80px;border:2px solid #37e0c8;border-radius:6px"></div>
          <div style="position:absolute;top:34px;left:60px;background:#37e0c8;color:#04121; color:#04212c;font-size:11px;padding:1px 6px;border-radius:4px">红色杯子 0.96</div>
          <div style="position:absolute;bottom:8px;left:8px;color:#8aa0c6;font-size:12px">拖拽绘制 bbox / keypoint，AI 预标注结果可修正</div>
        </div>
        <div style="margin-top:12px"><h3>子任务时序分割</h3>
          <div class="steps">
            <div class="step done">0.0-3.2s 接近</div><div class="step done">3.2-6.8s 抓取</div>
            <div class="step cur">6.8-9.4s 移动</div><div class="step">9.4-12s 放置</div>
          </div>
        </div>
      </div>
      <div class="card"><h3>标注任务队列</h3><div class="tbl-wrap"><table>
        <thead><tr><th>任务</th><th>Episode</th><th>类型</th><th>标注人</th><th>进度</th><th>状态</th></tr></thead>
        <tbody>${ANNO_TASKS.map((a) => `<tr><td>${a.id}</td><td>${a.episode}</td><td>${a.type}</td><td>${a.assignee}</td>
          <td style="min-width:90px"><div class="progress"><div style="width:${a.progress}%"></div></div></td>
          <td><span class="badge b-info">${a.status}</span></td></tr>`).join('')}</tbody>
      </table></div>
      <h3 style="margin-top:16px">标注工作流</h3>
      <div class="steps"><div class="step done">✓ AI 预标注</div><div class="step done">✓ 人工修正</div><div class="step cur">● 一审</div><div class="step">二审/质检</div><div class="step">通过/驳回</div></div>
      </div>
    </div>`;
}

/* ================= 页面：数据资产 ================= */
function pageAssets(main) {
  const assets = EPISODES.filter((e) => ['asset', 'in_dataset', 'training', 'archived'].includes(e.status));
  main.innerHTML = topbar('数据资产', '通过清洗/预处理/标注/质检的可用资产 · 不可变 · 版本化 · 可复用',
    `<span class="pill">共 ${assets.length} 项资产</span>`) + `
    <div class="grid cols-3" style="margin-bottom:16px">
      ${kpi('资产总数', assets.length, '项', '', '')}
      ${kpi('A 级资产', assets.filter((e) => e.quality_grade === 'A').length, '项', '高质量', 'up')}
      ${kpi('已进数据集', STATS.byStatus.in_dataset || 0, '项', '被复用', 'up')}
    </div>
    <div class="card" style="padding:0"><div class="tbl-wrap"><table>
      <thead><tr><th>资产ID</th><th>版本</th><th>任务</th><th>场景</th><th>质量</th><th>标注</th><th>状态</th><th>标签</th></tr></thead>
      <tbody>${assets.slice(0, 100).map((e) => `<tr data-id="${e.episode_id}"><td class="link">${e.episode_id}</td><td>v${e.version}</td><td>${e.task}</td><td>${e.scene}</td>
        <td class="grade-${e.quality_grade}">${e.quality_grade}</td><td><span class="badge b-ok">已标注</span></td><td>${statusBadge(e.status)}</td>
        <td>${e.tags.slice(0, 3).map((t) => `<span class="chip">${t}</span>`).join('')}</td></tr>`).join('')}</tbody>
    </table></div></div>`;
  main.querySelectorAll('tr[data-id]').forEach((tr) => { tr.onclick = () => { state.detail = tr.dataset.id; render(); }; });
}

/* ================= 页面：标签管理 ================= */
function pageTags(main) {
  const dims = {
    '场景': SCENES, '任务': TASKS, '物体': OBJECTS, '机器人形态': ROBOTS,
    '采集范式': SOURCES, '质量/成败': ['A', 'B', 'C', '成功', '失败'], '环境': ['白天', '夜晚', '强光', '遮挡'],
  };
  main.innerHTML = topbar('标签管理', '多维层级标签体系 + 自由标签 · 人工/规则/模型自动打标') + `
    <div class="grid cols-2" style="margin-bottom:16px">
      <div class="card"><h3>标签维度体系</h3>
        ${Object.entries(dims).map(([d, arr]) => `<div style="margin-bottom:12px"><div style="color:var(--muted);font-size:12px;margin-bottom:6px">${d}</div>${arr.map((t) => `<span class="chip">${t} <b style="color:#fff">${STATS.tagCount[t] || 0}</b></span>`).join('')}</div>`).join('')}
      </div>
      <div class="card"><h3>标签数量分布（Treemap）</h3><div id="c_tree" class="chart" style="height:420px"></div></div>
    </div>
    <div class="card"><h3>标签覆盖率</h3><div id="c_cover" class="chart sm"></div></div>`;
  mkChart(document.getElementById('c_tree'), {
    tooltip: {}, series: [{ type: 'treemap', roam: false, breadcrumb: { show: false }, label: { color: '#fff' },
      levels: [{ itemStyle: { borderColor: '#131c31', borderWidth: 2, gapWidth: 2 } }],
      data: toPairs(STATS.tagCount).map(([name, value], i) => ({ name, value, itemStyle: { color: PALETTE[i % PALETTE.length] } })) }],
  });
  const tagged = EPISODES.filter((e) => e.tags.length >= 4).length;
  mkChart(document.getElementById('c_cover'), donut([{ name: '已充分打标', value: tagged }, { name: '待补标', value: EPISODES.length - tagged }], ['#2ec17a', '#26324f']));
}

/* ================= 页面：检索中心 ================= */
function pageSearch(main) {
  const allTags = toPairs(STATS.tagCount).map((p) => p[0]);
  main.innerHTML = topbar('检索中心', '结构化过滤 + 全文 + 语义（向量）混合检索 · 分面下钻 · 相似检索') + `
    <div class="card" style="margin-bottom:16px">
      <div class="filters">
        <input id="s_q" placeholder='自然语言，如 "抓取失败案例"' style="min-width:280px" />
        <label style="color:var(--muted);font-size:13px"><input type="checkbox" id="s_sem" checked style="vertical-align:middle"> 启用语义检索</label>
        <button class="btn" id="s_go">检索</button>
      </div>
      <div style="color:var(--muted);font-size:12px;margin:6px 0">点选标签进行结构化过滤（AND）：</div>
      <div id="s_tags">${allTags.slice(0, 24).map((t) => `<span class="chip" data-t="${t}">${t}</span>`).join('')}</div>
    </div>
    <div class="grid" style="grid-template-columns:220px 1fr;gap:16px">
      <div id="s_facets"></div>
      <div id="s_results"></div>
    </div>`;
  const doSearch = () => {
    const q = document.getElementById('s_q').value.trim().toLowerCase();
    let list = EPISODES.filter((e) => state.searchTags.every((t) => e.tags.includes(t)));
    if (q) list = list.filter((e) => (e.task + e.object + e.scene + (e.success ? '成功' : '失败')).toLowerCase().includes(q) || Math.random() > 0.6);
    renderSearchResults(list);
  };
  document.getElementById('s_go').onclick = doSearch;
  document.getElementById('s_q').onkeydown = (e) => { if (e.key === 'Enter') doSearch(); };
  document.querySelectorAll('#s_tags .chip').forEach((c) => {
    if (state.searchTags.includes(c.dataset.t)) c.classList.add('on');
    c.onclick = () => {
      const t = c.dataset.t;
      if (state.searchTags.includes(t)) state.searchTags = state.searchTags.filter((x) => x !== t);
      else state.searchTags.push(t);
      c.classList.toggle('on'); doSearch();
    };
  });
  doSearch();
}
function renderSearchResults(list) {
  const facetDims = { 场景: 'scene', 任务: 'task', 机器人: 'robot', 来源: 'source' };
  const fc = document.getElementById('s_facets');
  fc.innerHTML = Object.entries(facetDims).map(([label, key]) => {
    const c = {}; list.forEach((e) => { c[e[key]] = (c[e[key]] || 0) + 1; });
    return `<div class="facet" style="margin-bottom:12px"><h4>${label}</h4>${toPairs(c).slice(0, 6).map(([k, v]) => `<div class="f"><span>${k}</span><span style="color:var(--brand)">${v}</span></div>`).join('')}</div>`;
  }).join('');
  const res = document.getElementById('s_results');
  res.innerHTML = `<div style="color:var(--muted);font-size:13px;margin-bottom:10px">命中 <b style="color:#fff">${list.length}</b> 条 · 混合检索已重排序</div>
    <div class="card" style="padding:0"><div class="tbl-wrap"><table>
      <thead><tr><th>Episode</th><th>相关度</th><th>任务</th><th>场景</th><th>成败</th><th>质量</th><th>标签</th></tr></thead>
      <tbody>${list.slice(0, 60).map((e) => `<tr data-id="${e.episode_id}"><td class="link">${e.episode_id}</td>
        <td>${(0.7 + Math.random() * 0.3).toFixed(3)}</td><td>${e.task}</td><td>${e.scene}</td>
        <td>${e.success ? '<span class="badge b-ok">成功</span>' : '<span class="badge b-err">失败</span>'}</td>
        <td class="grade-${e.quality_grade}">${e.quality_grade}</td>
        <td>${e.tags.slice(0, 3).map((t) => `<span class="chip">${t}</span>`).join('')}</td></tr>`).join('')}</tbody>
    </table></div></div>`;
  res.querySelectorAll('tr[data-id]').forEach((tr) => { tr.onclick = () => { state.detail = tr.dataset.id; render(); }; });
}

/* ================= 页面：数据集 ================= */
function pageDatasets(main) {
  main.innerHTML = topbar('数据集', '圈选资产 → 版本化 → train/val/test 切分 → 多格式导出（LeRobot/HDF5/MCAP）') + `
    <div class="grid cols-2">
      ${DATASETS.map((d) => `<div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center"><h3 style="color:#fff;font-size:15px">${d.name} <span style="color:var(--muted);font-size:12px">v${d.version}</span></h3>${jobBadge(d.status)}</div>
        <div style="display:flex;gap:20px;margin:12px 0;font-size:13px">
          <div><div style="color:var(--muted);font-size:11px">Episodes</div><b>${d.episodes}</b></div>
          <div><div style="color:var(--muted);font-size:11px">时长</div><b>${d.hours}h</b></div>
          <div><div style="color:var(--muted);font-size:11px">格式</div><b>${d.format}</b></div>
        </div>
        <div style="color:var(--muted);font-size:12px;margin-bottom:6px">train ${d.splits.train} / val ${d.splits.val} / test ${d.splits.test}</div>
        <div class="progress"><div style="width:${d.splits.train * 100}%"></div></div>
        <div style="margin-top:10px">${d.tags.map((t) => `<span class="chip">${t}</span>`).join('')}</div>
        <div style="margin-top:12px"><button class="btn ghost">导出 ${d.format}</button></div>
      </div>`).join('')}
    </div>`;
}

/* ================= 页面：训练任务 ================= */
function pageTraining(main) {
  main.innerHTML = topbar('训练任务', '数据集热加载 / 流式读取 · 指标回流形成数据飞轮') + `
    <div class="card" style="padding:0;margin-bottom:16px"><div class="tbl-wrap"><table>
      <thead><tr><th>任务</th><th>数据集</th><th>策略</th><th>算力</th><th>进度</th><th>成功率</th><th>状态</th></tr></thead>
      <tbody>${TRAINING_JOBS.map((j) => `<tr><td>${j.name}</td><td>${j.dataset}</td><td>${j.policy}</td><td>${j.gpu}</td>
        <td style="min-width:120px"><div class="progress"><div style="width:${j.progress}%"></div></div></td>
        <td>${j.status === 'success' || j.status === 'running' ? (j.success_rate * 100).toFixed(0) + '%' : '—'}</td>
        <td>${jobBadge(j.status)}</td></tr>`).join('')}</tbody>
    </table></div></div>
    <div class="grid cols-2">
      <div class="card"><h3>训练任务状态分布</h3><div id="c_jobs" class="chart"></div></div>
      <div class="card"><h3>数据飞轮 · 指标回流</h3><div id="c_flywheel" class="chart"></div></div>
    </div>`;
  const jc = {}; TRAINING_JOBS.forEach((j) => { jc[j.status] = (jc[j.status] || 0) + 1; });
  mkChart(document.getElementById('c_jobs'), donut(pieData(jc), ['#2ec17a', '#4f8cff', '#ff5b6a', '#f5a623']));
  mkChart(document.getElementById('c_flywheel'), {
    tooltip: { trigger: 'axis' }, legend: { data: ['数据量(条)', '模型成功率(%)'], textStyle: { color: '#8aa0c6' }, top: 0 },
    grid: { left: 44, right: 44, top: 34, bottom: 30 },
    xAxis: { type: 'category', data: ['第1轮', '第2轮', '第3轮', '第4轮', '第5轮'] },
    yAxis: [{ type: 'value', name: '数据量', splitLine: { lineStyle: { color: '#1a2540' } } }, { type: 'value', name: '成功率', max: 100 }],
    series: [
      { name: '数据量(条)', type: 'bar', data: [80, 140, 210, 280, 320], itemStyle: { color: '#4f8cff', borderRadius: [5, 5, 0, 0] }, barWidth: '45%' },
      { name: '模型成功率(%)', type: 'line', yAxisIndex: 1, smooth: true, data: [52, 61, 69, 74, 79], lineStyle: { color: '#37e0c8', width: 3 }, itemStyle: { color: '#37e0c8' } },
    ],
  });
}

/* ================= 页面：架构 · 流程图 ================= */
function pageArch(main) {
  main.innerHTML = topbar('架构 · 流程图', '平台分层架构 / 全生命周期流程 / 状态机 / 数据模型 / 检索链路') + `
    <div class="card" style="margin-bottom:16px"><h3>全生命周期数据流转</h3><div class="mermaid" id="m1">${MERMAID.flow}</div></div>
    <div class="grid cols-2" style="margin-bottom:16px">
      <div class="card"><h3>生命周期状态机</h3><div class="mermaid" id="m2">${MERMAID.state}</div></div>
      <div class="card"><h3>混合检索链路</h3><div class="mermaid" id="m3">${MERMAID.search}</div></div>
    </div>
    <div class="card" style="margin-bottom:16px"><h3>平台分层架构</h3><div class="mermaid" id="m4">${MERMAID.arch}</div></div>
    <div class="card"><h3>数据模型 (ER)</h3><div class="mermaid" id="m5">${MERMAID.er}</div></div>`;
  try {
    mermaid.initialize({ startOnLoad: false, theme: 'default', flowchart: { curve: 'basis' } });
    mermaid.run({ nodes: main.querySelectorAll('.mermaid') });
  } catch (err) { console.warn('mermaid render failed', err); }
}

const MERMAID = {
  flow: `flowchart LR
  C["原始采集"] --> U["上传存储"] --> S["扫描入库"] --> B["展示筛选"] --> CL["清洗"]
  CL --> PP["预处理"] --> AN["标注"] --> AS["数据资产"] --> TG["打标签"] --> DS["数据集"] --> TR["训练"]
  TR -. 指标回流(飞轮) .-> C
  CL -. 低质隔离 .-> Q["隔离"]
  AN -. 驳回 .-> R["废弃"]`,
  state: `stateDiagram-v2
  [*] --> uploaded
  uploaded --> scanned --> raw --> cleaning
  cleaning --> preprocessed
  cleaning --> quarantined: 低质
  preprocessed --> annotating --> annotated
  annotating --> rejected: 驳回
  annotated --> asset --> in_dataset --> training --> archived --> [*]`,
  search: `flowchart LR
  Q[查询] --> R{路由}
  R -->|结构化/全文| ES[(ES 倒排/分面)]
  R -->|语义| VEC[(向量库)]
  ES --> M[融合重排] --> L[命中列表]
  VEC --> M
  M --> F[分面下钻]`,
  arch: `flowchart TB
  L0["采集端: 真机/无本体/仿真/导入"] --> L1["存储底座: 对象存储 + 热缓存"]
  L1 --> L2["数据湖: Iceberg/Paimon + Parquet"]
  L2 --> L3["元数据/索引: PG + ES + 向量库 + 图库"]
  L3 --> L4["计算处理: Spark/Ray/Flink + 质检/6D/预标注"]
  L4 --> L5["服务层: 入库/元数据/标注/检索/统计/训练编排"]
  L5 --> L6["应用层: 看板/浏览/标注/资产/数据集/检索"]`,
  er: `erDiagram
  Project ||--o{ Batch : has
  Batch ||--o{ Episode : contains
  Episode ||--o{ Annotation : has
  Episode ||--o{ QualityReport : has
  Episode ||--o{ AssetVersion : versions
  Episode }o--o{ Tag : tagged
  Dataset }o--o{ AssetVersion : includes
  TrainingJob }o--|| Dataset : uses`,
};

/* ---------- 主渲染 ---------- */
const PAGES = {
  dashboard: pageDashboard, browse: pageBrowse, pipeline: pagePipeline, annotation: pageAnnotation,
  assets: pageAssets, tags: pageTags, search: pageSearch, datasets: pageDatasets, training: pageTraining, arch: pageArch,
};
function render() {
  disposeCharts();
  renderNav();
  const main = document.getElementById('main');
  main.innerHTML = '';
  if (state.detail) { pageDetail(main, state.detail); return; }
  (PAGES[state.page] || pageDashboard)(main);
}
window.addEventListener('resize', () => state.charts.forEach((c) => c.resize()));
render();
