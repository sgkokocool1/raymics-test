import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useApi } from '../useApi';
import { TopBar, Loading } from '../components/ui';
import { toPairs } from '../components/Chart';

const FACET_LABEL: Record<string, string> = { scene: '场景', task: '任务', robot: '机器人', source: '来源' };

export default function Search() {
  const nav = useNavigate();
  const { data: tagsData } = useApi(() => api.tags(), []);
  const [q, setQ] = useState('');
  const [semantic, setSemantic] = useState(true);
  const [tags, setTags] = useState<string[]>([]);
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.search>> | null>(null);
  const [loading, setLoading] = useState(false);

  const run = () => {
    setLoading(true);
    api.search(tags, q, semantic).then(setResult).finally(() => setLoading(false));
  };
  useEffect(() => { run(); /* eslint-disable-next-line */ }, [tags]);

  const allTags = tagsData ? toPairs(tagsData.tagCount).map((p) => p[0]).slice(0, 24) : [];
  const toggle = (t: string) => setTags((cur) => cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]);

  return (
    <>
      <TopBar title="检索中心" sub="结构化过滤 + 全文 + 语义（向量）混合检索 · 分面下钻 · 相似检索"
        extra={result?.engine && <span className="pill">检索引擎：{result.engine}</span>} />
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="filters">
          <input placeholder='自然语言，如 "抓取失败案例"' style={{ minWidth: 280 }} value={q}
            onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} />
          <label style={{ color: 'var(--muted)', fontSize: 13 }}>
            <input type="checkbox" checked={semantic} onChange={(e) => setSemantic(e.target.checked)} style={{ verticalAlign: 'middle' }} /> 启用语义检索
          </label>
          <button className="btn" onClick={run}>检索</button>
        </div>
        <div style={{ color: 'var(--muted)', fontSize: 12, margin: '6px 0' }}>点选标签进行结构化过滤（AND）：</div>
        <div>{allTags.map((t) => <span key={t} className={`chip ${tags.includes(t) ? 'on' : ''}`} onClick={() => toggle(t)}>{t}</span>)}</div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '220px 1fr', gap: 16 }}>
        <div>
          {result && Object.entries(result.facets).map(([key, counts]) => (
            <div key={key} className="facet">
              <h4>{FACET_LABEL[key] || key}</h4>
              {toPairs(counts).slice(0, 6).map(([k, v]) => (
                <div key={k} className="f"><span>{k}</span><span style={{ color: 'var(--brand)' }}>{v}</span></div>
              ))}
            </div>
          ))}
        </div>
        <div>
          {loading ? <Loading /> : (
            <>
              <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 10 }}>命中 <b style={{ color: '#fff' }}>{result?.total}</b> 条 · 混合检索已重排序</div>
              <div className="card" style={{ padding: 0 }}>
                <div className="tbl-wrap"><table>
                  <thead><tr><th>Episode</th><th>相关度</th><th>任务</th><th>场景</th><th>成败</th><th>质量</th><th>标签</th></tr></thead>
                  <tbody>{result?.items.slice(0, 60).map((e) => (
                    <tr key={e.episode_id} onClick={() => nav(`/episodes/${e.episode_id}`)}>
                      <td className="link">{e.episode_id}</td><td>{e.relevance}</td><td>{e.task}</td><td>{e.scene}</td>
                      <td>{e.success ? <span className="badge b-ok">成功</span> : <span className="badge b-err">失败</span>}</td>
                      <td className={`grade-${e.quality_grade}`}>{e.quality_grade}</td>
                      <td>{e.tags.slice(0, 3).map((t) => <span key={t} className="chip">{t}</span>)}</td>
                    </tr>
                  ))}</tbody>
                </table></div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
