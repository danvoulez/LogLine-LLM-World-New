import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

export function SafeMetric({ label, value, trend, trendValue }: any) {
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500';
  const TrendIcon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : Minus;
  
  return (
    <div className="flex flex-col">
      <span className="text-sm text-gray-500 font-medium">{label}</span>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-3xl font-bold text-gray-900">{value}</span>
        {trend && trendValue && (
          <span className={`flex items-center text-xs font-bold ${trendColor}`}>
            <TrendIcon className="w-3 h-3" />
            {trendValue}
          </span>
        )}
      </div>
    </div>
  );
}
