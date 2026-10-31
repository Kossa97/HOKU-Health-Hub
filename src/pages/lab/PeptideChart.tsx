// src/pages/lab/PeptideChart.tsx
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from 'recharts'
import type { ChartEntry } from './pubmed'

interface LabStatsProps {
  chartData: ChartEntry[]
  chartLoading: boolean
  totalFound: number
}

export function LabStats({ chartData, chartLoading, totalFound }: LabStatsProps) {
  const activePeptides = chartData.filter(e => e.count > 0).length
  const currentYear = new Date().getFullYear().toString()

  return (
    <div className="card mb-4">
      {/* Stat tiles */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 bg-[var(--lg-fill)] rounded-xl p-3 text-center">
          <div className="text-lg font-medium tabular-nums text-[var(--lg-text)]">
            {totalFound > 0 ? totalFound : '—'}
          </div>
          <div className="text-xs text-[var(--lg-text-3)] mt-0.5">
            Treffer
          </div>
        </div>
        <div className="flex-1 bg-[var(--lg-fill)] rounded-xl p-3 text-center">
          <div className="text-lg font-medium tabular-nums text-[var(--lg-text)]">
            {chartLoading ? '…' : activePeptides || '—'}
          </div>
          <div className="text-xs text-[var(--lg-text-3)] mt-0.5">
            Peptide
          </div>
        </div>
        <div className="flex-1 bg-[var(--lg-fill)] rounded-xl p-3 text-center">
          <div className="text-lg font-medium tabular-nums text-[var(--lg-text)]">{currentYear}</div>
          <div className="text-xs text-[var(--lg-text-3)] mt-0.5">
            Aktuell
          </div>
        </div>
      </div>

      {/* Chart label */}
      <p className="label mb-3">Studien pro Peptid (PubMed)</p>

      {/* Loading skeleton */}
      {chartLoading && (
        <div className="space-y-2">
          {[90, 65, 50, 38, 28, 20, 14, 9].map((w, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-[72px] h-2.5 bg-slate-800 rounded animate-pulse" />
              <div
                className="h-2.5 bg-slate-800 rounded animate-pulse"
                style={{ width: `${w}%` }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      {!chartLoading && chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={chartData.length * 28 + 10}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ left: 0, right: 32, top: 0, bottom: 0 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={72}
              tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono, inherit)' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ fill: 'var(--border)' }}
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 11,
                padding: '6px 10px',
              }}
              itemStyle={{ color: 'var(--text-muted)' }}
              labelStyle={{ color: 'var(--text)', fontWeight: 500 }}
              formatter={(value) => [`${Number(value).toLocaleString('de-DE')} Studien`, '']}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={12}>
              {/* Ein Akzent: das meistuntersuchte Peptid, der Rest neutral */}
              {chartData.map((entry, i) => (
                <Cell key={entry.name} fill={i === 0 ? 'var(--accent)' : 'var(--lg-text-3)'} fillOpacity={i === 0 ? 1 : 0.5} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Empty */}
      {!chartLoading && chartData.length === 0 && (
        <p className="text-xs text-[var(--lg-text-3)] text-center py-3">Keine Chart-Daten verfügbar</p>
      )}
    </div>
  )
}
