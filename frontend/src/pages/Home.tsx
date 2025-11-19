import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { WalletConnect } from '../components/WalletConnect'
import { api } from '../services/api'
import { motion, useScroll, useTransform } from 'framer-motion'
import { HugeiconsIcon } from '@hugeicons/react'
import { 
  ArrowUpRight01Icon, 
  FlashIcon, 
  Target02Icon, 
  Shield02Icon,
  ArrowRight01Icon,
  Analytics01Icon,
  SecurityCheckIcon
} from '@hugeicons/core-free-icons'

export default function Home() {
  const [stats, setStats] = useState([
    { label: 'AVG APY', value: '15.2%', change: '+2.1%' },
    { label: 'TOTAL STAKED', value: '$76M', change: '+12.5%' },
    { label: 'ACTIVE STRATEGIES', value: '600+', change: '+23.1%' },
    { label: 'TOTAL USERS', value: '80K', change: '+8.3%' },
  ])

  useEffect(() => {
    // Script is already loaded in HTML, just initialize
    const initUnicorn = () => {
      const UnicornStudio = (window as any).UnicornStudio;
      if (UnicornStudio) {
        try {
          UnicornStudio.init();
        } catch (error) {
          console.error('Error initializing UnicornStudio:', error);
        }
      }
    };

    // Check if already loaded
    if ((window as any).UnicornStudio) {
      initUnicorn();
    } else {
      // Wait for script to load (it's in HTML head)
      const checkLoaded = setInterval(() => {
        if ((window as any).UnicornStudio) {
          clearInterval(checkLoaded);
          initUnicorn();
        }
      }, 50);
      
      return () => clearInterval(checkLoaded);
    }

  }, [])

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
            { label: 'ACTIVE STRATEGIES', value: opportunities.length.toString(), change: `+${opportunities.length}` },
            { label: 'TOTAL USERS', value: '1.2K', change: '+12%' },
          ])
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error)
      }
    }

    fetchStats()
  }, [])

  const { scrollY } = useScroll()
  const y1 = useTransform(scrollY, [0, 500], [0, 200])
  const y2 = useTransform(scrollY, [0, 500], [0, -150])

  return (
    <div className="min-h-screen bg-noir-black text-gray-100 font-sans selection:bg-teal-glow/30 selection:text-white overflow-x-hidden">
      
      {/* Header - Enhanced Glassmorphic */}
      <header className="fixed top-0 left-0 right-0 z-50 pt-6 px-6">
        <div className="max-w-7xl mx-auto rounded-full px-6 py-3 bg-noir-black/70 backdrop-blur-xl border border-white/10 shadow-2xl">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3 group">
              <img src="/logo.webp" alt="Rogue" className="w-8 h-8 rounded object-cover" />
              <span className="text-white text-lg font-bold tracking-tight">ROGUE</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-white/60">
              <a className="hover:text-white transition-colors duration-300 px-4 py-2 rounded-full hover:bg-white/5" href="#features">
                Features
              </a>
              <a className="hover:text-white transition-colors duration-300 px-4 py-2 rounded-full hover:bg-white/5" href="#how-it-works">
                How It Works
              </a>
              <Link className="hover:text-white transition-colors duration-300 px-4 py-2 rounded-full hover:bg-white/5" to="/app">
                App
              </Link>
              <a className="hover:text-white transition-colors duration-300 px-4 py-2 rounded-full hover:bg-white/5" href="#">
                Docs
              </a>
            </nav>
            <div className="flex items-center gap-2">
              <WalletConnect />
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section with Animated Background */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        {/* UnicornStudio Animated Background */}
        <div 
          data-us-project="4gq2Yrv2p0bIa0hdLPQx" 
          className="absolute inset-0 w-full h-full"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 0,
            background: 'radial-gradient(circle at 50% 50%, rgba(0, 212, 255, 0.1) 0%, rgba(9, 10, 10, 0) 50%)',
          }}
        />

        {/* Animated Background Elements - Fallback/Additional */}
        <div className="absolute inset-0 -z-20 overflow-hidden pointer-events-none">
          <motion.div 
            style={{ y: y1, x: -100 }}
            className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-teal-glow/10 rounded-full blur-[120px] opacity-30"
          />
          <motion.div 
            style={{ y: y2, x: 100 }}
            className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-teal-dark/10 rounded-full blur-[120px] opacity-30"
          />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
        </div>

        <div className="container mx-auto px-4 max-w-6xl relative z-10">
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 text-white tracking-tight leading-[0.95]">
                GO ROGUE
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-glow to-teal-dark">ON DEFI</span>
              </h1>
            </motion.div>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed"
            >
              Autonomous, tokenized AI portfolio manager on IQAI ATP. Hands-off, multi-agent management on <span className="font-mono text-teal-glow">Base Mainnet</span>. Buy and stake <span className="font-mono text-teal-glow">$RGE</span> to delegate — no extra signatures needed.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-4 justify-center mb-20"
            >
              <Link to="/app" className="inline-flex items-center justify-center gap-2 bg-teal-glow hover:bg-teal-dark text-noir-black px-8 py-4 rounded-lg text-base font-bold transition-all duration-300 shadow-[0_0_20px_rgba(0,212,255,0.3)] hover:shadow-[0_0_30px_rgba(0,212,255,0.5)]">
                Start Building
                <HugeiconsIcon icon={ArrowRight01Icon} size={20} />
              </Link>
              <a href="#features" className="inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 px-8 py-4 rounded-lg text-base font-medium transition-all duration-300 backdrop-blur-sm">
                Explore Features
              </a>
            </motion.div>

            {/* Stats Bar */}
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4"
            >
              {stats.map((stat, i) => (
                <div key={i} className="group rounded-xl bg-noir-dark/40 border border-white/5 p-6 backdrop-blur-sm hover:border-teal-glow/30 transition-all duration-300 hover:-translate-y-1">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    {i === 0 && <HugeiconsIcon icon={Analytics01Icon} size={20} className="text-teal-glow" />}
                    {i === 1 && <HugeiconsIcon icon={Target02Icon} size={20} className="text-teal-glow" />}
                    {i === 2 && <HugeiconsIcon icon={ArrowUpRight01Icon} size={20} className="text-teal-glow" />}
                    {i === 3 && <HugeiconsIcon icon={SecurityCheckIcon} size={20} className="text-teal-glow" />}
                    <div className="text-3xl font-bold text-white">{stat.value}</div>
                  </div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{stat.label}</div>
                  <div className="text-xs text-success font-mono font-medium bg-success/10 inline-block px-2 py-0.5 rounded">{stat.change}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Trusted By Section */}
      <section className="py-12 relative border-y border-white/5 bg-noir-black/50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-8">
            <p className="uppercase text-xs font-medium text-gray-500 tracking-widest">
              Trusted by teams at
            </p>
          </div>
          <div className="overflow-hidden relative mask-linear-fade">
            <div className="flex gap-16 py-2 items-center animate-marquee whitespace-nowrap">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="flex gap-16 shrink-0 items-center min-w-full justify-around">
                  <span className="text-xl font-bold text-gray-600 hover:text-white transition duration-300">BASE</span>
                  <span className="text-xl font-bold text-gray-600 hover:text-white transition duration-300">AAVE</span>
                  <span className="text-xl font-bold text-gray-600 hover:text-white transition duration-300">UNISWAP</span>
                  <span className="text-xl font-bold text-gray-600 hover:text-white transition duration-300">CHAINLINK</span>
                  <span className="text-xl font-bold text-gray-600 hover:text-white transition duration-300">LIDO</span>
                  <span className="text-xl font-bold text-gray-600 hover:text-white transition duration-300">CURVE</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 relative bg-noir-dark/20">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-white tracking-tight">
              Why Choose <span className="text-teal-glow">Rogue</span>?
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Create, deploy and monitor autonomous DeFAI strategies — powered by ADK-TS and OpenAI.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: ArrowUpRight01Icon, title: 'Autonomy First', desc: 'Post-delegation automation: cron scans, oracle signals, and event-driven execution.' },
              { icon: FlashIcon, title: 'Risk-Aware', desc: 'Simple, risk‑adjusted allocations: Low / Med / High.' },
              { icon: Shield02Icon, title: 'Tokenized Access', desc: (
                <span>
                  Stake <span className="font-mono text-teal-glow">$RGE</span> for pro‑rata access to returns.
                </span>
              ) },
              { icon: Analytics01Icon, title: 'Transparent', desc: 'On-chain txs and Supabase logs for full auditability.' },
            ].map((feature, i) => (
              <div key={i} className="group rounded-2xl bg-noir-dark border border-white/5 p-8 hover:border-teal-glow/30 transition-all duration-300 hover:-translate-y-1">
                <div className="w-12 h-12 rounded-xl bg-teal-glow/10 flex items-center justify-center mb-6 group-hover:bg-teal-glow/20 transition-colors">
                  <HugeiconsIcon icon={feature.icon} size={24} className="text-teal-glow" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-white">{feature.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Showcase Section */}
      <section className="py-24 relative bg-noir-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="bg-noir-dark/40 border border-white/5 rounded-[2.5rem] p-8 md:p-12 backdrop-blur-sm overflow-hidden relative">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-teal-glow/5 rounded-full blur-[100px] pointer-events-none" />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              <div className="flex flex-col justify-between h-full">
                <div>
                  <span className="text-sm font-mono text-teal-glow tracking-wider uppercase">Platform</span>
                  <h2 className="text-4xl md:text-6xl font-bold text-white tracking-tight mt-4 mb-8 leading-[1.1]">
                    A platform for automated DeFi strategies built for speed and precision.
                  </h2>
                  
                  <div className="space-y-8 relative pl-6 border-l border-white/10">
                    <div className="relative">
                      <div className="absolute -left-[25px] top-1 w-3 h-3 rounded-full bg-teal-glow shadow-[0_0_10px_rgba(0,212,255,0.5)]" />
                      <h3 className="text-xl font-bold text-white mb-2">Researcher Agent</h3>
                      <p className="text-gray-400">Scans subgraphs and APIs to surface top opportunities by APY, volatility and gas.</p>
                    </div>
                    <div className="relative">
                      <div className="absolute -left-[25px] top-1 w-3 h-3 rounded-full bg-teal-dark" />
                      <h3 className="text-xl font-bold text-white mb-2">Analyzer Agent</h3>
                      <p className="text-gray-400">Builds a risk‑adjusted allocation and simulates expected P&L.</p>
                    </div>
                    <div className="relative">
                      <div className="absolute -left-[25px] top-1 w-3 h-3 rounded-full bg-gray-600" />
                      <h3 className="text-xl font-bold text-white mb-2">Executor Agent</h3>
                      <p className="text-gray-400">Executes approved actions via proxy contracts, bridges and relayers; logs txs to Supabase.</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-12">
                  <Link to="/app" className="inline-flex items-center gap-2 text-teal-glow font-bold hover:text-white transition-colors group">
                    Explore Strategies
                    <HugeiconsIcon icon={ArrowRight01Icon} size={20} className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 relative">
                <div className="space-y-4 mt-12">
                  <div className="aspect-[4/5] rounded-2xl bg-noir-black border border-white/10 p-4 relative overflow-hidden group hover:border-teal-glow/30 transition-colors">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-noir-black/90 z-10" />
                    <div className="absolute bottom-4 left-4 z-20">
                      <div className="text-xs text-teal-glow font-mono mb-1">MONITORING</div>
                      <div className="text-lg font-bold text-white">Live Tracking</div>
                    </div>
                    {/* Abstract UI representation */}
                    <div className="w-full h-full bg-noir-dark/50 rounded-lg flex items-center justify-center">
                      <HugeiconsIcon icon={Analytics01Icon} size={48} className="text-white/10 group-hover:text-teal-glow/20 transition-colors" />
                    </div>
                  </div>
                  <div className="aspect-[4/3] rounded-2xl bg-noir-black border border-white/10 p-4 relative overflow-hidden group hover:border-teal-glow/30 transition-colors">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-noir-black/90 z-10" />
                    <div className="absolute bottom-4 left-4 z-20">
                      <div className="text-xs text-teal-glow font-mono mb-1">SECURITY</div>
                      <div className="text-lg font-bold text-white">Audited Contracts</div>
                    </div>
                    <div className="w-full h-full bg-noir-dark/50 rounded-lg flex items-center justify-center">
                      <HugeiconsIcon icon={Shield02Icon} size={48} className="text-white/10 group-hover:text-teal-glow/20 transition-colors" />
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="aspect-[4/3] rounded-2xl bg-noir-black border border-white/10 p-4 relative overflow-hidden group hover:border-teal-glow/30 transition-colors">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-noir-black/90 z-10" />
                    <div className="absolute bottom-4 left-4 z-20">
                      <div className="text-xs text-teal-glow font-mono mb-1">STRATEGY</div>
                      <div className="text-lg font-bold text-white">Multi-Protocol</div>
                    </div>
                    <div className="w-full h-full bg-noir-dark/50 rounded-lg flex items-center justify-center">
                      <HugeiconsIcon icon={ArrowUpRight01Icon} size={48} className="text-white/10 group-hover:text-teal-glow/20 transition-colors" />
                    </div>
                  </div>
                  <div className="aspect-[4/5] rounded-2xl bg-noir-black border border-white/10 p-4 relative overflow-hidden group hover:border-teal-glow/30 transition-colors">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-noir-black/90 z-10" />
                    <div className="absolute bottom-4 left-4 z-20">
                      <div className="text-xs text-teal-glow font-mono mb-1">AI</div>
                      <div className="text-lg font-bold text-white">Smart Optimization</div>
                    </div>
                    <div className="w-full h-full bg-noir-dark/50 rounded-lg flex items-center justify-center">
                      <HugeiconsIcon icon={Target02Icon} size={48} className="text-white/10 group-hover:text-teal-glow/20 transition-colors" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 relative bg-noir-dark/20">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-white tracking-tight">
              Get Started in <span className="text-teal-glow">3 Steps</span>
            </h2>
            <p className="text-lg text-gray-400">From zero to earning in minutes</p>
          </div>

          <div className="space-y-6">
            {[
              { step: '01', title: 'Connect Wallet', desc: 'Connect your Base wallet (MetaMask, Coinbase Wallet, etc.) in seconds.' },
              { step: '02', title: 'Select Risk Profile', desc: 'Choose Low, Medium, or High risk. Rogue adjusts its strategy accordingly.' },
              { step: '03', title: 'Stake & Delegate', desc: (
                <span>
                  Stake <span className="font-mono text-teal-glow">$RGE</span> and deposit assets — Rogue manages them automatically.
                </span>
              ) },
            ].map((item, i) => (
              <div key={i} className="group rounded-xl bg-noir-dark border border-white/5 p-8 hover:border-teal-glow/30 transition-all duration-300 flex items-start gap-6">
                <div className="w-14 h-14 rounded-xl bg-teal-glow flex items-center justify-center shrink-0 shadow-lg shadow-teal-glow/20 group-hover:scale-110 transition-transform">
                  <span className="text-xl font-bold text-noir-black">{item.step}</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-gray-400">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link to="/app" className="inline-flex items-center justify-center gap-2 bg-teal-glow hover:bg-teal-dark text-noir-black px-8 py-4 rounded-lg text-base font-bold transition-all duration-300 shadow-[0_0_20px_rgba(0,212,255,0.3)]">
              Launch App
              <HugeiconsIcon icon={ArrowRight01Icon} size={20} />
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24 relative bg-noir-black overflow-hidden">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-12">
            <div className="space-y-1">
              <p className="text-xs sm:text-sm text-teal-glow font-mono uppercase tracking-wider">
                Community
              </p>
              <h2 className="text-3xl md:text-4xl tracking-tight font-bold text-white">
                What users say
              </h2>
            </div>
          </div>

          <div className="relative mask-linear-fade">
            <div className="flex gap-6 animate-marquee hover:[animation-play-state:paused]">
              {[
                { name: "Alex K.", handle: "@alexk_defi", text: "Rogue's high-risk strategy on Base is insane. 18% APY on stables while I sleep? Yes please." },
                { name: "Sarah M.", handle: "@sarah_yields", text: "I love the 'set it and forget it' vibe. The AI actually moves my funds when rates drop. Game changer." },
                { name: "David T.", handle: "@dave_crypto", text: "Finally a yield optimizer that doesn't require me to check it every hour. The risk profiles are spot on." },
                { name: "Elena R.", handle: "@elena_eth", text: "The USDC support is great — seamless stablecoin yields on Base." },
                { name: "Marcus L.", handle: "@marcus_l", text: "Cleanest UI in DeFi. And the fact that it's non-custodial gives me peace of mind." },
                { name: "Alex K.", handle: "@alexk_defi", text: "Rogue's high-risk strategy on Base is insane. 18% APY on stables while I sleep? Yes please." },
                { name: "Sarah M.", handle: "@sarah_yields", text: "I love the 'set it and forget it' vibe. The AI actually moves my funds when rates drop. Game changer." },
                { name: "David T.", handle: "@dave_crypto", text: "Finally a yield optimizer that doesn't require me to check it every hour. The risk profiles are spot on." },
              ].map((testimonial, i) => (
                <div key={i} className="shrink-0 w-[350px] rounded-2xl border border-white/10 bg-noir-dark/40 p-6 backdrop-blur-sm hover:border-teal-glow/30 transition-colors">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-glow to-teal-dark flex items-center justify-center text-noir-black font-bold">
                      {testimonial.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-white">{testimonial.name}</div>
                      <div className="text-xs text-gray-500">{testimonial.handle}</div>
                    </div>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed">"{testimonial.text}"</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="rounded-3xl bg-gradient-to-br from-noir-dark to-noir-black border border-teal-glow/20 p-12 md:p-20 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay"></div>
            <div className="absolute top-0 left-0 w-full h-full bg-teal-glow/5 blur-3xl"></div>
            
            <div className="relative z-10">
              <h2 className="text-4xl md:text-6xl font-bold mb-6 text-white tracking-tight">
                Ready to <span className="text-teal-glow">Go Rogue</span>?
              </h2>
              <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
                Stake <span className="font-mono text-teal-glow">$RGE</span> and delegate — Rogue manages and reports performance on Base Mainnet.
              </p>
              <Link to="/app" className="inline-flex items-center justify-center gap-2 bg-teal-glow hover:bg-teal-dark text-noir-black px-10 py-5 rounded-lg text-lg font-bold transition-all duration-300 shadow-[0_0_30px_rgba(0,212,255,0.4)] hover:scale-105">
                Launch App
                <HugeiconsIcon icon={ArrowRight01Icon} size={24} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-noir-black py-16">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="col-span-1 md:col-span-1">
              <div className="flex items-center gap-2 mb-6">
                <img src="/logo.webp" alt="Rogue" className="w-8 h-8 rounded object-cover" />
                <span className="text-white text-xl font-bold">ROGUE</span>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">
                Autonomous, tokenized AI portfolio manager. Stake <span className="font-mono text-teal-glow">$RGE</span> for shared alpha.
              </p>
            </div>
            <div>
              <h4 className="text-white font-bold mb-6">Product</h4>
              <ul className="space-y-4 text-sm text-gray-500">
                <li><a href="#features" className="hover:text-teal-glow transition-colors">Features</a></li>
                <li><a href="#how-it-works" className="hover:text-teal-glow transition-colors">How It Works</a></li>
                <li><Link to="/app" className="hover:text-teal-glow transition-colors">App</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-6">Resources</h4>
              <ul className="space-y-4 text-sm text-gray-500">
                <li><a href="#" className="hover:text-teal-glow transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-teal-glow transition-colors">Security</a></li>
                <li><a href="#" className="hover:text-teal-glow transition-colors">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-6">Community</h4>
              <ul className="space-y-4 text-sm text-gray-500">
                <li><a href="#" className="hover:text-teal-glow transition-colors">Discord</a></li>
                <li><a href="#" className="hover:text-teal-glow transition-colors">Twitter</a></li>
                <li><a href="#" className="hover:text-teal-glow transition-colors">GitHub</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-600">
              © 2025 Rogue. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-xs text-gray-600">
              <a href="#" className="hover:text-white transition-colors">Terms</a>
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

// Add type declaration for UnicornStudio
declare global {
  interface Window {
    UnicornStudio?: {
      init: () => void;
      isInitialized?: boolean;
    };
  }
}