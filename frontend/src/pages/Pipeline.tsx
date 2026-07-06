import { api } from '../api';
import { useApi } from '../useApi';
import { TopBar, Kpi, JobBadge, Loading } from '../components/ui';
import { Chart, barH } from '../components/Chart';

export default function Pipeline() {
  const { data: p, loading } = useApi(() => api.pipeline(), []);
  const { data: s } = useApi(() => api.stats(), []);
  if (loading || !p) return <Loading />;

  const steps = ['多源时空对齐', '重采样(亚毫秒)', '6D 轨迹重建', '坐标系统一', '分辨率/帧率归一', '动作/状态归一化', 'LeRobot v3 转换'];

  return (
    <>
      <TopBar title="清洗 · 预处理流水线" sub="自动清洗规则 + 质量评分 + 时空对齐 + 6D 轨迹重建 + 标准化转换" />
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <Kpi title="清洗队列" val={s?.byStatus.cleaning || 0} unit="条" delta="自动+人工复核" />
        <Kpi title="预处理完成" val={s?.byStatus.preprocessed || 0} unit="条" delta="已标准化" dir="up" />
        <Kpi title="隔离(低质)" val={s?.byGrade.C || 0} unit="条" delta="C 级样本" dir="down" />
      </div>

      <div className="grid cols-2" style={{ marginBottom: 16 }}>
        <div className="card"><h3>处理任务执行情况</h3>
          <div className="tbl-wrap"><table>
            <thead><tr><th>任务ID</th><th>类型</th><th>目标批次</th><th>处理量</th><th>状态</th></tr></thead>
            <tbody>{p.jobs.map((j) => <tr key={j.id}><td>{j.id}</td><td>{j.type}</td><td>{j.target}</td><td>{j.count}</td><td><JobBadge status={j.status} /></td></tr>)}</tbody>
          </table></div>
        </div>
        <div className="card"><h3>清洗规则命中分布</h3>
          <Chart option={barH(p.cleanRules.map((r) => [r.rule, r.count] as [string, number]))} />
        </div>
      </div>

      <div className="card"><h3>预处理步骤</h3>
        <div className="steps">{steps.map((s) => <div key={s} className="step done">✓ {s}</div>)}</div>
      </div>
    </>
  );
}
