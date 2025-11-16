# ADK-TS Multi-Agent Orchestration Research

## Executive Summary

**Decision**: Use ADK-TS Sequential Workflow Agent with shared state communication and MCP-based tool integration for Rogue's four-agent system (Researcher → Analyzer → Executor → Governor).

**Rationale**: 
- Sequential workflow matches Rogue's linear pipeline (research → analyze → execute → govern)
- Shared state provides atomic communication without complexity of event-driven systems
- MCP integration enables standardized blockchain/API tool registration
- ADK-TS built for production with retry mechanisms and error handling plugins

**Key Finding**: ADK-TS is production-ready TypeScript framework (launched July 2025) specifically designed for multi-agent orchestration, unlike generic frameworks.

---

## 1. Agent Communication Patterns

### ADK-TS Communication Mechanisms

#### **Shared State (Recommended)**
```typescript
// Agents share state through session.state object
// Researcher writes to shared state
researcher_agent = new Agent({
  name: "ResearcherAgent",
  outputKey: "market_data", // Writes here
  // ...
});

// Analyzer reads from shared state
analyzer_agent = new Agent({
  name: "AnalyzerAgent", 
  instruction: "Read market_data from state and analyze risk",
  // Automatically accesses session.state.market_data
});
```

**Key Features**:
- Built-in state management via `session.state`
- No manual message passing required
- Automatic data flow between sequential agents
- Type-safe with clear input/output contracts

#### **Event-Driven (Alternative)**
```typescript
// Event-driven via ADK runtime events
// More complex, suitable for parallel agents
app = new App({
  plugins: [EventLoggerPlugin()],
  // Events: tool_call, agent_start, agent_end
});
```

**Comparison**:

| Pattern | Use Case | Complexity | Rogue Fit |
|---------|----------|------------|-----------|
| **Shared State** | Sequential workflows | Low | ✅ Perfect |
| Event-Driven | Parallel/async agents | High | ❌ Overkill |
| Message Passing | External systems | Medium | ⚠️ If needed for Governor |

### **Recommendation for Rogue**

**Use Shared State** for Researcher → Analyzer → Executor flow:

```typescript
const rogueWorkflow = new SequentialAgent({
  name: "RogueYieldWorkflow",
  subAgents: [
    researcherAgent,    // Writes: market_data, protocol_params
    analyzerAgent,      // Writes: risk_assessment, position_sizes
    executorAgent,      // Writes: execution_plan, transactions
    governorAgent       // Writes: validation_result, adjustments
  ]
});
```

**Why**: 
- Matches linear pipeline perfectly
- Minimal code complexity
- Built-in state persistence via ADK session management
- Clear data contracts between agents

---

## 2. Error Handling & Retry Strategies

### ADK-TS Built-in Mechanisms

#### **ReflectAndRetryToolPlugin** (ADK v1.16.0+)
```typescript
import { ReflectAndRetryToolPlugin } from '@iqai/adk';

const app = new App({
  rootAgent: rogueWorkflow,
  plugins: [
    ReflectAndRetryToolPlugin({
      maxRetries: 3,
      throwExceptionIfRetryExceeded: true,
      trackingScope: TrackingScope.INVOCATION
    })
  ]
});
```

**Features**:
- Automatic tool failure retry (blockchain calls, API failures)
- LLM-powered reflection: AI corrects parameters on retry
- Per-tool failure tracking
- Configurable retry limits

#### **Network Error Handling**
```typescript
// Production pattern for blockchain/API tools
class RobustBlockchainTool extends BaseTool {
  async execute(args) {
    const RETRIABLE_ERRORS = [
      'RemoteProtocolError',
      'ReadTimeout', 
      'ConnectTimeout'
    ];
    
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.callBlockchain(args);
      } catch (error) {
        if (RETRIABLE_ERRORS.includes(error.name) && attempt < 2) {
          await sleep(2 ** attempt * 1000); // Exponential backoff
          continue;
        }
        throw error;
      }
    }
  }
}
```

