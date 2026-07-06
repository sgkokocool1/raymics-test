import { useNavigate, useParams } from 'react-router-dom';
import { api, STATUS_LABEL } from '../api';
import { useApi } from '../useApi';
import { TopBar, StatusBadge, Loading } from '../components/ui';
import { Chart } from '../components/Chart';

const FLOW = ['uploaded', 'scanned', 'raw', 'cleaning', 'preprocessed', 'annotating', 'annotated', 'asset', 'in_dataset', 'training', 'archived'];

function MetaRow({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="meta-row"><span className="k">{k}</span><span>{v}</span></div>;
}

export default function Detail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data: e, loading } = useApi(() => api.episode(id!), [id]);
  if (loading || !e) return <Loading />;

  const flowIdx = FLOW.indexOf(e.status);
  const xs = e.signals.joint_0.map((_, i) => i);

  return (
    <>
      <TopBar title={`数据详情 · ${e.episode_id}`} sub={`${e.project} / ${e.batch}`}
        extra={<button className="btn ghost" onClick={() => nav(-1)}>← 返回</button>} />

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>生命周期状态</h3>
        <div className="steps">
          {FLOW.map((k, i) => (
            <div key={k} className={`step ${i < flowIdx ? 'done' : i === flowIdx ? 'cur' : ''}`}>
              {i < flowIdx ? '✓ ' : i === flowIdx ? '● ' : ''}{STATUS_LABEL[k]}
            </div>
          ))}
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h3>多路相机同步回放（占位）</h3>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {Array.from({ length: e.cameras }).map((_, i) => (
              <div key={i} className="cam"><div className="play">▶</div>
                <div style={{ position: 'absolute', bottom: 6, left: 8 }}>cam_{i}</div></div>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <h3>子任务时序分割</h3>
            <div className="steps">
              {e.subtasks.map((st, i) => <div key={i} className={`step ${i < 2 ? 'done' : i === 2 ? 'cur' : ''}`}>{st.start}-{st.end}s {st.name}</div>)}
            </div>
          </div>
          <Chart height={220} option={{
            tooltip: { trigger: 'axis' }, legend: { data: ['joint_0', 'joint_1', 'gripper'], textStyle: { color: '#8aa0c6' }, top: 0 },
            grid: { left: 34, right: 16, top: 30, bottom: 24 },
            xAxis: { type: 'category', data: xs, axisLabel: { show: false } },
            yAxis: { type: 'value', splitLine: { lineStyle: { color: '#1a2540' } } },
            series: [
              { name: 'joint_0', type: 'line', showSymbol: false, smooth: true, data: e.signals.joint_0, lineStyle: { color: '#4f8cff' } },
              { name: 'joint_1', type: 'line', showSymbol: false, smooth: true, data: e.signals.joint_1, lineStyle: { color: '#37e0c8' } },
              { name: 'gripper', type: 'line', showSymbol: false, step: 'middle', data: e.signals.gripper, lineStyle: { color: '#f5a623' } },
            ],
          }} />
        </div>

        <div className="card">
          <h3>元数据</h3>
          <MetaRow k="状态" v={<StatusBadge status={e.status} />} />
          <MetaRow k="来源" v={e.source} />
          <MetaRow k="机器人形态" v={e.robot} />
          <MetaRow k="场景 / 任务" v={`${e.scene} / ${e.task}`} />
          <MetaRow k="目标物体" v={e.object} />
          <MetaRow k="时长 / 帧数" v={`${e.duration}s / ${e.frames}`} />
          <MetaRow k="FPS / 相机" v={`${e.fps} / ${e.cameras}路`} />
          <MetaRow k="模态" v={e.modalities.join(', ')} />
          <MetaRow k="动作维度" v={e.action_dim} />
          <MetaRow k="质量分" v={<span className={`grade-${e.quality_grade}`}>{e.quality_grade} · {e.quality_score}</span>} />
          <MetaRow k="采集人 / 设备" v={`${e.collected_by} / ${e.device}`} />
          <MetaRow k="采集日期" v={e.collected_at} />
          <MetaRow k="大小 / 版本" v={`${e.size_gb} GB / v${e.version}`} />
          <div style={{ marginTop: 12 }}><h3>标签</h3>{e.tags.map((t) => <span key={t} className="chip on">{t}</span>)}</div>
        </div>
      </div>
    </>
  );
}
