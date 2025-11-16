import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'

interface YieldChartProps {
  data: Array<{
    timestamp: string
    apy: number
    value: number
  }>
  height?: number
}

export default function YieldChart({ data, height = 300 }: YieldChartProps) {
  // Format data for display
  const chartData = data.map((d) => ({
    ...d,
    date: new Date(d.timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    }),
    apy: parseFloat(d.apy.toFixed(2)),
    value: parseFloat(d.value.toFixed(2))
  }))

  return (
    <div className="terminal-border bg-noir-dark/50 rounded-sm p-6 scan-line">
      <h3 className="font-mono text-sm text-gray-400 mb-6 uppercase tracking-wide">
        Yield Performance
      </h3>

      {chartData.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">📈</div>
          <p className="text-gray-400 mb-2">No historical data yet</p>
          <p className="text-sm text-gray-500 font-mono">
            Yield tracking starts after first position creation
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* APY Chart */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-500 font-mono">APY %</span>
              <span className="text-xs text-teal-glow font-mono">
                Current: {chartData[chartData.length - 1]?.apy.toFixed(2)}%
              </span>
            </div>
            <ResponsiveContainer width="100%" height={height * 0.5}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="apyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4FFFB0" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4FFFB0" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                <XAxis
                  dataKey="date"
                  stroke="#666"
                  style={{ fontSize: '11px', fontFamily: 'monospace' }}
                />
                <YAxis
                  stroke="#666"
                  style={{ fontSize: '11px', fontFamily: 'monospace' }}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0a0a0a',
                    border: '1px solid #4FFFB0',
                    borderRadius: '2px',
                    fontFamily: 'monospace',
                    fontSize: '12px'
                  }}
                  labelStyle={{ color: '#4FFFB0' }}
                  formatter={(value: number) => [`${value.toFixed(2)}%`, 'APY']}
                />
                <Area
                  type="monotone"
                  dataKey="apy"
                  stroke="#4FFFB0"
                  strokeWidth={2}
                  fill="url(#apyGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Position Value Chart */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-500 font-mono">Position Value (USD)</span>
              <span className="text-xs text-white font-mono">
                ${chartData[chartData.length - 1]?.value.toLocaleString()}
              </span>
            </div>
            <ResponsiveContainer width="100%" height={height * 0.5}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                <XAxis
                  dataKey="date"
                  stroke="#666"
                  style={{ fontSize: '11px', fontFamily: 'monospace' }}
                />
                <YAxis
                  stroke="#666"
                  style={{ fontSize: '11px', fontFamily: 'monospace' }}
                  tickFormatter={(value) => `$${value.toLocaleString()}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0a0a0a',
                    border: '1px solid #4FFFB0',
                    borderRadius: '2px',
                    fontFamily: 'monospace',
                    fontSize: '12px'
                  }}
                  labelStyle={{ color: '#4FFFB0' }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Value']}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#ffffff"
                  strokeWidth={2}
                  dot={{ fill: '#4FFFB0', r: 3 }}
                  activeDot={{ r: 5, fill: '#4FFFB0' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-noir-gray/50">
            <div>
              <div className="text-xs text-gray-500 font-mono mb-1">Avg APY</div>
              <div className="text-white font-bold font-mono">
                {(chartData.reduce((sum, d) => sum + d.apy, 0) / chartData.length).toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 font-mono mb-1">Peak APY</div>
              <div className="text-teal-glow font-bold font-mono">
                {Math.max(...chartData.map((d) => d.apy)).toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 font-mono mb-1">Total Growth</div>
              <div className="text-success font-bold font-mono">
                +{((chartData[chartData.length - 1]?.value / chartData[0]?.value - 1) * 100).toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