**Known ADK Issues** (as of Nov 2025):
- ADK-Python had narrow retry scope (only `anyio.ClosedResourceError`)
- Fixed in v1.16.0+ with ReflectAndRetryToolPlugin
- ADK-TS likely has similar improvements

### **Recommendation for Rogue**

**Three-Layer Error Strategy**:

1. **Tool Level**: Custom retry logic in blockchain tools
   ```typescript
   // For Aave/Morpho interaction tools
   - 3 retries with exponential backoff
   - Handle: network errors, nonce issues, gas estimation failures
   ```

2. **Agent Level**: ReflectAndRetryToolPlugin
   ```typescript
   - Catches tool errors
   - LLM reflects and corrects parameters
   - Max 3 retries per tool per invocation
   ```

3. **Workflow Level**: Governor agent validation
   ```typescript
   governorAgent = new Agent({
     instruction: "Validate executor plan. If invalid, request Analyzer re-run with adjusted parameters",
     // Implements business logic validation
   });
   ```

**Example Flow**:
```
1. Executor calls depositToAave() → Network timeout
   → Tool retries 3x with backoff → Success

2. Executor calls depositToAave() → "Insufficient liquidity" error
   → ReflectAndRetryPlugin: LLM adjusts deposit amount → Retry → Success

3. Governor validates plan → "Risk too high" 
   → Workflow re-runs from Analyzer with stricter risk params
```

---

## 3. State Persistence Patterns

### ADK-TS State Management

#### **Three Levels of Memory**

```typescript
// 1. SESSION STATE (Current conversation)
session.state.market_data = { ... };
// Lost on app restart

// 2. LONG-TERM MEMORY (Cross-session)
session.memory.remember("user_risk_preference", "conservative");
// Persists with backend storage

// 3. CHECKPOINTING (Workflow recovery)
const checkpoint = {
  lastCompletedAgent: "AnalyzerAgent",
  state: session.state,
  timestamp: Date.now()
};
await saveCheckpoint(checkpoint);
```

#### **Storage Backends**

| Backend | Use Case | Persistence | ADK Support |
|---------|----------|-------------|-------------|
| In-Memory | Development | ❌ Lost on restart | ✅ Default |
| PostgreSQL | Production sessions | ✅ Persistent | ✅ Via SessionService |
| Vertex AI | Long-term knowledge | ✅ Vector storage | ✅ Google ADK |
| Redis | Fast checkpointing | ✅ Persistent | ⚠️ Custom |

### **Recommendation for Rogue**

**Hybrid Persistence Strategy**:

```typescript
// 1. Session State for workflow execution
const rogueSession = new Session({
  storage: new PostgresSessionStore({
    // Stores: market_data, risk_assessment, execution_plan
    connectionString: process.env.DATABASE_URL
  })
});

// 2. Long-term memory for user preferences
session.memory.remember("user_vault_address", vaultAddress);
session.memory.remember("risk_tolerance", "moderate");
// Used by future executions

// 3. Custom checkpointing for long-running workflows
class RogueCheckpointManager {
  async saveCheckpoint(workflowId, state) {
    await redis.set(
      `checkpoint:${workflowId}`,
      JSON.stringify({
        completedAgents: state.completedAgents,
        sessionState: state.session.state,
        timestamp: Date.now()
      }),
      { EX: 3600 } // 1 hour expiry
    );
  }
  
  async recoverWorkflow(workflowId) {
    const checkpoint = await redis.get(`checkpoint:${workflowId}`);
    // Resume from last completed agent
  }
}
```

**Persistence Patterns**:

| Data Type | Storage | Lifetime | Example |
|-----------|---------|----------|---------|
| Market data | Session state | Workflow execution | Aave rates, pool liquidity |
| Risk parameters | Session state | Workflow execution | Max leverage, position sizes |
| User preferences | Long-term memory | Persistent | Vault address, risk tolerance |
| Execution checkpoints | Redis/PostgreSQL | 1 hour | Resume after API failures |
| Historical positions | PostgreSQL | Permanent | Audit trail, analytics |

---

## 4. Tool Integration Best Practices

### ADK-TS Tool Registration Patterns

#### **MCP (Model Context Protocol) Integration**

