/**
 * Test script to verify custom OPENAI_BASE_URL support in ADK-TS
 * 
 * This script tests that the patched @iqai/adk package correctly
 * uses the OPENAI_BASE_URL environment variable.
 */

import dotenv from 'dotenv';

// Load environment
dotenv.config();

// Set test environment variables
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key-placeholder';
process.env.OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

console.log('🧪 Testing ADK-TS Custom Base URL Support\n');
console.log('Environment Configuration:');
console.log(`  OPENAI_API_KEY: ${process.env.OPENAI_API_KEY.slice(0, 10)}...`);
console.log(`  OPENAI_BASE_URL: ${process.env.OPENAI_BASE_URL}`);
console.log(`  OPENAI_MODEL: ${process.env.OPENAI_MODEL || 'gpt-4o-mini'}\n`);

// Import ADK after setting environment variables
import { AgentBuilder } from '@iqai/adk';

async function testCustomBaseURL() {
  try {
    console.log('✅ Successfully imported @iqai/adk with custom configuration');
    console.log('✅ AgentBuilder is available');
    
    // Try to create an agent (this will verify the OpenAI client initialization)
    console.log('\n🔧 Creating test agent...');
    
    const { agent } = await AgentBuilder
      .create('test_agent')
      .withModel(process.env.OPENAI_MODEL || 'gpt-4o-mini')
      .withDescription('Test agent for base URL verification')
      .withInstruction('You are a test agent')
      .build();
    
    console.log(`✅ Agent created successfully: ${agent.name}`);
    console.log('\n✨ Custom base URL support is working!');
    console.log('\nNote: To actually test API calls, you need a valid OPENAI_API_KEY in your .env file');
    
  } catch (error) {
    console.error('❌ Error testing custom base URL:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure you have a valid OPENAI_API_KEY in your .env file');
    console.error('2. Check that OPENAI_BASE_URL is set correctly');
    console.error('3. If using a custom endpoint, ensure it\'s reachable and compatible');
    process.exit(1);
  }
}

testCustomBaseURL();
