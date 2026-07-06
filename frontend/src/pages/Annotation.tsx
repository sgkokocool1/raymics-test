import { api } from '../api';
import { useApi } from '../useApi';
import { TopBar, Loading } from '../components/ui';

export default function Annotation() {
  const { data: tasks, loading } = useApi(() => api.annotations(), []);
  if (loading || !tasks) return <Loading />;

  return (
    <>
      <TopBar title="标注工作台" sub="AI 预标注 + 人工质检 · 时序分割 / 语言 / bbox / keypoint / 成败" />
      <div className="grid cols-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3>标注画布（占位）</h3>
          <div className="cam" style={{ height: 230 }}>
            <div className="play">▶</div>
            <div style={{ position: 'absolute', top: 40, left: 60, width: 120, height: 80, border: '2px solid #37e0c8', borderRadius: 6 }} />
            <div style={{ position: 'absolute', top: 34, left: 60, background: '#37e0c8', color: '#04212c', fontSize: 11, padding: '1px 6px', borderRadius: 4 }}>红色杯子 0.96</div>
            <div style={{ position: 'absolute', bottom: 8, left: 8, color: '#8aa0c6', fontSize: 12 }}>拖拽绘制 bbox / keypoint，AI 预标注结果可修正</div>
          </div>
          <div style={{ marginTop: 12 }}>
            <h3>子任务时序分割</h3>
            <div className="steps">
              <div className="step done">0.0-3.2s 接近</div><div className="step done">3.2-6.8s 抓取</div>
              <div className="step cur">6.8-9.4s 移动</div><div className="step">9.4-12s 放置</div>
            </div>
          </div>
        </div>
        <div className="card">
          <h3>标注任务队列</h3>
          <div className="tbl-wrap"><table>
            <thead><tr><th>任务</th><th>Episode</th><th>类型</th><th>标注人</th><th>进度</th><th>状态</th></tr></thead>
            <tbody>{tasks.map((a) => (
              <tr key={a.id}><td>{a.id}</td><td>{a.episode}</td><td>{a.type}</td><td>{a.assignee}</td>
                <td style={{ minWidth: 90 }}><div className="progress"><div style={{ width: `${a.progress}%` }} /></div></td>
                <td><span className="badge b-info">{a.status}</span></td></tr>
            ))}</tbody>
          </table></div>
          <h3 style={{ marginTop: 16 }}>标注工作流</h3>
          <div className="steps">
            <div className="step done">✓ AI 预标注</div><div className="step done">✓ 人工修正</div>
            <div className="step cur">● 一审</div><div className="step">二审/质检</div><div className="step">通过/驳回</div>
          </div>
        </div>
      </div>
    </>
  );
}