```typescript
// Recommended: Use MCP servers for blockchain tools
import { MCPToolset } from '@iqai/adk';

// 1. Define MCP server for Aave interactions
const aaveTools = new MCPToolset({
  serverName: "aave-protocol-server",
  transport: new StreamableHTTPServerTransport({
    endpoint: process.env.AAVE_MCP_SERVER_URL
  }),
  tools: [
    "getPoolData",
    "calculateBorrowRate", 
    "depositCollateral",
    "borrowAsset"
  ]
});

// 2. Register with agent
const executorAgent = new Agent({
  name: "ExecutorAgent",
  tools: [aaveTools], // All MCP tools available
  model: "gpt-4o"
});
```

**MCP Benefits**:
- Standardized tool interface
- Server-side tool execution (better security)
- Easy to version and update tools
- Built-in error handling via MCP protocol

#### **Direct Tool Integration**

```typescript
// Alternative: Direct tool definition
import { Tool } from '@iqai/adk';
import { z } from 'zod';

const depositToAaveTool = new Tool({
  name: "depositToAave",
  description: "Deposit collateral to Aave lending pool",
  parameters: z.object({
    asset: z.string(),
    amount: z.string(),
    onBehalfOf: z.string().optional()
  }),
  execute: async ({ asset, amount, onBehalfOf }) => {
    // Direct blockchain interaction
    const contract = new ethers.Contract(AAVE_POOL_ADDRESS, ABI);
    const tx = await contract.supply(asset, amount, onBehalfOf || userAddress, 0);
    return { txHash: tx.hash, status: 'submitted' };
  }
});
```

### **Recommendation for Rogue**

**MCP Architecture for Production**:

```typescript
// Architecture: Agent → MCP Client → MCP Servers → Blockchain

// 1. Aave MCP Server
const aaveMCP = new MCPToolset({
  serverName: "rogue-aave-server",
  transport: streamableHTTP(AAVE_MCP_URL),
  tools: [
    "getMarketData",      // Read-only
    "depositCollateral",  // Write
    "borrowAsset",        // Write
    "repayDebt"          // Write
  ]
});

// 2. Morpho MCP Server  
const morphoMCP = new MCPToolset({
  serverName: "rogue-morpho-server",
  transport: streamableHTTP(MORPHO_MCP_URL),
  tools: [
    "getVaultAPY",
    "deposit",
    "withdraw",
    "rebalance"
  ]
});

// 3. Data Provider MCP (CoinGecko, DeFi Llama)
const dataMCP = new MCPToolset({
  serverName: "rogue-data-server",
  tools: ["getPrices", "getTVL", "getHistoricalRates"]
});

// 4. Register with agents
const researcherAgent = new Agent({
  tools: [aaveMCP, morphoMCP, dataMCP], // Read-only tools
});

const executorAgent = new Agent({
  tools: [aaveMCP, morphoMCP], // Write tools
});
```

**Tool Design Patterns**:

```typescript
// Pattern 1: Read-only data tools (Researcher)
{
  name: "getAavePoolData",
  cacheable: true,         // Cache for 60s
  retryStrategy: "exponential",
  timeout: 5000
}

// Pattern 2: Write tools with simulation (Executor)
{
  name: "depositToAave",
  requiresSimulation: true, // Test on fork first
  gasEstimation: true,
  confirmations: 1
}

// Pattern 3: Validation tools (Governor)
{
  name: "validatePosition",
  local: true,             // No external call
  schema: strictRiskSchema
}
```

---

## 5. OpenAI Integration Patterns

### ADK-TS Multi-Provider Support

```typescript
// ADK-TS supports: OpenAI, Anthropic, Google, local models

// Option 1: OpenAI for all agents
const researcherAgent = new Agent({
  model: "gpt-4o",              // Fast for data processing
  apiKey: process.env.OPENAI_API_KEY
});

const analyzerAgent = new Agent({
  model: "o1-preview",          // Best reasoning for risk
  apiKey: process.env.OPENAI_API_KEY  
});

// Option 2: Mixed providers
const governorAgent = new Agent({
  model: "claude-3.5-sonnet",   // Anthropic for validation
  apiKey: process.env.ANTHROPIC_API_KEY
});
```

