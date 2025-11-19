# Research: Supabase Row Level Security for Wallet-Based Authentication

**Date**: November 16, 2025  
**Status**: ✅ Completed  
**Decision**: Use Supabase native Web3 auth with custom RLS policies for wallet-based data isolation

---

## Executive Summary

**DECISION**: Implement Supabase's native SIWE (Sign-In with Ethereum) authentication combined with carefully designed RLS policies for wallet-based data isolation in Rogue.

**RATIONALE**:
- Native Web3 support via `signInWithWeb3()` eliminates custom JWT signing complexity
- RLS provides database-level defense-in-depth even if API keys are compromised
- Wallet addresses as primary identifiers align with Web3-native UX
- Performance optimizations (indexed policies, security definer functions) prevent RLS overhead
- Multi-wallet support via linking table enables flexible user experience

**IMPLEMENTATION NOTES**:
- Use Supabase's built-in SIWE for signature verification
- Store wallet addresses in lowercase/checksummed format for consistency
- Index all columns used in RLS policies (wallet_address, user_id)
- Wrap `auth.uid()` calls in `(select ...)` for performance
- Encrypt sensitive data at application layer before storage (risk profiles, API keys)
- Use security definer functions for complex RLS checks

---

## 1. RLS Policy Patterns for Wallet Address Authentication

### Architecture Overview

```
User → Signs SIWE Message → Supabase Auth → JWT with auth.uid()
                                              ↓
                                    RLS Policies Check
                                              ↓
                                    Data Access Granted
```

### Core Pattern: User-Owned Data

```sql
-- Enable RLS on all tables
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_history ENABLE ROW LEVEL SECURITY;

-- Positions table: users can only read/write their own positions
CREATE POLICY "Users can view own positions"
ON positions FOR SELECT
TO authenticated
USING (
  (SELECT auth.uid()) = user_id
);

CREATE POLICY "Users can insert own positions"
ON positions FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = user_id
);

CREATE POLICY "Users can update own positions"
ON positions FOR UPDATE
TO authenticated
USING (
  (SELECT auth.uid()) = user_id
)
WITH CHECK (
  (SELECT auth.uid()) = user_id
);

CREATE POLICY "Users can delete own positions"
ON positions FOR DELETE
TO authenticated
USING (
  (SELECT auth.uid()) = user_id
);
```

### Key Insights from Research

1. **Always wrap `auth.uid()` in SELECT**: `(SELECT auth.uid())` instead of `auth.uid()` for 57-61% performance improvement
2. **Explicit NULL checks**: Add `auth.uid() IS NOT NULL` to prevent silent failures for unauthenticated users
3. **Separate USING and WITH CHECK**: `USING` checks existing data, `WITH CHECK` validates new data

### Advanced Pattern: Multi-Table Joins

```sql
-- For queries joining user_wallets to positions
CREATE POLICY "Users can view positions linked to their wallets"
ON positions FOR SELECT
TO authenticated
USING (
  user_id IN (SELECT get_user_wallet_ids())
);

-- Security definer function to avoid nested RLS overhead
CREATE OR REPLACE FUNCTION get_user_wallet_ids()
RETURNS TABLE(wallet_user_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER -- Runs as function creator, bypasses RLS on user_wallets
AS $$
BEGIN
  RETURN QUERY
  SELECT user_id
  FROM user_wallets
  WHERE (SELECT auth.uid()) = user_id;
END;
$$;
```

**Why Security Definer**: Avoids RLS policy evaluation on join tables, reducing query complexity from O(n²) to O(n).

---

## 2. Encryption Strategies for Sensitive User Data

### Supabase Encryption Layers

| Layer | Provider | Coverage | Use Case |
|-------|----------|----------|----------|
| **In-Transit** | Supabase (TLS 1.3) | All API requests | Automatic |
| **At-Rest** | Supabase (AES-256) | Database files | Automatic |
| **Application-Layer** | Client-side | Sensitive fields | Manual |

### What to Encrypt at Application Layer

```typescript
// Sensitive fields requiring app-layer encryption
interface EncryptedUserData {
  risk_profile: string;        // Encrypted: Contains leverage preferences
  api_keys: string;            // Encrypted: Third-party integrations
  wallet_private_metadata: string; // Encrypted: Notes, labels
}

// Non-sensitive fields (use Supabase defaults)
interface PlainUserData {
  wallet_address: string;      // Public on-chain anyway
  total_positions: number;     // Aggregate stats
  last_login: timestamp;       // Metadata
}
```

