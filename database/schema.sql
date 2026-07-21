-- Humanity OS Core Transactional Database Schema
-- Standard PostgreSQL-compatible double-entry ledger design for financial accounting,
-- escrows, campaign balances, and donation tracing.

-- 1. ENUMS AND TYPES
CREATE TYPE account_holder_type AS ENUM ('user', 'community', 'project', 'platform', 'escrow');
CREATE TYPE account_financial_type AS ENUM ('cash', 'escrow', 'payable', 'receivable', 'reserve');
CREATE TYPE transaction_category AS ENUM ('donation', 'allocation', 'payout', 'refund', 'escrow_release', 'escrow_lock');
CREATE TYPE status_type AS ENUM ('pending', 'approved', 'executed', 'failed', 'canceled', 'disputed');

-- 2. ACCOUNTS TABLE
-- Represents individual wallets, public treasuries, campaign balances, or system reserves.
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_type account_holder_type NOT NULL,
    owner_id VARCHAR(128) NOT NULL, -- Links to Firestore user/community/project ID
    account_type account_financial_type NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'NDC',
    status status_type NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_accounts_owner ON accounts(owner_id, owner_type);

-- 3. TRANSACTIONS HEADERS
-- Collects high-level transactions containing description, initiator, and authorization data.
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    txn_type transaction_category NOT NULL,
    reference_id VARCHAR(128), -- E.g. Firestore Proposal ID, Job ID, or Receipt ID
    status status_type NOT NULL DEFAULT 'pending',
    description TEXT,
    initiated_by VARCHAR(128) NOT NULL, -- Firestore User ID
    approved_by VARCHAR(128),          -- Admin / Multi-sig auditor ID
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. DOUBLE-ENTRY LEDGER POSTINGS
-- Core double-entry table. Debits and Credits must sum to zero for any given transaction_id.
CREATE TABLE entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id),
    direction VARCHAR(6) NOT NULL CHECK (direction IN ('debit', 'credit')),
    amount_minor BIGINT NOT NULL, -- Integer-based balance (e.g. 100 = 1.00 NDC)
    currency VARCHAR(10) NOT NULL DEFAULT 'NDC',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_entries_transaction ON entries(transaction_id);
CREATE INDEX idx_entries_account ON entries(account_id);

-- 5. ESCROW AGREEMENTS
-- Tracks gig work escrow locks and resolution timelines.
CREATE TABLE escrows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id VARCHAR(128) UNIQUE NOT NULL, -- Links to Marketplace Order ID
    buyer_account_id UUID NOT NULL REFERENCES accounts(id),
    provider_account_id UUID NOT NULL REFERENCES accounts(id),
    amount_minor BIGINT NOT NULL,
    status status_type NOT NULL DEFAULT 'pending',
    milestones_total INT DEFAULT 1,
    milestones_completed INT DEFAULT 0,
    disputed_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. DONATIONS
-- Logs designated contributions to community and emergency relief funds.
CREATE TABLE donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donor_id VARCHAR(128) NOT NULL,
    recipient_account_id UUID NOT NULL REFERENCES accounts(id),
    amount_minor BIGINT NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'NDC',
    psp_reference VARCHAR(128), -- Stripe/PSP payment trace ID
    anonymous BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. AUDIT ANCHORS LOG
-- Records Merkle roots and periodic Ethereum/Polygon Layer 2 transaction hashes.
CREATE TABLE audit_anchors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_scope VARCHAR(64) NOT NULL, -- E.g. 'global', 'community_123'
    merkle_root CHAR(64) NOT NULL,      -- Hash of the daily transaction subset
    blockchain_tx_hash CHAR(66),        -- L2 transaction hash
    block_number BIGINT,
    anchored_at TIMESTAMPTZ
);
