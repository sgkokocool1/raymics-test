import { ReactNode } from 'react';
import { STATUS_LABEL } from '../api';

export function TopBar({ title, sub, extra }: { title: string; sub: string; extra?: ReactNode }) {
  return (
    <div className="topbar">
      <div><h1>{title}</h1><div className="sub">{sub}</div></div>
      <div>{extra}</div>
    </div>
  );
}

export function Kpi({ title, val, unit, delta, dir }: { title: string; val: ReactNode; unit?: string; delta?: string; dir?: 'up' | 'down' | '' }) {
  return (
    <div className="card kpi">
      <h3>{title}</h3>
      <div className="val">{val}{unit && <span>{unit}</span>}</div>
      {delta && <div className={`delta ${dir || ''}`}>{delta}</div>}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    asset: 'b-ok', in_dataset: 'b-ok', training: 'b-info', archived: 'b-info',
    raw: 'b-warn', cleaning: 'b-warn', annotating: 'b-warn', scanned: 'b-warn',
    preprocessed: 'b-info', annotated: 'b-info', uploaded: 'b-warn',
  };
  return <span className={`badge ${map[status] || 'b-info'}`}>{STATUS_LABEL[status] || status}</span>;
}

export function JobBadge({ status }: { status: string }) {
  const m: Record<string, [string, string]> = {
    success: ['b-ok', '成功'], running: ['b-info', '运行中'], failed: ['b-err', '失败'],
    queued: ['b-warn', '排队'], building: ['b-warn', '构建中'], ready: ['b-ok', '就绪'],
  };
  const [c, t] = m[status] || ['b-info', status];
  return <span className={`badge ${c}`}>{t}</span>;
}

export function Loading() { return <div className="loading">加载中…</div>; }
