import { api } from '../api';
import { useApi } from '../useApi';
import { TopBar, JobBadge, Loading } from '../components/ui';

export default function Datasets() {
  const { data, loading } = useApi(() => api.datasets(), []);
  if (loading || !data) return <Loading />;

  return (
    <>
      <TopBar title="数据集" sub="圈选资产 → 版本化 → train/val/test 切分 → 多格式导出（LeRobot/HDF5/MCAP）" />
      <div className="grid cols-2">
        {data.map((d) => (
          <div key={d.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ color: '#fff', fontSize: 15 }}>{d.name} <span style={{ color: 'var(--muted)', fontSize: 12 }}>v{d.version}</span></h3>
              <JobBadge status={d.status} />
            </div>
            <div style={{ display: 'flex', gap: 20, margin: '12px 0', fontSize: 13 }}>
              <div><div style={{ color: 'var(--muted)', fontSize: 11 }}>Episodes</div><b>{d.episodes}</b></div>
              <div><div style={{ color: 'var(--muted)', fontSize: 11 }}>时长</div><b>{d.hours}h</b></div>
              <div><div style={{ color: 'var(--muted)', fontSize: 11 }}>格式</div><b>{d.format}</b></div>
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 6 }}>train {d.splits.train} / val {d.splits.val} / test {d.splits.test}</div>
            <div className="progress"><div style={{ width: `${d.splits.train * 100}%` }} /></div>
            <div style={{ marginTop: 10 }}>{d.tags.map((t) => <span key={t} className="chip">{t}</span>)}</div>
            <div style={{ marginTop: 12 }}><button className="btn ghost">导出 {d.format}</button></div>
          </div>
        ))}
      </div>
    </>
  );
}