### Recommended Encryption Flow

```typescript
// Using Web Crypto API (browser-native)
import { SupabaseClient } from '@supabase/supabase-js';

// 1. Derive encryption key from user's wallet signature
async function deriveEncryptionKey(walletAddress: string, signature: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signature),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(walletAddress), // Use wallet as salt
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// 2. Encrypt before storing
async function encryptData(data: string, key: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(data)
  );
  
  // Concatenate IV + encrypted data, encode as base64
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

// 3. Store encrypted data
async function saveRiskProfile(supabase: SupabaseClient, profile: any, encryptionKey: CryptoKey) {
  const encrypted = await encryptData(JSON.stringify(profile), encryptionKey);
  
  const { data, error } = await supabase
    .from('risk_profiles')
    .insert({
      user_id: (await supabase.auth.getUser()).data.user?.id,
      encrypted_profile: encrypted,
      updated_at: new Date().toISOString()
    });
}
```

### Key Management Strategy

**DO**:
- Derive keys from wallet signatures (never store raw keys)
- Use wallet address as salt for key derivation
- Re-encrypt data if user changes primary wallet

**DON'T**:
- Store encryption keys in Supabase
- Use same key for all users
- Encrypt non-sensitive public data (overhead without benefit)

---

## 3. Wallet Signature Verification Flow

### Supabase Native SIWE Implementation

```typescript
import { createClient } from '@supabase/supabase-js';
import { SiweMessage } from 'siwe';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Step 1: Generate nonce
async function generateNonce(): Promise<string> {
  const { data, error } = await supabase.auth.signInWithWeb3({
    provider: 'ethereum',
    options: {
      // This returns a nonce without completing auth
      skipBrowserRedirect: true
    }
  });
  
  return data?.nonce || crypto.randomUUID();
}

// Step 2: Create SIWE message
async function createSiweMessage(walletAddress: string, nonce: string): Promise<string> {
  const message = new SiweMessage({
    domain: window.location.host,
    address: walletAddress,
    statement: 'Sign in to Rogue Yield Agent',
    uri: window.location.origin,
    version: '1',
    chainId: 1, // Ethereum mainnet
    nonce: nonce,
    issuedAt: new Date().toISOString(),
    expirationTime: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 min
  });
  
  return message.prepareMessage();
}

// Step 3: Sign with wallet (MetaMask/WalletConnect)
async function signMessage(message: string, provider: any): Promise<string> {
  const signer = provider.getSigner();
  return await signer.signMessage(message);
}

// Step 4: Verify and authenticate with Supabase
async function authenticateWithWallet(walletAddress: string, signature: string, message: string) {
  const { data, error } = await supabase.auth.signInWithWeb3({
    provider: 'ethereum',
    options: {
      address: walletAddress,
      signature: signature,
      message: message
    }
  });
  
  if (error) throw error;
  
  // Supabase automatically:
  // 1. Verifies signature cryptographically
  // 2. Checks nonce hasn't been used (replay protection)
  // 3. Validates message expiration
  // 4. Issues JWT with auth.uid()
  
  return data.session;
}
```

### Edge Function for Custom Verification (If Needed)

```typescript
// supabase/functions/verify-wallet/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyMessage } from 'https://esm.sh/ethers@6';

serve(async (req) => {
  const { walletAddress, signature, message } = await req.json();
  
  try {
    // Verify signature
    const recoveredAddress = verifyMessage(message, signature);
    
    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401 }
      );
    }
    
    // Verify message structure (SIWE format)
    const siweMessage = new SiweMessage(message);
    await siweMessage.validate();
    
    // Check nonce freshness (prevent replay)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! // Service key for admin ops
    );
    
    const { data: existingNonce } = await supabase
      .from('used_nonces')
      .select('nonce')
      .eq('nonce', siweMessage.nonce)
      .single();
    
    if (existingNonce) {
      return new Response(
        JSON.stringify({ error: 'Nonce already used' }),
        { status: 401 }
      );
    }
    
    // Mark nonce as used
    await supabase
      .from('used_nonces')
      .insert({ nonce: siweMessage.nonce, used_at: new Date() });
    
    // Create/update user
    const { data: user } = await supabase.auth.admin.createUser({
      email: `${walletAddress.toLowerCase()}@wallet.local`, // Dummy email
      email_confirm: true,
      user_metadata: {
        wallet_address: walletAddress.toLowerCase()
      }
    });
    
    // Generate session token
    const { data: session } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email!
    });
    
    return new Response(
      JSON.stringify({ session }),
      { status: 200 }
    );
    
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
});
```