### **Recommendation for Rogue**

**Multi-Model Strategy**:

```typescript
// Agent-specific model selection
const ROGUE_MODELS = {
  researcher: "gpt-4o",           // Fast data aggregation
  analyzer: "o1-preview",         // Deep reasoning for risk
  executor: "gpt-4o",             // Fast transaction building  
  governor: "claude-3.5-sonnet"   // Strong validation logic
};

const rogueWorkflow = new SequentialAgent({
  subAgents: [
    new Agent({
      name: "ResearcherAgent",
      model: ROGUE_MODELS.researcher,
      temperature: 0.3,  // Factual data gathering
      tools: [dataMCP, aaveMCP, morphoMCP]
    }),
    
    new Agent({
      name: "AnalyzerAgent", 
      model: ROGUE_MODELS.analyzer,
      temperature: 0,    // Deterministic risk calculation
      systemPrompt: RISK_ANALYSIS_PROMPT
    }),
    
    new Agent({
      name: "ExecutorAgent",
      model: ROGUE_MODELS.executor,
      temperature: 0,    // Precise transaction building
      tools: [aaveMCP, morphoMCP]
    }),
    
    new Agent({
      name: "GovernorAgent",
      model: ROGUE_MODELS.governor,
      temperature: 0,    // Strict validation
      systemPrompt: GOVERNANCE_RULES_PROMPT
    })
  ]
});
```

**Cost Optimization**:
- Researcher: GPT-4o ($2.50/$10.00 per 1M tokens) - Fast, cheap
- Analyzer: o1-preview ($15/$60 per 1M tokens) - Worth it for risk accuracy
- Executor: GPT-4o - Fast transaction building
- Governor: Claude 3.5 Sonnet ($3/$15 per 1M tokens) - Strong reasoning

---

## 6. Multi-Agent Orchestration for Rogue

### Workflow Architecture

```typescript
// Researcher → Analyzer → Executor → Governor

import { SequentialAgent, Agent } from '@iqai/adk';

// 1. Researcher Agent
const researcherAgent = new Agent({
  name: "ResearcherAgent",
  description: "Gather DeFi market data, rates, and liquidity",
  model: "gpt-4o",
  instruction: `
    1. Fetch current Aave supply/borrow rates
    2. Get Morpho vault APYs and capacity
    3. Retrieve asset prices and volatility
    4. Output structured market snapshot
  `,
  tools: [dataMCP, aaveMCP, morphoMCP],
  outputKey: "market_data"  // Writes to session.state.market_data
});

// 2. Analyzer Agent  
const analyzerAgent = new Agent({
  name: "AnalyzerAgent",
  description: "Calculate optimal positions with risk management",
  model: "o1-preview",
  instruction: `
    Input: session.state.market_data
    
    1. Calculate max safe leverage for each protocol
    2. Determine optimal position sizes
    3. Compute expected yield and risk metrics
    4. Output risk_assessment and position_plan
  `,
  tools: [], // Pure calculation, no external calls
  outputKey: "position_plan"
});

// 3. Executor Agent
const executorAgent = new Agent({
  name: "ExecutorAgent", 
  description: "Build and simulate transactions",
  model: "gpt-4o",
  instruction: `
    Input: session.state.position_plan
    
    1. Build multicall transaction batch
    2. Simulate on Tenderly fork
    3. Estimate gas and validate slippage
    4. Output execution_plan with tx data
  `,
  tools: [aaveMCP, morphoMCP, tenderlySimulationTool],
  outputKey: "execution_plan"
});

// 4. Governor Agent
const governorAgent = new Agent({
  name: "GovernorAgent",
  description: "Validate execution plan against risk limits",
  model: "claude-3.5-sonnet",
  instruction: `
    Input: session.state.execution_plan
    
    1. Verify position sizes within risk limits
    2. Check protocol exposure diversification
    3. Validate liquidation thresholds
    4. Approve or request re-analysis with adjustments
  `,
  tools: [riskValidationTool],
  outputKey: "final_decision"
});

// 5. Orchestrate with Sequential Workflow
const rogueYieldWorkflow = new SequentialAgent({
  name: "RogueYieldWorkflow",
  description: "End-to-end yield optimization with risk management",
  subAgents: [
    researcherAgent,
    analyzerAgent, 
    executorAgent,
    governorAgent
  ]
});

// 6. Execute workflow
const app = new App({
  name: "rogue-yield-agent",
  rootAgent: rogueYieldWorkflow,
  plugins: [
    ReflectAndRetryToolPlugin({ maxRetries: 3 }),
    EventLoggerPlugin()
  ]
});

const result = await app.runAgent({
  userMessage: "Optimize my vault for max yield with moderate risk",
  sessionId: "user_vault_0x123"
});
```

