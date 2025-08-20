import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

export default function FunnelChart({ data }: { data: Array<{ day: string; value: number }> }){
  const isDark = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';
  const lineColor = isDark ? '#f0abfc' : '#ec4899';
  const gridLine = isDark ? '#1f2937' : '#f1f5f9';
  const axis = isDark ? '#94a3b8' : '#64748b';
  const tooltipBg = isDark ? '#0b1220' : '#ffffff';
  const tooltipText = isDark ? '#e2e8f0' : '#0f172a';

  const option = {
    grid: { left: 8, right: 8, top: 16, bottom: 24, containLabel: true },
    xAxis: {
      type: 'category',
      data: data.map((d)=> d.day),
      axisLine: { lineStyle: { color: gridLine } },
      axisLabel: { color: axis, fontSize: 12 },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: gridLine } },
      axisLabel: { color: axis, fontSize: 12 },
    },
    tooltip: { trigger: 'axis', backgroundColor: tooltipBg, borderColor: gridLine, borderWidth: 1, textStyle: { color: tooltipText } },
    animationDuration: 600,
    series: [
      {
        type: 'line',
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2.2, color: lineColor },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: isDark ? 'rgba(240,171,252,0.25)' : 'rgba(236,72,153,0.35)' },
              { offset: 1, color: 'rgba(236,72,153,0.02)' },
            ],
          },
        },
        data: data.map((d)=> d.value),
      },
    ],
  } as any;

  return <ReactEChartsCore echarts={echarts} option={option} style={{ height: '100%', width: '100%' }} notMerge lazyUpdate />;
}


