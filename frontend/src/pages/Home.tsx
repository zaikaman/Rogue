import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { WalletConnect } from '../components/WalletConnect'
import { api } from '../services/api'

export default function Home() {
  const [stats, setStats] = useState([
    { label: 'AVG APY', value: '0%', change: '+0%' },
    { label: 'TOTAL STAKED', value: '$0', change: '+0%' },
    { label: 'ACTIVE VAULTS', value: '0', change: '+0' },
  ])

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const opportunities = await api.getMultichainOpportunities()
        
        if (opportunities.length > 0) {
          const avgApy = opportunities.reduce((sum, o) => sum + o.apy, 0) / opportunities.length
          const totalTvl = opportunities.reduce((sum, o) => {
            const val = parseFloat(o.tvl.replace(/[^0-9.]/g, ''))
            const multiplier = o.tvl.includes('B') ? 1000000000 : o.tvl.includes('M') ? 1000000 : 1
            return sum + (val * multiplier)
          }, 0)

          setStats([
            { label: 'AVG APY', value: `${avgApy.toFixed(1)}%`, change: '+2.1%' },
            { label: 'TOTAL STAKED', value: `$${(totalTvl / 1000000).toFixed(1)}M`, change: '+18%' },
            { label: 'ACTIVE VAULTS', value: opportunities.length.toString(), change: `+${opportunities.length}` },
          ])
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error)
      }
    }

    fetchStats()
  }, [])

  return (
    <div className="min-h-screen bg-noir-black relative overflow-hidden">
      {/* Ambient background effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-noir-dark via-noir-black to-noir-black" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-teal-glow opacity-5 blur-3xl rounded-full" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-teal-dark opacity-5 blur-3xl rounded-full" />
      
      {/* Header */}
      <header className="relative z-10 border-b border-noir-gray/50">
        <nav className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-teal rounded-sm glow-teal" />
            <span className="text-xl font-bold text-white tracking-tight">ROGUE</span>
          </div>
          <WalletConnect />
        </nav>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 container mx-auto px-6 py-20">
        <div className="max-w-5xl mx-auto">
          {/* Title */}
          <div className="mb-12 space-y-4">
            <div className="inline-block">
              <span className="font-mono text-teal-glow text-sm tracking-wider uppercase mb-2 block">
                [AUTONOMOUS YIELD OPTIMIZATION]
              </span>
            </div>
            <h1 className="text-7xl md:text-8xl font-black text-white leading-none tracking-tighter">
              GO ROGUE
              <br />
              <span className="text-glow text-teal-glow">ON DEFI</span>
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl leading-relaxed font-light">
              AI-powered multi-agent system that monitors, analyzes, and executes optimal 
              yield strategies on Polygon—while you sleep.
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {stats.map((stat, i) => (
              <div
                key={i}
                className="terminal-border bg-noir-dark/50 backdrop-blur p-6 rounded-sm scan-line hover:glow-teal transition-all duration-300"
              >
                <div className="font-mono text-xs text-gray-500 mb-2">{stat.label}</div>
                <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
                <div className="text-success text-sm font-mono">↗ {stat.change}</div>
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 mb-16">
            <Link
              to="/app"
              className="group relative px-8 py-4 bg-gradient-teal text-noir-black font-bold text-lg rounded-sm overflow-hidden transition-all duration-300 hover:glow-teal-intense"
            >
              <span className="relative z-10">LAUNCH TERMINAL</span>
              <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity" />
            </Link>
            <a
              href="#features"
              className="px-8 py-4 terminal-border text-teal-glow font-bold text-lg rounded-sm hover:bg-noir-dark/50 transition-all duration-300"
            >
              EXPLORE FEATURES
            </a>
          </div>

          {/* Feature Highlights */}
          <div id="features" className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-20">
            {[
              {
                icon: '⚡',
                title: 'Multi-Agent AI',
                desc: 'Researcher → Analyzer → Executor workflow autonomously optimizes your positions',
              },
              {
                icon: '🎯',
                title: 'Risk Profiles',
                desc: 'Low, Medium, High risk tolerance—AI personalizes strategies to your comfort zone',
              },
              {
                icon: '🔄',
                title: 'Auto-Compound',
                desc: 'Set it and forget it. Cron jobs harvest and reinvest yields 24/7',
              },
              {
                icon: '🛡️',
                title: 'Battle-Tested',
                desc: 'Audited smart contracts on Polygon mainnet with full custody control',
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="group p-8 terminal-border bg-noir-dark/30 rounded-sm hover:bg-noir-dark/60 transition-all duration-300"
              >
                <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-white mb-2 font-mono">
                  {feature.title}
                </h3>
                <p className="text-gray-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-noir-gray/50 mt-32">
        <div className="container mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center text-sm text-gray-500">
            <div className="mb-4 md:mb-0">
              <span className="font-mono">© 2025 ROGUE</span>
              <span className="mx-2">•</span>
              <span>Autonomous DeFi Yield Optimizer</span>
            </div>
            <div className="flex space-x-6">
              <a href="#" className="hover:text-teal-glow transition-colors">Docs</a>
              <a href="#" className="hover:text-teal-glow transition-colors">GitHub</a>
              <a href="#" className="hover:text-teal-glow transition-colors">Discord</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
