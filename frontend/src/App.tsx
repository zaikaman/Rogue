import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { WalletProvider } from './components/WalletConnect'
import Home from './pages/Home'
import AppLayout from './layouts/AppLayout'
import Dashboard from './pages/Dashboard'
import Stake from './pages/Stake'
import Positions from './pages/Positions'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'
import Portfolio from './pages/Portfolio'
import Multichain from './pages/Multichain'

function App() {
  return (
    <WalletProvider>
      <BrowserRouter>
        <Routes>
          {/* Public homepage */}
          <Route path="/" element={<Home />} />
          
          {/* App routes with sidebar layout */}
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="stake" element={<Stake />} />
            <Route path="positions" element={<Positions />} />
            <Route path="portfolio" element={<Portfolio />} />
            <Route path="multichain" element={<Multichain />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </WalletProvider>
  )
}

export default App