**When to use Edge Functions**:
- Need custom nonce generation logic
- Integrate non-SIWE wallet types (Solana, Cosmos)
- Add rate limiting per wallet
- Custom session duration/refresh logic

---

## 4. Performance Implications of RLS

### Benchmark Results (From Research)

| Optimization | Before | After | Improvement |
|--------------|--------|-------|-------------|
| Add B-tree index on `user_id` | 171ms | <0.1ms | **99.94%** |
| Wrap `auth.uid()` in SELECT | 100ms | 43ms | **57%** |
| Use security definer functions | 85ms | 36ms | **58%** |

### Index Strategy for Rogue

```sql
-- 1. Indexes for RLS policy columns
CREATE INDEX idx_positions_user_id ON positions USING btree(user_id);
CREATE INDEX idx_risk_profiles_user_id ON risk_profiles USING btree(user_id);
CREATE INDEX idx_tx_history_user_id ON transaction_history USING btree(user_id);

-- 2. Composite indexes for common queries
CREATE INDEX idx_positions_user_status ON positions(user_id, status)
WHERE status IN ('active', 'pending'); -- Partial index for filtered queries

CREATE INDEX idx_tx_history_user_date ON transaction_history(user_id, created_at DESC);

-- 3. Covering indexes (include frequently selected columns)
CREATE INDEX idx_positions_user_cover ON positions(user_id)
INCLUDE (protocol, collateral_amount, debt_amount, health_factor);
```

### Query Optimization Patterns

**❌ SLOW**: Nested subquery in RLS
```sql
CREATE POLICY "slow_policy" ON positions
USING (
  auth.uid() IN (
    SELECT user_id FROM team_members WHERE team_members.team_id = positions.team_id
  )
);
-- Problem: Executes subquery for EVERY row
```

**✅ FAST**: Flip the join direction
```sql
CREATE POLICY "fast_policy" ON positions
USING (
  team_id IN (
    SELECT team_id FROM team_members WHERE user_id = (SELECT auth.uid())
  )
);
-- Better: Subquery executes once, builds team_id list
```

**✅ FASTEST**: Security definer function
```sql
CREATE FUNCTION get_user_teams()
RETURNS TABLE(team_id UUID)
LANGUAGE sql
SECURITY DEFINER
STABLE -- Cacheable within transaction
AS $$
  SELECT team_id FROM team_members WHERE user_id = auth.uid();
$$;

CREATE POLICY "fastest_policy" ON positions
USING (
  team_id IN (SELECT get_user_teams())
);
-- Best: Cached function result, no RLS overhead on team_members
```

### Performance Monitoring

```sql
-- Check if indexes are being used
EXPLAIN ANALYZE
SELECT * FROM positions WHERE user_id = 'some-uuid';

-- Should show "Index Scan using idx_positions_user_id"
-- NOT "Seq Scan on positions"

-- Monitor RLS policy execution time
SELECT 
  schemaname,
  tablename,
  policyname,
  pg_size_pretty(pg_relation_size(schemaname || '.' || tablename)) as table_size
FROM pg_policies
JOIN pg_class ON pg_class.relname = tablename
WHERE schemaname = 'public';
```

---

## 5. Common Security Pitfalls and Avoidance

### Critical Pitfalls from Research

#### 1. **RLS Not Enabled**
**Pitfall**: Table accessible to all users
```sql
-- ❌ DANGER: No RLS
CREATE TABLE positions (...);
-- Anyone with anon key can read ALL positions
```

**Fix**: Always enable RLS immediately
```sql
-- ✅ SAFE
CREATE TABLE positions (...);
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
-- Default deny until policies added
```

#### 2. **Service Key Exposure**
**Pitfall**: Service key in client-side code bypasses all RLS
```typescript
// ❌ DANGER: Service key in browser
const supabase = createClient(URL, SERVICE_ROLE_KEY); // Exposes full DB access
```