### State Flow Example

```typescript
// Execution trace with shared state:

1. ResearcherAgent executes
   session.state.market_data = {
     aave: { supplyAPY: 0.02, borrowAPY: 0.04, liquidity: 10M },
     morpho: { vaultAPY: 0.06, capacity: 5M },
     prices: { ETH: 2000, USDC: 1.00 }
   }

2. AnalyzerAgent reads session.state.market_data
   session.state.position_plan = {
     aave_supply: { asset: "USDC", amount: 100000 },
     aave_borrow: { asset: "USDC", amount: 50000, ltv: 0.5 },
     morpho_deposit: { asset: "USDC", amount: 50000 },
     expected_apy: 0.08,
     liquidation_price: 1600
   }

3. ExecutorAgent reads session.state.position_plan
   session.state.execution_plan = {
     transactions: [
       { to: AAVE_POOL, data: "0x617ba...", gasEstimate: 150000 },
       { to: MORPHO_VAULT, data: "0x8a91c...", gasEstimate: 200000 }
     ],
     simulation_result: "SUCCESS",
     total_gas_usd: 12.50
   }

4. GovernorAgent reads session.state.execution_plan
   session.state.final_decision = {
     approved: true,
     risk_score: 6.5,
     warnings: [],
     ready_to_execute: true
   }
```

---

## Recommendations Summary

### 1. Communication Architecture

**Decision**: **Shared State via Sequential Agent**

```typescript
const rogueWorkflow = new SequentialAgent({
  subAgents: [researcher, analyzer, executor, governor]
});
// Automatic state sharing via session.state
```

**Alternatives Rejected**:
- Event-driven: Too complex for linear pipeline
- Message passing: Redundant with ADK's state management

### 2. Error Handling Strategy

**Decision**: **Three-Layer Approach**

1. **Tool-level**: Custom retry with exponential backoff
2. **Agent-level**: ReflectAndRetryToolPlugin (LLM-powered correction)
3. **Workflow-level**: Governor validation with re-run capability

**Implementation**:
```typescript
plugins: [
  ReflectAndRetryToolPlugin({ maxRetries: 3 })
]
```

### 3. State Persistence Approach

**Decision**: **Hybrid PostgreSQL + Redis**

- **PostgreSQL**: Session state, user preferences (persistent)
- **Redis**: Workflow checkpoints (1-hour TTL)
- **In-Memory**: Development only

**Schema**:
```sql
-- sessions table
CREATE TABLE adk_sessions (
  id UUID PRIMARY KEY,
  user_address TEXT,
  state JSONB,
  memory JSONB,
  updated_at TIMESTAMP
);

-- checkpoints table  
CREATE TABLE workflow_checkpoints (
  workflow_id UUID PRIMARY KEY,
  completed_agents TEXT[],
  session_state JSONB,
  created_at TIMESTAMP
);
```

### 4. Tool Registration Patterns

**Decision**: **MCP Architecture**

```typescript
// Three MCP servers:
- rogue-aave-server    (Aave pool interactions)
- rogue-morpho-server  (Morpho vault interactions)
- rogue-data-server    (Price feeds, analytics)

// Register with agents:
researcherAgent.tools = [aaveMCP, morphoMCP, dataMCP]
executorAgent.tools = [aaveMCP, morphoMCP, simulationMCP]
```

