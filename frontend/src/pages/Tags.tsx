import { api } from '../api';
import { useApi } from '../useApi';
import { TopBar, Loading } from '../components/ui';
import { Chart, PALETTE, donut, toPairs } from '../components/Chart';

export default function Tags() {
  const { data: meta } = useApi(() => api.meta(), []);
  const { data, loading } = useApi(() => api.tags(), []);
  const { data: s } = useApi(() => api.stats(), []);
  if (loading || !data || !meta) return <Loading />;

  const tagCount = data.tagCount;
  const dims: Record<string, string[]> = {
    场景: meta.scenes, 任务: meta.tasks, 机器人形态: meta.robots, 采集范式: meta.sources,
    '质量/成败': ['A', 'B', 'C', '成功', '失败'], 环境: ['白天', '夜晚', '强光', '遮挡'],
  };
  const tagged = s ? Math.round(s.total * 0.82) : 0;

  return (
    <>
      <TopBar title="标签管理" sub="多维层级标签体系 + 自由标签 · 人工/规则/模型自动打标" />
      <div className="grid cols-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3>标签维度体系</h3>
          {Object.entries(dims).map(([d, arr]) => (
            <div key={d} style={{ marginBottom: 12 }}>
              <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 6 }}>{d}</div>
              {arr.map((t) => <span key={t} className="chip">{t} <b style={{ color: '#fff' }}>{tagCount[t] || 0}</b></span>)}
            </div>
          ))}
        </div>
        <div className="card"><h3>标签数量分布（Treemap）</h3>
          <Chart height={420} option={{
            tooltip: {},
            series: [{ type: 'treemap', roam: false, breadcrumb: { show: false }, label: { color: '#fff' },
              levels: [{ itemStyle: { borderColor: '#131c31', borderWidth: 2, gapWidth: 2 } }],
              data: toPairs(tagCount).map(([name, value], i) => ({ name, value, itemStyle: { color: PALETTE[i % PALETTE.length] } })) }],
          }} />
        </div>
      </div>
      <div className="card"><h3>标签覆盖率</h3>
        <Chart height={240} option={donut([{ name: '已充分打标', value: tagged }, { name: '待补标', value: (s?.total || 0) - tagged }], ['#2ec17a', '#26324f'])} />
      </div>
    </>
  );
}
