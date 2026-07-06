import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useApi } from '../useApi';
import { TopBar, StatusBadge, Loading } from '../components/ui';

interface Filters { scene?: string; task?: string; robot?: string; source?: string; status?: string; grade?: string; q?: string; }

export default function Browse() {
  const nav = useNavigate();
  const { data: meta } = useApi(() => api.meta(), []);
  const [filters, setFilters] = useState<Filters>({});
  const [applied, setApplied] = useState<Filters>({});
  const { data, loading } = useApi(() => api.episodes({ ...applied, size: 120 }), [applied]);

  const upd = (k: keyof Filters, v: string) => setFilters((f) => ({ ...f, [k]: v }));
  const opt = (arr?: string[]) => ['', ...(arr || [])].map((x) => <option key={x} value={x}>{x || '全部'}</option>);

  return (
    <>
      <TopBar title="数据浏览 · 筛选" sub="基于元数据库的多维组合筛选（元数据驱动，原始大文件懒加载）" />
      <div className="filters">
        <select value={filters.scene || ''} onChange={(e) => upd('scene', e.target.value)}>{opt(meta?.scenes)}</select>
        <select value={filters.task || ''} onChange={(e) => upd('task', e.target.value)}>{opt(meta?.tasks)}</select>
        <select value={filters.robot || ''} onChange={(e) => upd('robot', e.target.value)}>{opt(meta?.robots)}</select>
        <select value={filters.source || ''} onChange={(e) => upd('source', e.target.value)}>{opt(meta?.sources)}</select>
        <select value={filters.status || ''} onChange={(e) => upd('status', e.target.value)}>
          <option value="">全部状态</option>
          {meta?.statusFlow.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <select value={filters.grade || ''} onChange={(e) => upd('grade', e.target.value)}>{opt(meta?.grades)}</select>
        <input placeholder="搜索任务/物体/ID..." value={filters.q || ''} style={{ minWidth: 200 }}
          onChange={(e) => upd('q', e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setApplied(filters)} />
        <button className="btn" onClick={() => setApplied(filters)}>筛选</button>
        <button className="btn ghost" onClick={() => { setFilters({}); setApplied({}); }}>重置</button>
      </div>

      {loading ? <Loading /> : (
        <>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 10 }}>共 <b style={{ color: '#fff' }}>{data?.total}</b> 条结果</div>
          <div className="card" style={{ padding: 0 }}>
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>Episode ID</th><th>场景</th><th>任务</th><th>机器人</th><th>来源</th><th>时长(s)</th><th>模态</th><th>质量</th><th>状态</th><th>采集人</th><th>日期</th></tr></thead>
                <tbody>
                  {data?.items.map((e) => (
                    <tr key={e.episode_id} onClick={() => nav(`/episodes/${e.episode_id}`)}>
                      <td className="link">{e.episode_id}</td><td>{e.scene}</td><td>{e.task}</td><td>{e.robot}</td><td>{e.source}</td>
                      <td>{e.duration}</td><td>{e.modalities.length} 路</td>
                      <td className={`grade-${e.quality_grade}`}>{e.quality_grade} · {e.quality_score}</td>
                      <td><StatusBadge status={e.status} /></td><td>{e.collected_by}</td><td>{e.collected_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