**Benefits**:
- Standardized interface
- Easy to mock for testing
- Version control for tools
- Deploy MCP servers on Cloud Run

### 5. Implementation Notes

#### Project Structure
```
rogue-yield-agent/
├── src/
│   ├── agents/
│   │   ├── researcher.ts       # Market data gathering
│   │   ├── analyzer.ts         # Risk calculations
│   │   ├── executor.ts         # Transaction building
│   │   └── governor.ts         # Validation logic
│   ├── tools/
│   │   ├── mcp-servers/
│   │   │   ├── aave/           # Aave MCP server
│   │   │   ├── morpho/         # Morpho MCP server
│   │   │   └── data/           # Data provider MCP
│   │   └── custom/
│   │       └── simulation.ts   # Tenderly fork testing
│   ├── workflows/
│   │   └── yield-optimization.ts  # Sequential workflow
│   ├── persistence/
│   │   ├── session-store.ts    # PostgreSQL sessions
│   │   └── checkpoint.ts       # Redis checkpoints
│   └── index.ts                # App entry point
├── .env
└── package.json
```

#### Key Dependencies
```json
{
  "dependencies": {
    "@iqai/adk": "^0.5.6",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "ethers": "^6.0.0",
    "zod": "^3.22.0",
    "pg": "^8.11.0",
    "redis": "^4.6.0"
  }
}
```

#### Configuration Example
```typescript
// config.ts
export const ROGUE_CONFIG = {
  models: {
    researcher: "gpt-4o",
    analyzer: "o1-preview",
    executor: "gpt-4o", 
    governor: "claude-3.5-sonnet"
  },
  
  errorHandling: {
    maxRetries: 3,
    backoffMultiplier: 2,
    throwOnExceeded: true
  },
  
  persistence: {
    sessionStore: "postgresql",
    checkpointStore: "redis",
    checkpointTTL: 3600
  },
  
  mcpServers: {
    aave: process.env.AAVE_MCP_URL,
    morpho: process.env.MORPHO_MCP_URL,
    data: process.env.DATA_MCP_URL
  }
};
```

---

## Production Readiness Checklist

### ADK-TS Framework Advantages
✅ **Production-ready**: Built for production use (unlike experimental frameworks)  
✅ **TypeScript-native**: Full type safety and IDE support  
✅ **Multi-provider LLMs**: OpenAI, Anthropic, Google, local models  
✅ **Built-in retry**: ReflectAndRetryToolPlugin with LLM reflection  
✅ **State management**: Session, long-term memory, custom backends  
✅ **MCP integration**: Standardized tool protocol  
✅ **Active development**: Released July 2025, regular updates  

### Rogue-Specific Requirements
✅ **Sequential pipeline**: SequentialAgent perfect fit  
✅ **Blockchain tools**: MCP architecture supports Aave/Morpho  
✅ **Error handling**: Three-layer strategy covers all failure modes  
✅ **State persistence**: PostgreSQL + Redis for production  
✅ **Multi-model support**: Optimize cost/performance per agent  

### Next Steps
1. **Week 1**: Setup ADK-TS project with basic workflow
2. **Week 2**: Implement MCP servers for Aave/Morpho
3. **Week 3**: Build Researcher + Analyzer agents
4. **Week 4**: Build Executor + Governor agents
5. **Week 5**: Integration testing with Tenderly forks
6. **Week 6**: Production deployment on Cloud Run

---

## References

- **ADK-TS GitHub**: https://github.com/IQAIcom/adk-ts
- **ADK-TS Docs**: https://adk.iqai.com/docs/framework/agents
- **MCP Protocol**: https://modelcontextprotocol.io/
- **Workflow Patterns**: https://adk.iqai.com/docs/framework/agents/workflow-agents
- **State Management**: https://google.github.io/adk-docs/sessions/
- **Error Handling**: https://google.github.io/adk-docs/plugins/reflect-and-retry/

---

**Document Status**: Production Research Complete  
**Author**: GitHub Copilot  
**Date**: 2025-11-16  
**Version**: 1.0
