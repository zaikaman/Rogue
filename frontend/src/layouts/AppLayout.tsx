import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { WalletConnect } from '../components/WalletConnect'

const navigation = [
  { name: 'Dashboard', href: '/app', icon: '📊' },
  { name: 'Swap', href: '/app/swap', icon: '🔄' },
  { name: 'Portfolio', href: '/app/portfolio', icon: '💎' },
  { name: 'Multichain', href: '/app/multichain', icon: '🌐' },
  { name: 'Stake', href: '/app/stake', icon: '💰' },
  { name: 'Positions', href: '/app/positions', icon: '📈' },
  { name: 'Analytics', href: '/app/analytics', icon: '🔍' },
  { name: 'Settings', href: '/app/settings', icon: '⚙️' },
]

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="h-screen flex overflow-hidden bg-noir-black">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/80 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed lg:static inset-y-0 left-0 z-50 w-64
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          bg-noir-dark border-r border-noir-gray/50
        `}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-noir-gray/50">
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="w-8 h-8 bg-gradient-teal rounded-sm glow-teal group-hover:glow-teal-intense transition-all" />
            <span className="text-xl font-bold text-white tracking-tight">ROGUE</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center space-x-3 px-4 py-3 rounded-sm
                  font-medium transition-all duration-200
                  ${
                    isActive
                      ? 'bg-teal-glow/10 text-teal-glow terminal-border'
                      : 'text-gray-400 hover:text-white hover:bg-noir-gray/50'
                  }
                `}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="font-mono text-sm tracking-wide">{item.name}</span>
                {isActive && (
                  <div className="ml-auto w-1 h-6 bg-teal-glow rounded-full glow-teal" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Status indicator */}
        <div className="p-4 border-t border-noir-gray/50">
          <div className="terminal-border bg-noir-gray/30 rounded-sm p-3 scan-line">
            <div className="flex items-center space-x-2 mb-1">
              <div className="w-2 h-2 bg-success rounded-full pulse-glow" />
              <span className="font-mono text-xs text-gray-400">NETWORK STATUS</span>
            </div>
            <div className="font-mono text-xs text-white">Polygon Mainnet</div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 border-b border-noir-gray/50 flex items-center justify-between px-6 bg-noir-dark/50 backdrop-blur">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex items-center space-x-4">
            {/* Current time */}
            <div className="hidden sm:block font-mono text-sm text-gray-500">
              {new Date().toLocaleTimeString('en-US', { hour12: false })}
            </div>

            {/* Wallet connection */}
            <WalletConnect />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-gradient-noir">
          <div className="container mx-auto px-6 py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
