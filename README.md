# Rogue - Autonomous DeFi Yield Optimization Agent

> Set-it-and-forget-it robo-harvester for your crypto yields

Rogue is an autonomous DeFi yield optimizer powered by multi-agent AI that continuously monitors, analyzes, and executes optimal yield strategies on Polygon mainnet.

## 🏗️ Project Structure

```
Rogue/
├── frontend/          # Vite + React 18 + TypeScript + Tailwind CSS
├── backend/           # Node.js 18 + Express + TypeScript + ADK-TS agents
├── contracts/         # Hardhat + Solidity smart contracts
├── specs/             # Design documents and specifications
└── .specify/          # Project memory and instructions
```

## ✨ Features

- **Multi-Agent AI System**: Researcher → Analyzer → Executor → Governor workflow
- **Autonomous Yield Optimization**: Auto-compound and rebalance based on risk profile
- **Risk Profiles**: Low, Medium, High risk tolerance settings
- **Multi-Token Support**: USDC and KRWQ staking
- **Real-time APY Tracking**: Live yield estimates from Frax, Aave, and other protocols
- **One-Click Operations**: Stake, claim rewards, and unstake with single transactions
- **ATP Token Rewards**: Governance token distribution for platform users

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- pnpm or npm
- Polygon wallet with MATIC for gas
- Alchemy API key
- Supabase account
- OpenAI API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Rogue
   ```

2. **Install dependencies**
   ```bash
   # Frontend
   cd frontend
   npm install

   # Backend
   cd ../backend
   npm install

   # Smart contracts
   cd ../contracts
   npm install
   ```

3. **Configure environment variables**
   ```bash
   # Frontend
   cp frontend/.env.example frontend/.env
   # Edit frontend/.env with your Alchemy and WalletConnect credentials

   # Backend (IMPORTANT: Include OpenAI API configuration)
   cp backend/.env.example backend/.env
   # Edit backend/.env with Supabase, OpenAI, and RPC credentials

   # Contracts
   cp contracts/.env.example contracts/.env
   # Edit contracts/.env with private key and API keys
   ```

4. **Run development servers**
   ```bash
   # Terminal 1 - Frontend
   cd frontend
   npm run dev

   # Terminal 2 - Backend
   cd backend
   npm run dev
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:4000

## 📋 Implementation Status

### Phase 1: Setup ✅ COMPLETE
- [x] Project structure created
- [x] Frontend initialized (Vite + React 18 + TypeScript)
- [x] Backend initialized (Node.js 18 + Express + TypeScript)
- [x] Smart contracts initialized (Hardhat)
- [x] ESLint and Prettier configured
- [x] Tailwind CSS setup
- [x] Environment files created
- [x] .gitignore configured

### Phase 2: Foundational (In Progress)
See `specs/001-rogue-yield-agent/tasks.md` for detailed task list

### Phase 3: User Story 1 - MVP
Core staking and autonomous management functionality

### Phase 4: User Story 2
Allocation adjustments and monitoring

### Phase 5: User Story 3
Claim/unstake and rewards

## 🛠️ Technology Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Wallet**: RainbowKit + wagmi + viem
- **Charts**: Recharts
- **HTTP Client**: Axios
- **Routing**: React Router v6

### Backend
- **Runtime**: Node.js 18
- **Framework**: Express
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **AI Agents**: ADK-TS (Agent Development Kit)
- **LLM**: OpenAI GPT-4
- **Blockchain**: ethers.js v6
- **Scheduling**: node-cron
- **Logging**: Winston

### Smart Contracts
- **Language**: Solidity 0.8.20
- **Framework**: Hardhat
- **Libraries**: OpenZeppelin Contracts v5
- **Network**: Polygon Mainnet
- **Standards**: ERC-20, Proxy patterns

## 🔐 Security Considerations

- Never commit `.env` files or private keys
- All user inputs validated on backend
- Row Level Security (RLS) enabled on Supabase
- Wallet signature verification for authenticated endpoints
- Smart contracts audited before mainnet deployment (Phase 6)
- Rate limiting on API endpoints

## 📚 Documentation

- **Specification**: `specs/001-rogue-yield-agent/spec.md`
- **Implementation Plan**: `specs/001-rogue-yield-agent/plan.md`
- **Task List**: `specs/001-rogue-yield-agent/tasks.md`
- **Research Notes**: `specs/001-rogue-yield-agent/research.md`

## 🧪 Development

### Frontend Commands
```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run lint       # Run ESLint
npm run format     # Format code with Prettier
npm run preview    # Preview production build
```

### Backend Commands
```bash
npm run dev        # Start development server with watch mode
npm run build      # Compile TypeScript
npm run start      # Run compiled JavaScript
npm run lint       # Run ESLint
npm run format     # Format code with Prettier
```

### Smart Contracts Commands
```bash
npm run compile    # Compile contracts
npm run test       # Run tests
npm run deploy     # Deploy to Polygon mainnet
npm run verify     # Verify contracts on PolygonScan
npm run lint       # Run solhint
npm run format     # Format Solidity code
```

## 🌐 Deployment

### Frontend (Vercel)
```bash
cd frontend
npm run build
# Deploy dist/ folder to Vercel
```

### Backend (Vercel Serverless)
```bash
cd backend
npm run build
# Deploy with vercel.json configuration
```

### Smart Contracts (Polygon Mainnet)
```bash
cd contracts
npm run deploy -- --network polygon
npm run verify -- --network polygon <CONTRACT_ADDRESS>
```

## 🤝 Contributing

This is a structured implementation following the specification in `specs/001-rogue-yield-agent/`.

## 📄 License

MIT

## 🔗 Links

- [Polygon Network](https://polygon.technology/)
- [Alchemy](https://www.alchemy.com/)
- [Supabase](https://supabase.com/)
- [OpenAI](https://openai.com/)
- [RainbowKit](https://www.rainbowkit.com/)
- [Hardhat](https://hardhat.org/)

---

**Status**: Phase 1 Complete ✅  
**Next**: Phase 2 - Foundational Infrastructure  
**Timeline**: MVP target 2-3 weeks
