import React, { useEffect, useRef } from "react";
import { 
  ResponsiveContainer, 
  RadarChart as RechartsRadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  Radar, 
  Legend, 
  Tooltip 
} from "recharts";

interface RadarDataPoint {
  name: string;
  current: number;
  previous: number;
}

interface RadarChartProps {
  data: RadarDataPoint[];
}

export function RadarChart({ data }: RadarChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsRadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
        <PolarGrid stroke="#e5e7eb" />
        <PolarAngleAxis 
          dataKey="name" 
          tick={{ fill: "#64748b", fontSize: 12 }}
        />
        
        <Radar
          name="Current Rating"
          dataKey="current"
          stroke="rgba(37, 99, 235, 1)"
          fill="rgba(37, 99, 235, 0.2)"
          fillOpacity={0.6}
          dot={true}
        />
        
        <Radar
          name="Previous Season"
          dataKey="previous"
          stroke="rgba(100, 116, 139, 1)"
          fill="rgba(100, 116, 139, 0.2)"
          fillOpacity={0.6}
          dot={true}
        />
        
        <Tooltip 
          contentStyle={{ 
            backgroundColor: "white", 
            borderRadius: "0.5rem",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
            border: "none",
            padding: "0.75rem"
          }}
          formatter={(value: number) => [`${value}`, ""]}
        />
        
        <Legend 
          wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }} 
        />
      </RechartsRadarChart>
    </ResponsiveContainer>
  );
}