**Fix**: Only use service keys in Edge Functions/backend
```typescript
// ✅ SAFE
const supabase = createClient(URL, ANON_KEY); // Client-side
// Service key only in: supabase/functions/* (Edge Functions)
```

#### 3. **NULL auth.uid() Silent Failures**
**Pitfall**: Unauthenticated users get no data, no error
```sql
-- ❌ CONFUSING: Returns nothing if not logged in
CREATE POLICY "implicit_auth" ON positions
USING (auth.uid() = user_id);
-- auth.uid() = NULL when not authenticated, always false
```

**Fix**: Explicit authentication check
```sql
-- ✅ CLEAR: Explicit requirement
CREATE POLICY "explicit_auth" ON positions
TO authenticated -- Only applies to logged-in users
USING (
  (SELECT auth.uid()) IS NOT NULL 
  AND (SELECT auth.uid()) = user_id
);
```

#### 4. **IDOR via UUID Enumeration**
**Pitfall**: Attacker queries all UUIDs using `gt` operator
```http
GET /rest/v1/positions?user_id=gt.00000000-0000-0000-0000-000000000000
# Without RLS, returns ALL positions
```

**Fix**: RLS automatically prevents this (if enabled)
```sql
-- With proper RLS, query filtered to current user only
-- Attacker only sees their own data regardless of query params
```

#### 5. **MFA Bypass**
**Pitfall**: MFA enabled but not enforced in RLS
```sql
-- ❌ WEAK: Anyone authenticated can access
CREATE POLICY "no_mfa_check" ON sensitive_data
TO authenticated
USING ((SELECT auth.uid()) = user_id);
```

**Fix**: Check Assurance Level in policy
```sql
-- ✅ MFA ENFORCED
CREATE POLICY "require_mfa" ON sensitive_data
TO authenticated
USING (
  (SELECT auth.jwt()->>'aal') = 'aal2' -- Assurance Level 2 (MFA)
  AND (SELECT auth.uid()) = user_id
);
```

#### 6. **Overly Permissive Policies**
**Pitfall**: Policy allows unintended operations
```sql
-- ❌ TOO BROAD: Users can UPDATE other users' data
CREATE POLICY "all_access" ON positions
FOR ALL -- Applies to SELECT, INSERT, UPDATE, DELETE
USING (true); -- Always true!
```

**Fix**: Specific policies per operation
```sql
-- ✅ GRANULAR
CREATE POLICY "select_own" ON positions FOR SELECT USING (...);
CREATE POLICY "insert_own" ON positions FOR INSERT WITH CHECK (...);
CREATE POLICY "update_own" ON positions FOR UPDATE USING (...) WITH CHECK (...);
CREATE POLICY "delete_own" ON positions FOR DELETE USING (...);
```

### Security Checklist

- [ ] RLS enabled on ALL public schema tables
- [ ] Service keys never in client code
- [ ] All policies use `TO authenticated`
- [ ] All policies check `auth.uid() IS NOT NULL`
- [ ] Separate policies for SELECT, INSERT, UPDATE, DELETE
- [ ] MFA required for sensitive operations (via `aal2` check)
- [ ] Indexes on all policy columns
- [ ] Regular audits using Supabase Security Advisor
- [ ] Test with different user roles (use multiple test accounts)
- [ ] Monitor for slow queries caused by RLS (EXPLAIN ANALYZE)

---

## 6. Multi-Wallet Support for Same User

### Architecture: One User, Many Wallets

```sql
-- users table (managed by Supabase Auth)
-- Auto-created by auth.users, don't modify directly

-- user_wallets junction table
CREATE TABLE user_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL UNIQUE,
  chain_id INTEGER NOT NULL, -- 1=Ethereum, 137=Polygon, 80002=Amoy, etc.
  is_primary BOOLEAN DEFAULT false,
  label TEXT, -- "Main", "Trading", "Cold Storage"
  added_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  
  -- Ensure only one primary wallet per user
  CONSTRAINT one_primary_per_user UNIQUE(user_id, is_primary) 
    WHERE is_primary = true
);

CREATE INDEX idx_user_wallets_address ON user_wallets(wallet_address);
CREATE INDEX idx_user_wallets_user ON user_wallets(user_id);

-- Enable RLS
ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallets"
ON user_wallets FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can add wallets"
ON user_wallets FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own wallets"
ON user_wallets FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);
```

