'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Activity,
  Clock3,
  Gauge,
  RefreshCw,
  TrendingUp,
  Zap,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis
} from 'recharts'

import { GlassCard } from '@/components/ui/glass-card'
import { GradientButton } from '@/components/ui/gradient-button'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000'

export default function MetricsPage() {
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const fetchMetrics = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${BACKEND_URL}/metrics`)
      if (!res.ok) {
        throw new Error(`Failed to fetch metrics (${res.status})`)
      }
      const data = await res.json()
      setMetrics(data)
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Metrics fetch failed', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMetrics()
    const interval = setInterval(fetchMetrics, 30000)
    return () => clearInterval(interval)
  }, [])

  const proofTrend = useMemo(() => {
    if (!metrics?.proofVerification?.recent) return []
    return metrics.proofVerification.recent.map((item) => ({
      timestamp: new Date(item.timestamp || Date.now()).toLocaleTimeString(),
      gas: Number(item.gasUsed || 0),
      latency: Number(item.latencyMs || 0)
    }))
  }, [metrics])

  const generationTrend = useMemo(() => {
    if (!metrics?.proofGeneration?.recent) return []
    return metrics.proofGeneration.recent.map((item) => ({
      timestamp: new Date(item.timestamp || Date.now()).toLocaleTimeString(),
      duration: Number(item.durationMs || 0)
    }))
  }, [metrics])

  const summaryCards = useMemo(() => {
    if (!metrics?.summary) return []
    return [
      {
        title: 'Median Proof Time',
        value: `${metrics.summary.proof_time_ms || 0} ms`,
        description: 'Median round-trip latency to generate zk proof payloads',
        icon: Clock3,
        gradient: 'from-indigo-500 to-purple-600'
      },
      {
        title: 'Median Verification Gas',
        value: metrics.summary.verify_gas ? `${metrics.summary.verify_gas} gas` : '0 gas',
        description: 'Median on-chain gas consumption for verification calls',
        icon: Gauge,
        gradient: 'from-blue-500 to-cyan-500'
      },
      {
        title: 'Proof Success Rate',
        value: `${metrics.summary.success_rate || 0}%`,
        description: 'Ratio of successful verification transactions to total attempts',
        icon: CheckCircle2,
        gradient: 'from-emerald-500 to-teal-500'
      }
    ]
  }, [metrics])

  return (
    <div className="max-w-6xl mx-auto space-y-10 py-12">
      <header className="text-center space-y-3">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-4xl md:text-5xl font-bold text-white"
        >
          Network Transparency & Metrics
        </motion.h1>
        <p className="text-white/60 max-w-2xl mx-auto">
          Live instrumentation of Polverify. Track proof latency, verification gas costs, and system health in real time.
        </p>
        <div className="flex items-center justify-center gap-4 pt-4">
          <GradientButton onClick={fetchMetrics} isLoading={loading} className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh Now
          </GradientButton>
          {lastUpdated && (
            <span className="text-sm text-white/50">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
        {error && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-400/30 text-red-300">
            <AlertTriangle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}
      </header>

      <section className="grid gap-6 md:grid-cols-3">
        {summaryCards.map((card) => {
          const Icon = card.icon
          return (
            <GlassCard key={card.title} className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${card.gradient} text-white shadow-lg shadow-black/20`}>
                  <Icon className="w-5 h-5" />
                </div>
                <TrendingUp className="w-5 h-5 text-white/30" />
              </div>
              <div>
                <p className="text-sm text-white/60">{card.title}</p>
                <p className="text-2xl font-bold text-white">{card.value}</p>
              </div>
              <p className="text-xs text-white/50 leading-relaxed">{card.description}</p>
            </GlassCard>
          )
        })}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <GlassCard className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Proof Generation Trend</h2>
              <p className="text-white/50 text-sm">Median proof latency tracked across recent events</p>
            </div>
          </div>
          <div className="h-56">
            {generationTrend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={generationTrend}>
                  <defs>
                    <linearGradient id="colorDuration" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="timestamp" stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
                  <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
                  <RechartsTooltip content={<ChartTooltip label="Proof Duration" unit="ms" />} />
                  <Area type="monotone" dataKey="duration" stroke="#6366f1" fillOpacity={1} fill="url(#colorDuration)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={Clock3} message="Waiting for proof events" />
            )}
          </div>
        </GlassCard>

        <GlassCard className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Verification Gas Trend</h2>
              <p className="text-white/50 text-sm">Gas usage and latency across latest verification calls</p>
            </div>
          </div>
          <div className="h-56">
            {proofTrend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={proofTrend}>
                  <defs>
                    <linearGradient id="colorGas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="timestamp" stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
                  <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
                  <RechartsTooltip content={<ChartTooltip label="Verification Gas" unit="gas" />} />
                  <Area type="monotone" dataKey="gas" stroke="#10b981" fillOpacity={1} fill="url(#colorGas)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={Gauge} message="Waiting for verification events" />
            )}
          </div>
        </GlassCard>
      </section>
    </div>
  )
}

function ChartTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null
  const data = payload[0]
  return (
    <div className="px-3 py-2 bg-slate-900/95 border border-white/10 rounded-md text-xs text-white/80">
      <div className="font-semibold text-white">{label}</div>
      <div className="flex items-center justify-between gap-6 pt-1">
        <span>{data.payload.timestamp}</span>
        <span className="font-mono text-white">{Number(data.value).toFixed(0)} {unit}</span>
      </div>
    </div>
  )
}

function EmptyState({ icon: Icon = Clock3, message }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
      <div className="p-4 rounded-full bg-white/5">
        <Icon className="w-6 h-6 text-white/30" />
      </div>
      <p className="text-sm text-white/50">{message}</p>
    </div>
  )
}

