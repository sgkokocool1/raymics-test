import { api, STATUS_LABEL } from '../api';
import { useApi } from '../useApi';
import { TopBar, Kpi, Loading } from '../components/ui';
import { Chart, PALETTE, barH, donut, pieData, toPairs } from '../components/Chart';

export default function Dashboard() {
  const { data: s, loading } = useApi(() => api.stats(), []);
  if (loading || !s) return <Loading />;

  return (
    <>
      <TopBar title="总览看板" sub="原始数据分布 · 分类占比 · 标签占比 · 执行漏斗 · 训练回流"
        extra={<span className="pill">数据截止 2026-07-05</span>} />

      <div className="grid kpis" style={{ marginBottom: 16 }}>
        <Kpi title="原始数据总量" val={s.total} unit="条" delta="+38 今日" dir="up" />
        <Kpi title="累计时长" val={s.totalHours} unit="小时" delta="+6.2h 今日" dir="up" />
        <Kpi title="存储总量" val={s.totalSize} unit="GB" delta="冷热分层" />
        <Kpi title="数据资产" val={s.assetCount} unit="条" delta={`资产化率 ${(s.assetCount / s.total * 100).toFixed(0)}%`} dir="up" />
        <Kpi title="采集成功率" val={(s.successCount / s.total * 100).toFixed(0)} unit="%" delta="成功/失败标签" />
      </div>

      <div className="grid cols-2" style={{ marginBottom: 16 }}>
        <div className="card"><h3>原始数据分布 · 月度采集趋势</h3>
          <Chart option={{
            tooltip: { trigger: 'axis' }, grid: { left: 40, right: 20, top: 20, bottom: 30 },
            xAxis: { type: 'category', data: s.trend.map((t) => t.month), axisLine: { lineStyle: { color: '#26324f' } } },
            yAxis: { type: 'value', splitLine: { lineStyle: { color: '#1a2540' } } },
            series: [
              { type: 'bar', data: s.trend.map((t) => t.count), itemStyle: { color: '#4f8cff', borderRadius: [5, 5, 0, 0] }, barWidth: '48%' },
              { type: 'line', smooth: true, data: s.trend.map((t) => t.count), itemStyle: { color: '#37e0c8' }, lineStyle: { width: 3 } },
            ],
          }} />
        </div>
        <div className="card"><h3>原始数据分布 · 来源占比</h3><Chart option={donut(pieData(s.bySource))} /></div>
      </div>

      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <div className="card"><h3>分类占比 · 场景</h3><Chart height={240} option={donut(pieData(s.byScene))} /></div>
        <div className="card"><h3>分类占比 · 任务类型</h3><Chart height={240} option={barH(toPairs(s.byTask))} /></div>
        <div className="card"><h3>分类占比 · 机器人形态</h3><Chart height={240} option={donut(pieData(s.byRobot))} /></div>
      </div>

      <div className="grid cols-2" style={{ marginBottom: 16 }}>
        <div className="card"><h3>标签分类占比 · Top 标签</h3><Chart option={barH(toPairs(s.tagCount).slice(0, 12))} /></div>
        <div className="card"><h3>执行情况 · 生命周期转化漏斗</h3>
          <Chart option={{
            tooltip: { trigger: 'item' },
            series: [{ type: 'funnel', left: 20, right: 20, top: 10, bottom: 10, minSize: '30%', label: { color: '#e6ecf5', formatter: '{b}: {c}' },
              data: s.funnel.map((f, i) => ({ name: f.stage, value: f.value, itemStyle: { color: PALETTE[i % PALETTE.length] } })) }],
          }} />
        </div>
      </div>

      <div className="grid cols-3">
        <div className="card"><h3>执行情况 · 质量分等级</h3><Chart height={240} option={donut(pieData(s.byGrade), ['#2ec17a', '#f5a623', '#ff5b6a'])} /></div>
        <div className="card"><h3>执行情况 · 各状态数量</h3>
          <Chart height={240} option={barH(toPairs(s.byStatus).map(([k, v]) => [STATUS_LABEL[k] || k, v] as [string, number]))} />
        </div>
        <div className="card"><h3>训练回流 · 数据飞轮</h3>
          <Chart height={240} option={{
            tooltip: { trigger: 'axis' }, legend: { data: ['数据量(条)', '成功率(%)'], textStyle: { color: '#8aa0c6' }, top: 0 },
            grid: { left: 44, right: 44, top: 34, bottom: 30 },
            xAxis: { type: 'category', data: s.flywheel.map((f) => f.round) },
            yAxis: [{ type: 'value', splitLine: { lineStyle: { color: '#1a2540' } } }, { type: 'value', max: 100 }],
            series: [
              { name: '数据量(条)', type: 'bar', data: s.flywheel.map((f) => f.data), itemStyle: { color: '#4f8cff', borderRadius: [5, 5, 0, 0] }, barWidth: '45%' },
              { name: '成功率(%)', type: 'line', yAxisIndex: 1, smooth: true, data: s.flywheel.map((f) => f.success), lineStyle: { color: '#37e0c8', width: 3 }, itemStyle: { color: '#37e0c8' } },
            ],
          }} />
        </div>
      </div>
    </>
  );
}
