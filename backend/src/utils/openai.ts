import OpenAI from 'openai';
import { config } from './constants.js';
import { logger } from './logger.js';

let openaiClient: OpenAI | null = null;

/**
 * Initialize and return OpenAI client
 * Configured via environment variables:
 * - OPENAI_API_KEY
 * - OPENAI_BASE_URL
 * - OPENAI_MODEL
 */
export function getOpenAIClient(): OpenAI {
  if (openaiClient) {
    return openaiClient;
  }

  const apiKey = config.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured. Required for ADK-TS agents.');
  }

  openaiClient = new OpenAI({
    apiKey,
    baseURL: config.OPENAI_BASE_URL,
  });

  logger.info('OpenAI client initialized', {
    baseURL: config.OPENAI_BASE_URL,
    model: config.OPENAI_MODEL,
  });

  return openaiClient;
}

/**
 * Create a chat completion using configured model
 */
export async function createChatCompletion(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  options?: Partial<OpenAI.Chat.ChatCompletionCreateParams>
) {
  const client = getOpenAIClient();
  
  const response = await client.chat.completions.create({
    model: config.OPENAI_MODEL,
    messages,
    ...options,
  });

  return response;
}

/**
 * Generate structured output with JSON mode
 */
export async function generateStructuredOutput<T = any>(
  prompt: string,
  systemPrompt?: string
): Promise<T> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  
  messages.push({ role: 'user', content: prompt });

  const response = await createChatCompletion(messages, {
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  
  if (!content) {
    throw new Error('No content in OpenAI response');
  }

  return JSON.parse(content) as T;
}

export const openai = {
  getClient: getOpenAIClient,
  createChatCompletion,
  generateStructuredOutput,
};

export default openai;
