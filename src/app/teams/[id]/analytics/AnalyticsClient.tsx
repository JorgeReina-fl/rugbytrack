"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { AlertTriangle, TrendingUp, Users, ArrowLeft, Activity } from "lucide-react";

interface WeeklyData {
  week: string;
  workload: number;
  avgRpe: number;
  acwr: number;
}

interface PlayerData {
  userId: string;
  name: string;
  image: string | null;
  weeklyData: WeeklyData[];
  latestACWR: number;
  latestWorkload: number;
  latestAvgRpe: number;
  hasAlert: boolean;
}

interface AnalyticsClientProps {
  teamId: string;
  teamName: string;
  initialData: {
    weeks: string[];
    players: PlayerData[];
    teamWeeklyAvgLoad: number;
  };
}

export default function AnalyticsClient({
  teamId,
  teamName,
  initialData,
}: AnalyticsClientProps) {
  const { weeks, players, teamWeeklyAvgLoad } = initialData;
  const [weeksCount, setWeeksCount] = useState(8);

  // Filter players by alerts
  const alertPlayers = players.filter((p) => p.hasAlert);

  // Group data by week for the team trend chart
  const chartData = weeks.map((week) => {
    let totalLoad = 0;
    let count = 0;
    players.forEach((p) => {
      const wData = p.weeklyData.find((wd) => wd.week === week);
      if (wData) {
        totalLoad += wData.workload;
        count++;
      }
    });
    return {
      week: week.replace(/^\d{4}-/, ""), // simplifies YYYY-Www to Www
      "Carga Total Equipo": totalLoad,
      "Carga Media por Jugador": count > 0 ? Math.round(totalLoad / count) : 0,
    };
  });

  const getRpeColor = (rpe: number) => {
    if (rpe === 0) return "bg-secondary/40 text-muted-foreground/40 border border-border/50";
    if (rpe <= 3) return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
    if (rpe <= 6) return "bg-amber-500/15 text-amber-400 border border-amber-500/25";
    if (rpe <= 8) return "bg-orange-500/20 text-orange-400 border border-orange-500/30";
    return "bg-rose-500/30 text-rose-400 border border-rose-500/40";
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href={`/teams/${teamId}`}
              className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-all"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Volver a {teamName}
            </Link>
          </div>
          <h1 className="text-4xl font-heading font-extrabold tracking-tighter uppercase">
            📊 Analytics & RPE
          </h1>
          <p className="text-sm font-mono text-muted-foreground mt-1">
            Análisis de carga de entrenamiento y prevención de lesiones
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 sm:grid-cols-3">
        <div className="border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">
              Carga Media Semanal
            </span>
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div className="text-3xl font-heading font-extrabold text-foreground">
            {teamWeeklyAvgLoad}
          </div>
          <p className="text-xs font-mono text-muted-foreground mt-2 uppercase tracking-wider">
            Promedio (RPE × Duración) por jugador
          </p>
        </div>

        <div className="border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">
              Alertas ACWR
            </span>
            <AlertTriangle
              className={`h-5 w-5 ${
                alertPlayers.length > 0 ? "text-rose-500 animate-pulse" : "text-muted-foreground"
              }`}
            />
          </div>
          <div className="text-3xl font-heading font-extrabold text-foreground">
            {alertPlayers.length}
          </div>
          <p className="text-xs font-mono text-muted-foreground mt-2 uppercase tracking-wider">
            Jugadores con ratio agudo/crónico &gt; 1.5
          </p>
        </div>

        <div className="border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">
              Total Plantilla
            </span>
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div className="text-3xl font-heading font-extrabold text-foreground">
            {players.length}
          </div>
          <p className="text-xs font-mono text-muted-foreground mt-2 uppercase tracking-wider">
            Jugadores monitoreados
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Heatmap & Grid Section */}
        <div className="lg:col-span-2 space-y-8">
          <div className="border border-border bg-card shadow-sm">
            <div className="border-b border-border bg-secondary px-6 py-4 flex items-center justify-between">
              <h2 className="font-mono font-bold text-sm uppercase tracking-widest text-foreground">
                Heatmap de Intensidad (RPE Medio)
              </h2>
              <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                <span className="h-2.5 w-2.5 bg-emerald-500/20 border border-emerald-500/30"></span>
                <span>Suave</span>
                <span className="h-2.5 w-2.5 bg-amber-500/20 border border-amber-500/30 ml-2"></span>
                <span>Medio</span>
                <span className="h-2.5 w-2.5 bg-rose-500/30 border border-rose-500/40 ml-2"></span>
                <span>Fuerte</span>
              </div>
            </div>
            <div className="p-6 overflow-x-auto">
              <div className="min-w-[700px]">
                {/* Heatmap Grid */}
                <div
                  className="grid gap-2"
                  style={{
                    gridTemplateColumns: `180px repeat(${weeks.length}, minmax(60px, 1fr))`,
                  }}
                >
                  {/* Header Row */}
                  <div className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center">
                    Jugador
                  </div>
                  {weeks.map((week) => (
                    <div
                      key={week}
                      className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground text-center border-b border-border pb-2"
                    >
                      {week.replace(/^\d{4}-/, "")}
                    </div>
                  ))}

                  {/* Player Rows */}
                  {players.map((player) => (
                    <React.Fragment key={player.userId}>
                      {/* Name Col */}
                      <div className="flex items-center gap-2 py-1 pr-2 truncate border-r border-border/50">
                        <div className="h-6 w-6 shrink-0 border border-border bg-secondary font-heading font-black text-xs flex items-center justify-center text-foreground overflow-hidden">
                          {player.image ? (
                            <img
                              src={player.image}
                              alt={player.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            player.name.charAt(0)
                          )}
                        </div>
                        <span className="text-xs font-bold text-foreground truncate">
                          {player.name}
                        </span>
                      </div>

                      {/* Weeks RPE cells */}
                      {weeks.map((week) => {
                        const weekData = player.weeklyData.find(
                          (wd) => wd.week === week
                        ) || { workload: 0, avgRpe: 0, acwr: 0 };
                        return (
                          <div
                            key={week}
                            className={`group relative flex flex-col items-center justify-center py-2 text-center text-xs font-mono font-bold transition-all ${getRpeColor(
                              weekData.avgRpe
                            )}`}
                          >
                            <span>{weekData.avgRpe || "—"}</span>
                            {weekData.workload > 0 && (
                              <span className="text-[9px] opacity-75 font-normal">
                                w:{weekData.workload}
                              </span>
                            )}

                            {/* Tooltip Overlay */}
                            <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-48 -translate-x-1/2 scale-90 border border-border bg-popover p-2 text-left text-[11px] font-normal leading-normal text-popover-foreground opacity-0 shadow-lg transition-all group-hover:scale-100 group-hover:opacity-100">
                              <p className="font-bold text-xs uppercase tracking-wider mb-1 text-primary">
                                {player.name}
                              </p>
                              <p>Semana: {week}</p>
                              <p>RPE Medio: <strong className="text-foreground">{weekData.avgRpe || "N/A"}</strong></p>
                              <p>Carga Semanal: <strong className="text-foreground">{weekData.workload}</strong></p>
                              <p>ACWR Ratio: <strong className={weekData.acwr > 1.5 ? "text-rose-400 font-bold" : "text-foreground"}>{weekData.acwr || "N/A"}</strong></p>
                            </div>
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Recharts Carga Trend */}
          <div className="border border-border bg-card shadow-sm">
            <div className="border-b border-border bg-secondary px-6 py-4">
              <h2 className="font-mono font-bold text-sm uppercase tracking-widest text-foreground">
                Tendencia de Carga de Entrenamiento
              </h2>
            </div>
            <div className="p-6 h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#808CFD" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#808CFD" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                  <XAxis dataKey="week" stroke="#888" fontSize={11} tickLine={false} />
                  <YAxis stroke="#888" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#161616",
                      borderColor: "#2a2a2a",
                      color: "#fff",
                      fontSize: 12,
                      fontFamily: "var(--font-mono)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="Carga Media por Jugador"
                    stroke="#808CFD"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorLoad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Sidebar / Alert Panel */}
        <div className="space-y-8">
          <div className="border border-border bg-card shadow-sm">
            <div className="border-b border-border bg-secondary px-6 py-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              <h2 className="font-mono font-bold text-sm uppercase tracking-widest text-foreground">
                Riesgo ACWR (&gt; 1.5)
              </h2>
            </div>
            <div className="p-6">
              {alertPlayers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-xs font-mono uppercase tracking-wider">
                    No hay alertas activas
                  </p>
                  <p className="text-xs mt-1">Todos los jugadores en zona segura de carga.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {alertPlayers.map((player) => (
                    <div
                      key={player.userId}
                      className="border border-rose-500/20 bg-rose-500/5 p-4 flex flex-col gap-2"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 border border-rose-500/30 bg-rose-500/10 font-heading font-black text-sm flex items-center justify-center text-rose-400 overflow-hidden">
                          {player.image ? (
                            <img
                              src={player.image}
                              alt={player.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            player.name.charAt(0)
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">
                            {player.name}
                          </p>
                          <p className="text-[10px] font-mono uppercase tracking-widest text-rose-400">
                            Sobreentrenamiento
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="bg-rose-500/20 border border-rose-500/30 text-rose-400 px-2 py-0.5 text-xs font-mono font-bold">
                            {player.latestACWR}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-rose-500/10 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                        <div>
                          Carga Semanal: <span className="text-foreground font-bold">{player.latestWorkload}</span>
                        </div>
                        <div>
                          RPE Promedio: <span className="text-foreground font-bold">{player.latestAvgRpe}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="border border-border bg-card p-6 shadow-sm">
            <h3 className="font-mono font-bold text-xs uppercase tracking-widest text-foreground mb-3">
              ¿Qué es el ACWR?
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              El <strong>Acute:Chronic Workload Ratio</strong> compara la carga aguda de entrenamiento (semana actual) con la carga crónica acumulada (promedio de las últimas 4 semanas).
            </p>
            <div className="mt-4 space-y-2 font-mono text-xs">
              <div className="flex justify-between items-center text-emerald-400">
                <span>&lt; 0.8</span>
                <span>Bajo riesgo (Subentrenado)</span>
              </div>
              <div className="flex justify-between items-center text-primary">
                <span>0.8 – 1.3</span>
                <span>Zona dulce (Óptimo)</span>
              </div>
              <div className="flex justify-between items-center text-amber-500">
                <span>1.3 – 1.5</span>
                <span>Zona de precaución</span>
              </div>
              <div className="flex justify-between items-center text-rose-400 font-bold">
                <span>&gt; 1.5</span>
                <span>Zona de peligro (Lesión)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
