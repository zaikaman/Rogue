export default function Analytics() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2 font-mono tracking-tight">
          ANALYTICS
        </h1>
        <p className="text-gray-400">Deep dive into performance metrics and agent activity</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart placeholder */}
        <div className="terminal-border bg-noir-dark/50 rounded-sm p-6 scan-line">
          <h3 className="font-mono text-sm text-gray-400 mb-4 uppercase">Yield History</h3>
          <div className="h-64 flex items-center justify-center text-gray-600">
            <div className="text-center">
              <div className="text-4xl mb-2">📈</div>
              <div className="font-mono text-sm">Chart coming soon</div>
            </div>
          </div>
        </div>

        {/* Performance */}
        <div className="terminal-border bg-noir-dark/50 rounded-sm p-6 scan-line">
          <h3 className="font-mono text-sm text-gray-400 mb-4 uppercase">Performance</h3>
          <div className="space-y-4">
            {[
              { label: '24h Yield', value: '+$47.23', percent: '+0.38%' },
              { label: '7d Yield', value: '+$312.45', percent: '+2.51%' },
              { label: '30d Yield', value: '+$1,284.67', percent: '+10.31%' },
              { label: 'All Time', value: '+$2,847.89', percent: '+22.87%' },
            ].map((stat) => (
              <div key={stat.label} className="flex justify-between items-center py-3 border-b border-noir-gray/30">
                <span className="text-gray-400 font-mono text-sm">{stat.label}</span>
                <div className="text-right">
                  <div className="text-white font-bold">{stat.value}</div>
                  <div className="text-success text-xs font-mono">{stat.percent}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Agent Stats */}
      <div className="terminal-border bg-noir-dark/50 rounded-sm scan-line">
        <div className="p-6 border-b border-noir-gray/50">
          <h3 className="font-mono text-sm text-gray-400 uppercase">Agent Performance</h3>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { agent: 'RESEARCHER', scans: '1,247', success: '99.8%', avg: '2.3s' },
            { agent: 'ANALYZER', optimizations: '892', success: '98.1%', avg: '4.7s' },
            { agent: 'EXECUTOR', transactions: '143', success: '100%', avg: '12.4s' },
          ].map((stat) => (
            <div key={stat.agent} className="bg-noir-gray/30 rounded-sm p-4">
              <div className="text-teal-glow font-mono font-bold mb-3">{stat.agent}</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Actions</span>
                  <span className="text-white font-mono">{Object.values(stat)[1]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Success</span>
                  <span className="text-success font-mono">{stat.success}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Avg Time</span>
                  <span className="text-white font-mono">{stat.avg}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
