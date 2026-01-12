import React, { memo } from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
}

const Sparkline: React.FC<SparklineProps> = memo(({
  data,
  width = 60,
  height = 20,
  className = '',
}) => {
  if (!data || data.length === 0) {
    return null;
  }

  const filteredData = data.filter(d => d > 0);
  if (filteredData.length === 0) {
    return null;
  }

  const min = Math.min(...filteredData);
  const max = Math.max(...filteredData);
  const range = max - min || 1;

  const normalize = (val: number) => {
    if (range === 0) return 0.5;
    return (val - min) / range;
  };

  const points = filteredData.map((val, i) => {
    const x = (i / Math.max(filteredData.length - 1, 1)) * width;
    const y = height - normalize(val) * height * 0.8;
    return { x, y };
  });

  const pathData = points.map((p, i) =>
    i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
  ).join(' ');

  const avgLatency = filteredData.reduce((a, b) => a + b, 0) / filteredData.length;

  const getColor = () => {
    if (avgLatency < 500) return '#34d399';
    if (avgLatency < 1500) return '#fbbf24';
    return '#f87171';
  };

  const color = getColor();

  const areaPath = `${pathData} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`gradient-${data.length}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <path
        d={areaPath}
        fill={`url(#gradient-${data.length})`}
      />
      <path
        d={pathData}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
});

export default Sparkline;
