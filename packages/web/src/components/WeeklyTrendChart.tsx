"use client";

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

interface DayData {
  day: string;
  score: number;
}

interface WeeklyTrendChartProps {
  data: DayData[];
}

export default function WeeklyTrendChart({ data }: WeeklyTrendChartProps) {
  return (
    <div className="w-full h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barSize={24}>
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#8A9BB0", fontSize: 12 }}
          />
          <YAxis
            domain={[0, 100]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#8A9BB0", fontSize: 12 }}
            width={30}
          />
          <Tooltip
            contentStyle={{
              background: "#121A22",
              border: "1px solid #1A2B3C",
              borderRadius: "8px",
              color: "#FFFFFF",
              fontSize: 12,
            }}
            cursor={{ fill: "rgba(95, 224, 207, 0.1)" }}
          />
          <Bar dataKey="score" fill="#99FF00" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
