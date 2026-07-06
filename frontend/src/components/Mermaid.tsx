import { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({ startOnLoad: false, theme: 'default', flowchart: { curve: 'basis' } });

let seq = 0;

export function Mermaid({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    const id = `mmd-${seq++}`;
    mermaid.render(id, chart).then(({ svg }) => {
      if (active && ref.current) ref.current.innerHTML = svg;
    }).catch((e) => { if (ref.current) ref.current.textContent = String(e); });
    return () => { active = false; };
  }, [chart]);
  return <div className="mermaid-box" ref={ref} />;
}
