'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

interface ChartProps {
  type: 'bar' | 'line' | 'pie' | 'area';
  data: ChartDataPoint[];
  title?: string;
  className?: string;
  height?: number;
}

export function SafeChart({ type, data, title, className, height = 200 }: ChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  if (type === 'bar') {
    return (
      <div className={cn('space-y-4', className)}>
        {title && <h3 className="text-sm font-semibold text-gray-700">{title}</h3>}
        <div className="space-y-2" style={{ height: `${height}px` }}>
          {data.map((point, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <span className="text-xs text-gray-600 w-24 truncate">{point.label}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${(point.value / maxValue) * 100}%` }}
                />
              </div>
              <span className="text-xs font-medium text-gray-700 w-16 text-right">
                {point.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'line' || type === 'area') {
    const points = data.map((point, idx) => ({
      x: (idx / (data.length - 1 || 1)) * 100,
      y: 100 - (point.value / maxValue) * 100,
      value: point.value,
      label: point.label,
    }));

    return (
      <div className={cn('space-y-4', className)}>
        {title && <h3 className="text-sm font-semibold text-gray-700">{title}</h3>}
        <div className="relative" style={{ height: `${height}px` }}>
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {type === 'area' && (
              <polygon
                points={`0,100 ${points.map((p) => `${p.x},${p.y}`).join(' ')} 100,100`}
                fill="url(#areaGradient)"
                opacity="0.3"
              />
            )}
            <polyline
              points={points.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-blue-500"
            />
            <defs>
              <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.4" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-gray-500 px-2">
            {data.map((point, idx) => (
              <span key={idx} className="truncate" style={{ maxWidth: `${100 / data.length}%` }}>
                {point.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (type === 'pie') {
    let currentAngle = 0;
    const total = data.reduce((sum, d) => sum + d.value, 0);
    const radius = 40;
    const centerX = 50;
    const centerY = 50;

    return (
      <div className={cn('space-y-4', className)}>
        {title && <h3 className="text-sm font-semibold text-gray-700">{title}</h3>}
        <div className="flex items-center justify-center">
          <svg viewBox="0 0 100 100" className="w-full max-w-xs">
            {data.map((point, idx) => {
              const percentage = (point.value / total) * 100;
              const angle = (percentage / 100) * 360;
              const startAngle = currentAngle;
              const endAngle = currentAngle + angle;
              currentAngle += angle;

              const x1 = centerX + radius * Math.cos((startAngle - 90) * (Math.PI / 180));
              const y1 = centerY + radius * Math.sin((startAngle - 90) * (Math.PI / 180));
              const x2 = centerX + radius * Math.cos((endAngle - 90) * (Math.PI / 180));
              const y2 = centerY + radius * Math.sin((endAngle - 90) * (Math.PI / 180));
              const largeArc = angle > 180 ? 1 : 0;

              const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
              const color = point.color || colors[idx % colors.length];

              return (
                <path
                  key={idx}
                  d={`M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
                  fill={color}
                  stroke="white"
                  strokeWidth="0.5"
                />
              );
            })}
          </svg>
        </div>
        <div className="space-y-2">
          {data.map((point, idx) => {
            const percentage = ((point.value / total) * 100).toFixed(1);
            const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
            const color = point.color || colors[idx % colors.length];
            return (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
                <span className="text-gray-600">{point.label}</span>
                <span className="ml-auto font-medium text-gray-700">{percentage}%</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}