### Adding a New Wallet to Existing User

```typescript
async function linkWallet(existingSession: Session, newWalletAddress: string, signature: string) {
  const supabase = createClient(URL, ANON_KEY);
  
  // 1. Verify new wallet signature
  const message = `Link wallet ${newWalletAddress} to my Rogue account`;
  const recoveredAddress = verifyMessage(message, signature);
  
  if (recoveredAddress.toLowerCase() !== newWalletAddress.toLowerCase()) {
    throw new Error('Invalid signature');
  }
  
  // 2. Set existing session
  await supabase.auth.setSession(existingSession);
  
  // 3. Add wallet to user_wallets
  const { data, error } = await supabase
    .from('user_wallets')
    .insert({
      user_id: existingSession.user.id,
      wallet_address: newWalletAddress.toLowerCase(),
      chain_id: 1,
      label: 'Linked Wallet',
      last_used_at: new Date().toISOString()
    });
  
  if (error) throw error;
  
  return data;
}
```

### Switching Primary Wallet

```typescript
async function setPrimaryWallet(walletId: string) {
  const supabase = createClient(URL, ANON_KEY);
  
  // Use transaction to ensure atomicity
  const { data, error } = await supabase.rpc('set_primary_wallet', {
    new_primary_id: walletId
  });
  
  if (error) throw error;
}

-- SQL function for atomic primary wallet switch
CREATE OR REPLACE FUNCTION set_primary_wallet(new_primary_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Remove primary flag from all user's wallets
  UPDATE user_wallets
  SET is_primary = false
  WHERE user_id = (SELECT auth.uid());
  
  -- Set new primary
  UPDATE user_wallets
  SET is_primary = true
  WHERE id = new_primary_id
    AND user_id = (SELECT auth.uid()); -- Ensure ownership
END;
$$;
```

### Querying Positions Across All User Wallets

```sql
-- Positions can be linked to specific wallet or user
CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  wallet_address TEXT NOT NULL, -- Which wallet opened this position
  protocol TEXT NOT NULL,
  collateral_amount NUMERIC,
  debt_amount NUMERIC,
  health_factor NUMERIC,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_positions_user_id ON positions(user_id);
CREATE INDEX idx_positions_wallet ON positions(wallet_address);

ALTER TABLE positions ENABLE ROW LEVEL SECURITY;

-- RLS: User can see positions from ANY of their wallets
CREATE POLICY "Users can view positions from their wallets"
ON positions FOR SELECT
TO authenticated
USING (
  (SELECT auth.uid()) = user_id
  OR wallet_address IN (
    SELECT wallet_address 
    FROM user_wallets 
    WHERE user_id = (SELECT auth.uid())
  )
);
```

### Multi-Wallet UX Flow

```typescript
// 1. First-time login: Create user + link wallet
async function firstLogin(walletAddress: string, signature: string) {
  const { data: session } = await supabase.auth.signInWithWeb3({
    provider: 'ethereum',
    options: { address: walletAddress, signature }
  });
  
  // Auto-create user_wallets entry
  await supabase.from('user_wallets').insert({
    user_id: session.user.id,
    wallet_address: walletAddress.toLowerCase(),
    is_primary: true,
    label: 'Primary Wallet'
  });
}

// 2. Subsequent login: Detect which user owns wallet
async function detectUser(walletAddress: string): Promise<User | null> {
  // Check if wallet exists in user_wallets
  const { data } = await supabase
    .from('user_wallets')
    .select('user_id, users!inner(*)')
    .eq('wallet_address', walletAddress.toLowerCase())
    .single();
  
  return data?.users || null;
}

// 3. Login with any linked wallet
async function loginWithWallet(walletAddress: string, signature: string) {
  const existingUser = await detectUser(walletAddress);
  
  if (existingUser) {
    // Existing user: login and update last_used_at
    const { data: session } = await supabase.auth.signInWithWeb3({...});
    
    await supabase
      .from('user_wallets')
      .update({ last_used_at: new Date().toISOString() })
      .eq('wallet_address', walletAddress.toLowerCase());
    
    return session;
  } else {
    // New user: create account
    return firstLogin(walletAddress, signature);
  }
}
```

