"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface WorkloadData {
  name: string;
  avgWorkload: number;
}

interface WorkloadChartProps {
  data: WorkloadData[];
}

export function WorkloadChart({ data }: WorkloadChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[300px] w-full items-center justify-center rounded-xl border border-border bg-card text-sm italic text-muted-foreground mt-4 font-mono shadow-sm">
        No hay datos suficientes para graficar
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis 
            dataKey="name" 
            stroke="var(--color-foreground)" 
            fontSize={12} 
            tickLine={false}
            axisLine={false}
            fontFamily="var(--font-geist-mono)"
            fontWeight="bold"
            opacity={0.7}
          />
          <YAxis 
            stroke="var(--color-foreground)" 
            fontSize={12} 
            tickLine={false}
            axisLine={false}
            fontFamily="var(--font-geist-mono)"
            fontWeight="bold"
            opacity={0.7}
          />
          <Tooltip 
            cursor={{ fill: 'var(--color-secondary)', opacity: 0.5 }}
            contentStyle={{ 
              backgroundColor: 'var(--color-card)', 
              borderColor: 'var(--color-border)',
              borderRadius: '0px',
              color: 'var(--color-foreground)',
              borderWidth: '1px',
              fontFamily: 'var(--font-geist-sans)'
            }}
            itemStyle={{ color: 'var(--color-primary)', fontWeight: 'bold' }}
          />
          <Bar 
            dataKey="avgWorkload" 
            fill="var(--color-primary)" 
            radius={[0, 0, 0, 0]} 
            name="Carga Media (UA)"
            barSize={40}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
