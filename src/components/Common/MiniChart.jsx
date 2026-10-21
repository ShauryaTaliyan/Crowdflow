import React, { useState } from 'react';

/**
 * Responsive, Lightweight SVG Chart Component
 * Supports Line (with smooth curves & gradient fill), Area, and Bar charts.
 */
export default function MiniChart({
  type = 'line', // 'line', 'bar', 'area'
  data = [], // array of { x, y, label, secondaryY }
  xKey = 'time',
  yKey = 'value',
  secondaryKey = null,
  color = '#3b82f6',
  secondaryColor = '#f59e0b',
  height = 180,
  yLabel = '',
  emptyText = 'Simulation data recording...',
}) {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  if (!data || data.length < 2) {
    return (
      <div className="mini-chart-empty" style={{ height }}>
        <div className="empty-chart-icon">📊</div>
        <p>{emptyText}</p>
        <span className="empty-sub">Run or advance the simulation to accumulate data points</span>
      </div>
    );
  }

  const padding = { top: 16, right: 20, bottom: 28, left: 42 };
  const width = 500; // viewBox coordinate space

  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Extract min and max
  const yValues = data.map(d => Number(d[yKey]) || 0);
  if (secondaryKey) {
    yValues.push(...data.map(d => Number(d[secondaryKey]) || 0));
  }

  const minY = 0;
  const maxY = Math.max(1, Math.max(...yValues) * 1.15);

  const getX = (index) => padding.left + (index / (data.length - 1)) * chartW;
  const getY = (val) => padding.top + chartH - ((val - minY) / (maxY - minY)) * chartH;

  // Generate path
  const points = data.map((d, i) => ({
    x: getX(i),
    y: getY(Number(d[yKey]) || 0),
    data: d,
  }));

  const pathD = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`;

  // Secondary path if provided
  let secondaryPoints = null;
  let secondaryPathD = null;
  if (secondaryKey) {
    secondaryPoints = data.map((d, i) => ({
      x: getX(i),
      y: getY(Number(d[secondaryKey]) || 0),
      data: d,
    }));
    secondaryPathD = secondaryPoints.reduce((acc, p, i) => {
      return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
    }, '');
  }

  const gradId = `chart_grad_${Math.random().toString(36).substr(2, 6)}`;

  return (
    <div className="mini-chart-container" style={{ position: 'relative', width: '100%' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mini-chart-svg"
        preserveAspectRatio="none"
        style={{ width: '100%', height, overflow: 'visible' }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal Grid lines */}
        {[0, 0.33, 0.66, 1].map((pct, idx) => {
          const yPos = padding.top + chartH * (1 - pct);
          const val = (minY + (maxY - minY) * pct).toFixed(1);
          return (
            <g key={idx} className="chart-grid-line">
              <line
                x1={padding.left}
                y1={yPos}
                x2={width - padding.right}
                y2={yPos}
                stroke="rgba(255, 255, 255, 0.08)"
                strokeDasharray="4 4"
              />
              <text
                x={padding.left - 6}
                y={yPos + 4}
                fill="#94a3b8"
                fontSize="10"
                textAnchor="end"
              >
                {val}
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        <path d={areaD} fill={`url(#${gradId})`} />

        {/* Primary Line */}
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Secondary Line if present */}
        {secondaryPathD && (
          <path
            d={secondaryPathD}
            fill="none"
            stroke={secondaryColor}
            strokeWidth="2"
            strokeDasharray="5 3"
            strokeLinecap="round"
          />
        )}

        {/* Data points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hoveredPoint?.index === i ? 5 : 2.5}
            fill={hoveredPoint?.index === i ? '#ffffff' : color}
            stroke={color}
            strokeWidth="1.5"
            onMouseEnter={() => setHoveredPoint({ ...p, index: i })}
            onMouseLeave={() => setHoveredPoint(null)}
            style={{ cursor: 'pointer', transition: 'r 0.15s ease' }}
          />
        ))}

        {/* X Axis bottom labels (Start, Mid, End) */}
        <text
          x={padding.left}
          y={height - 6}
          fill="#94a3b8"
          fontSize="10"
          textAnchor="start"
        >
          {data[0][xKey]}s
        </text>
        <text
          x={padding.left + chartW / 2}
          y={height - 6}
          fill="#94a3b8"
          fontSize="10"
          textAnchor="middle"
        >
          {data[Math.floor(data.length / 2)][xKey]}s
        </text>
        <text
          x={width - padding.right}
          y={height - 6}
          fill="#94a3b8"
          fontSize="10"
          textAnchor="end"
        >
          {data[data.length - 1][xKey]}s
        </text>
      </svg>

      {/* Floating tooltip */}
      {hoveredPoint && (
        <div
          className="chart-tooltip"
          style={{
            position: 'absolute',
            left: `${(hoveredPoint.x / width) * 100}%`,
            top: `${(hoveredPoint.y / height) * 100}%`,
            transform: 'translate(-50%, -120%)',
            pointerEvents: 'none',
          }}
        >
          <div className="tooltip-title">Time: {hoveredPoint.data[xKey]}s</div>
          <div className="tooltip-val" style={{ color }}>
            {yLabel || yKey}: {hoveredPoint.data[yKey]}
          </div>
          {secondaryKey && (
            <div className="tooltip-val" style={{ color: secondaryColor }}>
              {secondaryKey}: {hoveredPoint.data[secondaryKey]}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
