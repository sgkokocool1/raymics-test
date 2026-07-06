import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useApi } from '../useApi';
import { TopBar, Kpi, StatusBadge, Loading } from '../components/ui';

export default function Assets() {
  const nav = useNavigate();
  const { data, loading } = useApi(() => api.episodes({ status: 'asset', size: 100 }), []);
  const { data: inds } = useApi(() => api.episodes({ status: 'in_dataset', size: 100 }), []);
  const { data: s } = useApi(() => api.stats(), []);
  if (loading || !data) return <Loading />;

  const assetTotal = (s?.byStatus.asset || 0) + (s?.byStatus.in_dataset || 0) + (s?.byStatus.training || 0) + (s?.byStatus.archived || 0);
  const aGrade = data.items.filter((e) => e.quality_grade === 'A').length;

  return (
    <>
      <TopBar title="数据资产" sub="通过清洗/预处理/标注/质检的可用资产 · 不可变 · 版本化 · 可复用"
        extra={<span className="pill">共 {assetTotal} 项资产</span>} />
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <Kpi title="资产总数" val={assetTotal} unit="项" />
        <Kpi title="A 级资产(当前页)" val={aGrade} unit="项" delta="高质量" dir="up" />
        <Kpi title="已进数据集" val={s?.byStatus.in_dataset || 0} unit="项" delta="被复用" dir="up" />
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div className="tbl-wrap"><table>
          <thead><tr><th>资产ID</th><th>版本</th><th>任务</th><th>场景</th><th>质量</th><th>标注</th><th>状态</th><th>标签</th></tr></thead>
          <tbody>{[...data.items, ...(inds?.items || [])].slice(0, 100).map((e) => (
            <tr key={e.episode_id} onClick={() => nav(`/episodes/${e.episode_id}`)}>
              <td className="link">{e.episode_id}</td><td>v{e.version}</td><td>{e.task}</td><td>{e.scene}</td>
              <td className={`grade-${e.quality_grade}`}>{e.quality_grade}</td>
              <td><span className="badge b-ok">已标注</span></td><td><StatusBadge status={e.status} /></td>
              <td>{e.tags.slice(0, 3).map((t) => <span key={t} className="chip">{t}</span>)}</td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>
    </>
  );
}
