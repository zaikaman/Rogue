import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../utils/constants.js';
import { logger } from '../utils/logger.js';

let supabaseClient: SupabaseClient | null = null;

/**
 * Initialize Supabase client with Row Level Security
 * Uses service role key for backend operations
 */
export function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = config.SUPABASE_URL;
  const supabaseKey = config.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not configured. Check environment variables.');
  }

  supabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  logger.info('Supabase client initialized');
  return supabaseClient;
}

/**
 * Database interfaces matching schema.sql
 */

export interface Position {
  id: string;
  wallet_address: string;
  token: 'USDC' | 'KRWQ';
  amount: string;
  risk_profile: 'low' | 'medium' | 'high';
  status: 'active' | 'paused' | 'closed';
  created_at: string;
  updated_at: string;
  last_action_at?: string;
}

export interface TransactionRecord {
  id: string;
  position_id: string;
  wallet_address: string;
  tx_hash: string;
  type: 'stake' | 'unstake' | 'compound' | 'claim' | 'rebalance';
  status: 'pending' | 'confirmed' | 'failed';
  gas_cost?: string;
  notes?: string;
  created_at: string;
  confirmed_at?: string;
}

export interface YieldHistory {
  id: string;
  position_id: string;
  protocol: string;
  apy: string;
  timestamp: string;
}

export interface AgentLog {
  id: string;
  agent_name: 'researcher' | 'analyzer' | 'executor' | 'governor';
  position_id?: string;
  action: string;
  input_data?: Record<string, any>;
  output_data?: Record<string, any>;
  success: boolean;
  error_message?: string;
  execution_time_ms?: number;
  created_at: string;
}

export interface Strategy {
  id: string;
  position_id: string;
  risk_profile: 'low' | 'medium' | 'high';
  allocation: Record<string, number>;
  expected_apy: string;
  rationale?: string;
  created_at: string;
  active: boolean;
}

/**
 * Helper functions for database operations
 */

export async function createPosition(position: Omit<Position, 'id' | 'created_at' | 'updated_at'>) {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('positions')
    .insert([{ ...position, wallet_address: position.wallet_address.toLowerCase() }])
    .select()
    .single();

  if (error) {
    logger.error('Failed to create position', { error: error.message });
    throw error;
  }

  return data as Position;
}

export async function getPositionsByWallet(walletAddress: string) {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('positions')
    .select('*')
    .eq('wallet_address', walletAddress.toLowerCase())
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Failed to fetch positions', { error: error.message });
    throw error;
  }

  return data as Position[];
}

export async function getPositionById(id: string) {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('positions')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    logger.error('Failed to fetch position', { error: error.message });
    throw error;
  }

  return data as Position;
}

export async function updatePosition(id: string, updates: Partial<Position>) {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('positions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error('Failed to update position', { error: error.message });
    throw error;
  }

  return data as Position;
}

export async function createTransactionRecord(
  record: Omit<TransactionRecord, 'id' | 'created_at'>
) {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('transaction_records')
    .insert([{ ...record, wallet_address: record.wallet_address.toLowerCase() }])
    .select()
    .single();

  if (error) {
    logger.error('Failed to create transaction record', { error: error.message });
    throw error;
  }

  return data as TransactionRecord;
}

export async function logAgentExecution(log: Omit<AgentLog, 'id' | 'created_at'>) {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('agent_logs')
    .insert([log])
    .select()
    .single();

  if (error) {
    logger.error('Failed to log agent execution', { error: error.message });
    throw error;
  }

  return data as AgentLog;
}

export const supabase = {
  getClient: getSupabaseClient,
  createPosition,
  getPositionsByWallet,
  getPositionById,
  updatePosition,
  createTransactionRecord,
  logAgentExecution,
};
