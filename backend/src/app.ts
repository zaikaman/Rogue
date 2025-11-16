/**
 * ADK-TS Application Framework Setup
 * 
 * This file will contain the ADK-TS multi-agent orchestration framework
 * implementing the Researcher → Analyzer → Executor → Governor workflow
 * 
 * Note: ADK-TS is a conceptual framework. This implementation uses
 * OpenAI SDK with structured agent patterns.
 */

import { logger } from '../utils/logger.js';
import { openai } from '../utils/openai.js';

/**
 * Base Agent interface
 */
export interface Agent {
  name: string;
  execute(input: any): Promise<any>;
}

/**
 * Agent execution context
 */
export interface AgentContext {
  positionId?: string;
  walletAddress?: string;
  metadata?: Record<string, any>;
}

/**
 * Sequential workflow orchestrator
 */
export class SequentialWorkflow {
  private agents: Agent[] = [];
  
  constructor(private name: string) {}
  
  addAgent(agent: Agent): this {
    this.agents.push(agent);
    return this;
  }
  
  async execute(initialInput: any, context: AgentContext = {}): Promise<any> {
    logger.info(`Starting workflow: ${this.name}`, { context });
    
    let currentInput = initialInput;
    const results: Record<string, any> = {};
    
    for (const agent of this.agents) {
      try {
        const startTime = Date.now();
        
        logger.info(`Executing agent: ${agent.name}`);
        const output = await agent.execute(currentInput);
        
        const executionTime = Date.now() - startTime;
        logger.info(`Agent completed: ${agent.name}`, {
          executionTime,
          success: true,
        });
        
        results[agent.name] = output;
        currentInput = output; // Pass output to next agent
        
      } catch (error) {
        logger.error(`Agent failed: ${agent.name}`, {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }
    
    logger.info(`Workflow completed: ${this.name}`);
    return results;
  }
}

/**
 * Base agent class with OpenAI integration
 */
export abstract class BaseAgent implements Agent {
  constructor(public name: string) {}
  
  abstract execute(input: any): Promise<any>;
  
  /**
   * Call OpenAI with structured prompt
   */
  protected async callLLM(
    systemPrompt: string,
    userPrompt: string,
    options?: { responseFormat?: 'json' | 'text' }
  ): Promise<any> {
    try {
      if (options?.responseFormat === 'json') {
        return await openai.generateStructuredOutput(userPrompt, systemPrompt);
      } else {
        const response = await openai.createChatCompletion([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ]);
        
        return response.choices[0]?.message?.content || '';
      }
    } catch (error) {
      logger.error(`LLM call failed in ${this.name}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

/**
 * Initialize ADK-TS framework
 */
export function initializeADK() {
  logger.info('ADK-TS framework initialized');
  
  // Validate OpenAI configuration
  try {
    openai.getClient();
  } catch (error) {
    logger.error('Failed to initialize OpenAI client', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error('ADK-TS requires OpenAI configuration. Check OPENAI_API_KEY in .env');
  }
}

export default {
  SequentialWorkflow,
  BaseAgent,
  initializeADK,
};