---

## Implementation Recommendations for Rogue

### Database Schema

```sql
-- 1. Risk Profiles (sensitive data)
CREATE TABLE risk_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_profile TEXT NOT NULL, -- AES-256-GCM encrypted JSON
  max_leverage NUMERIC, -- Plaintext for querying
  risk_tolerance TEXT CHECK (risk_tolerance IN ('conservative', 'moderate', 'aggressive')),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX idx_risk_profiles_user ON risk_profiles(user_id);
ALTER TABLE risk_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own risk profile" ON risk_profiles
FOR ALL TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

-- 2. Positions (link to both user and wallet)
CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  wallet_address TEXT NOT NULL,
  protocol TEXT NOT NULL,
  position_type TEXT CHECK (position_type IN ('leverage', 'yield', 'liquidity')),
  collateral_token TEXT,
  collateral_amount NUMERIC,
  debt_token TEXT,
  debt_amount NUMERIC,
  health_factor NUMERIC,
  apy NUMERIC,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed', 'liquidated')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_positions_user_id ON positions(user_id);
CREATE INDEX idx_positions_wallet ON positions(wallet_address);
CREATE INDEX idx_positions_status ON positions(status) WHERE status = 'active';

ALTER TABLE positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own positions" ON positions
FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users create positions" ON positions
FOR INSERT TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND wallet_address IN (
    SELECT wallet_address FROM user_wallets WHERE user_id = (SELECT auth.uid())
  )
);

-- 3. Transaction History
CREATE TABLE transaction_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  wallet_address TEXT NOT NULL,
  tx_hash TEXT NOT NULL UNIQUE,
  chain_id INTEGER NOT NULL,
  type TEXT CHECK (type IN ('deposit', 'withdraw', 'borrow', 'repay', 'liquidation')),
  amount NUMERIC,
  token TEXT,
  gas_used NUMERIC,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tx_history_user_date ON transaction_history(user_id, created_at DESC);
CREATE INDEX idx_tx_history_wallet ON transaction_history(wallet_address);
CREATE INDEX idx_tx_history_hash ON transaction_history(tx_hash);

ALTER TABLE transaction_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own transactions" ON transaction_history
FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "System creates transactions" ON transaction_history
FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

-- 4. Nonce management (prevent replay attacks)
CREATE TABLE used_nonces (
  nonce TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  used_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '5 minutes'
);

CREATE INDEX idx_nonces_expires ON used_nonces(expires_at);

-- Cleanup function (run via cron job)
CREATE OR REPLACE FUNCTION cleanup_expired_nonces()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM used_nonces WHERE expires_at < now();
$$;
```

### Wallet Signature Verification (Client)

```typescript
// lib/auth/wallet.ts
import { SiweMessage } from 'siwe';
import { createClient } from '@supabase/supabase-js';
import { BrowserProvider } from 'ethers';

export class WalletAuth {
  private supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  async connectWallet(): Promise<string> {
    if (!window.ethereum) throw new Error('No wallet found');
    
    const provider = new BrowserProvider(window.ethereum);
    const accounts = await provider.send('eth_requestAccounts', []);
    return accounts[0];
  }
  
  async signIn(walletAddress: string): Promise<Session> {
    // 1. Generate nonce
    const nonce = crypto.randomUUID();
    
    // 2. Create SIWE message
    const message = new SiweMessage({
      domain: window.location.host,
      address: walletAddress,
      statement: 'Sign in to Rogue Yield Agent',
      uri: window.location.origin,
      version: '1',
      chainId: 1,
      nonce: nonce,
      issuedAt: new Date().toISOString(),
      expirationTime: new Date(Date.now() + 5 * 60 * 1000).toISOString()
    });
    
    const messageText = message.prepareMessage();
    
    // 3. Sign with wallet
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const signature = await signer.signMessage(messageText);
    
    // 4. Authenticate with Supabase
    const { data, error } = await this.supabase.auth.signInWithWeb3({
      provider: 'ethereum',
      options: {
        address: walletAddress,
        signature: signature,
        message: messageText
      }
    });
    
    if (error) throw error;
    
    // 5. Ensure user_wallets entry exists
    await this.ensureWalletLinked(walletAddress);
    
    return data.session;
  }
  
  private async ensureWalletLinked(walletAddress: string) {
    const { data: existing } = await this.supabase
      .from('user_wallets')
      .select('id')
      .eq('wallet_address', walletAddress.toLowerCase())
      .single();
    
    if (!existing) {
      await this.supabase.from('user_wallets').insert({
        wallet_address: walletAddress.toLowerCase(),
        chain_id: 1,
        is_primary: true,
        label: 'Primary Wallet'
      });
    }
  }
}
```

