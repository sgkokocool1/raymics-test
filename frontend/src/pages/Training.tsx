import { api } from '../api';
import { useApi } from '../useApi';
import { TopBar, JobBadge, Loading } from '../components/ui';
import { Chart, donut, pieData } from '../components/Chart';

export default function Training() {
  const { data, loading } = useApi(() => api.training(), []);
  const { data: s } = useApi(() => api.stats(), []);
  if (loading || !data) return <Loading />;

  const jc: Record<string, number> = {};
  data.forEach((j) => { jc[j.status] = (jc[j.status] || 0) + 1; });

  return (
    <>
      <TopBar title="训练任务" sub="数据集热加载 / 流式读取 · 指标回流形成数据飞轮" />
      <div className="card" style={{ padding: 0, marginBottom: 16 }}>
        <div className="tbl-wrap"><table>
          <thead><tr><th>任务</th><th>数据集</th><th>策略</th><th>算力</th><th>进度</th><th>成功率</th><th>状态</th></tr></thead>
          <tbody>{data.map((j) => (
            <tr key={j.id}><td>{j.name}</td><td>{j.dataset}</td><td>{j.policy}</td><td>{j.gpu}</td>
              <td style={{ minWidth: 120 }}><div className="progress"><div style={{ width: `${j.progress}%` }} /></div></td>
              <td>{j.status === 'success' || j.status === 'running' ? `${(j.success_rate * 100).toFixed(0)}%` : '—'}</td>
              <td><JobBadge status={j.status} /></td></tr>
          ))}</tbody>
        </table></div>
      </div>
      <div className="grid cols-2">
        <div className="card"><h3>训练任务状态分布</h3>
          <Chart option={donut(pieData(jc), ['#2ec17a', '#4f8cff', '#ff5b6a', '#f5a623'])} />
        </div>
        <div className="card"><h3>数据飞轮 · 指标回流</h3>
          <Chart option={{
            tooltip: { trigger: 'axis' }, legend: { data: ['数据量(条)', '模型成功率(%)'], textStyle: { color: '#8aa0c6' }, top: 0 },
            grid: { left: 44, right: 44, top: 34, bottom: 30 },
            xAxis: { type: 'category', data: (s?.flywheel || []).map((f) => f.round) },
            yAxis: [{ type: 'value', name: '数据量', splitLine: { lineStyle: { color: '#1a2540' } } }, { type: 'value', name: '成功率', max: 100 }],
            series: [
              { name: '数据量(条)', type: 'bar', data: (s?.flywheel || []).map((f) => f.data), itemStyle: { color: '#4f8cff', borderRadius: [5, 5, 0, 0] }, barWidth: '45%' },
              { name: '模型成功率(%)', type: 'line', yAxisIndex: 1, smooth: true, data: (s?.flywheel || []).map((f) => f.success), lineStyle: { color: '#37e0c8', width: 3 }, itemStyle: { color: '#37e0c8' } },
            ],
          }} />
        </div>
      </div>
    </>
  );
}
