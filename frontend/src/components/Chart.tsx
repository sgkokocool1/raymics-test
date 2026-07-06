import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

export const PALETTE = ['#4f8cff', '#37e0c8', '#f5a623', '#ff5b6a', '#a97bff', '#2ec17a', '#ff8f5a', '#5ad1ff'];

export function Chart({ option, height = 280 }: { option: echarts.EChartsOption; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inst = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    inst.current = echarts.init(ref.current, undefined, { renderer: 'canvas' });
    const resize = () => inst.current?.resize();
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); inst.current?.dispose(); };
  }, []);

  useEffect(() => {
    if (!inst.current) return;
    const opt: echarts.EChartsOption = {
      textStyle: { color: '#c7d3e8' },
      tooltip: { backgroundColor: '#131c31', borderColor: '#26324f', textStyle: { color: '#e6ecf5' }, ...(option.tooltip as object || {}) },
      ...option,
    };
    inst.current.setOption(opt, true);
  }, [option]);

  return <div ref={ref} style={{ width: '100%', height }} />;
}

/* 图表配置助手 */
export const toPairs = (obj: Record<string, number>) => Object.entries(obj).sort((a, b) => b[1] - a[1]);
export const pieData = (obj: Record<string, number>) => toPairs(obj).map(([name, value]) => ({ name, value }));

export function donut(data: { name: string; value: number }[], colors?: string[]): echarts.EChartsOption {
  return {
    color: colors || PALETTE,
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: '#8aa0c6' }, type: 'scroll' },
    series: [{ type: 'pie', radius: ['42%', '68%'], center: ['50%', '44%'], avoidLabelOverlap: true, itemStyle: { borderColor: '#131c31', borderWidth: 2 }, label: { color: '#c7d3e8', formatter: '{b}\n{d}%' }, data }],
  };
}
export function barH(pairs: [string, number][]): echarts.EChartsOption {
  return {
    grid: { left: 90, right: 24, top: 10, bottom: 20 }, tooltip: { trigger: 'axis' },
    xAxis: { type: 'value', splitLine: { lineStyle: { color: '#1a2540' } } },
    yAxis: { type: 'category', data: pairs.map((p) => p[0]).reverse() },
    series: [{ type: 'bar', data: pairs.map((p) => p[1]).reverse(), itemStyle: { color: '#4f8cff', borderRadius: [0, 5, 5, 0] }, barWidth: '55%' }],
  };
}