### Data Encryption Helper

```typescript
// lib/encryption/client.ts
export class ClientEncryption {
  private static ALGORITHM = 'AES-GCM';
  private static KEY_LENGTH = 256;
  
  static async deriveKey(signature: string, salt: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(signature),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode(salt),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }
  
  static async encrypt(plaintext: string, key: CryptoKey): Promise<string> {
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: this.ALGORITHM, iv },
      key,
      encoder.encode(plaintext)
    );
    
    // Concatenate IV + ciphertext
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    return btoa(String.fromCharCode(...combined));
  }
  
  static async decrypt(ciphertext: string, key: CryptoKey): Promise<string> {
    const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
    
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: this.ALGORITHM, iv },
      key,
      encrypted
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }
}

// Usage example
async function saveEncryptedRiskProfile(profile: RiskProfile, walletSignature: string) {
  const key = await ClientEncryption.deriveKey(walletSignature, userWalletAddress);
  const encrypted = await ClientEncryption.encrypt(JSON.stringify(profile), key);
  
  await supabase.from('risk_profiles').upsert({
    user_id: (await supabase.auth.getUser()).data.user?.id,
    encrypted_profile: encrypted,
    max_leverage: profile.maxLeverage, // Plaintext for querying
    risk_tolerance: profile.riskTolerance
  });
}
```

---

## Security Best Practices Summary

### ✅ DO

1. **Enable RLS on all tables** in `public` schema immediately
2. **Index all RLS policy columns** (`user_id`, `wallet_address`, `team_id`)
3. **Wrap `auth.uid()` in SELECT** for performance: `(SELECT auth.uid())`
4. **Use security definer functions** for complex RLS checks
5. **Encrypt sensitive data** at application layer (risk profiles, API keys)
6. **Store wallet addresses lowercase** for consistency
7. **Implement nonce tracking** to prevent replay attacks
8. **Use `TO authenticated`** clause on all policies
9. **Separate policies per operation** (SELECT, INSERT, UPDATE, DELETE)
10. **Monitor query performance** with `EXPLAIN ANALYZE`

### ❌ DON'T

1. **Never expose service keys** in client-side code
2. **Don't skip NULL checks** on `auth.uid()`
3. **Don't use broad `FOR ALL`** policies without specific USING/WITH CHECK
4. **Don't store encryption keys** in database
5. **Don't skip MFA checks** on sensitive operations
6. **Don't create tables without RLS** in public schema
7. **Don't use nested subqueries** in RLS (flip join direction instead)
8. **Don't ignore Supabase Security Advisor** warnings
9. **Don't reuse nonces** (track in `used_nonces` table)
10. **Don't encrypt non-sensitive data** (unnecessary overhead)

---

## References

- [Supabase RLS Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Web3 Auth](https://supabase.com/docs/guides/auth/auth-web3)
- [RLS Performance Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices)
- [Sign-In with Ethereum (ERC-4361)](https://eips.ethereum.org/EIPS/eip-4361)
- [Precursor Security: Row-Level Recklessness](https://www.precursorsecurity.com/security-blog/row-level-recklessness-testing-supabase-security)
- [AntStack: Optimizing RLS Performance](https://www.antstack.com/blog/optimizing-rls-performance-with-supabase/)

---

## Next Steps

1. **Set up Supabase project** with Web3 auth enabled
2. **Create database schema** with RLS-enabled tables
3. **Implement wallet signature flow** using SIWE
4. **Add encryption helpers** for sensitive data
5. **Deploy Edge Functions** for custom verification (if needed)
6. **Test RLS policies** with multiple test wallets
7. **Monitor performance** and adjust indexes
8. **Run Security Advisor** and fix findings
9. **Document multi-wallet UX** for users
10. **Set up monitoring** for auth failures and slow queries
