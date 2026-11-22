-- Blank CRM template: tables only, no rows. Every id is an App-generated text id.

CREATE TABLE IF NOT EXISTS crm_settings (
  id TEXT PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  crm_type TEXT CHECK (crm_type IS NULL OR crm_type IN ('b2b', 'vc', 'partners', 'recruiting', 'other')),
  org_name TEXT,
  labels JSONB,
  deal_stages JSONB,
  currency TEXT NOT NULL DEFAULT 'USD',
  installed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT,
  relationship TEXT,
  industry TEXT,
  size_band TEXT,
  country TEXT,
  city TEXT,
  owner TEXT,
  website TEXT,
  linkedin_url TEXT,
  logo_url TEXT,
  description TEXT,
  source TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS crm_companies_domain_key ON crm_companies (lower(domain)) WHERE domain IS NOT NULL AND domain <> '';
CREATE INDEX IF NOT EXISTS crm_companies_name_idx ON crm_companies (lower(name));

CREATE TABLE IF NOT EXISTS crm_people (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  title TEXT,
  company_id TEXT REFERENCES crm_companies (id) ON DELETE SET NULL,
  role TEXT,
  outreach_status TEXT,
  owner TEXT,
  last_contacted_at DATE,
  phone TEXT,
  location TEXT,
  linkedin_url TEXT,
  x_url TEXT,
  avatar_url TEXT,
  source TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS crm_people_email_key ON crm_people (lower(email)) WHERE email IS NOT NULL AND email <> '';
CREATE INDEX IF NOT EXISTS crm_people_company_idx ON crm_people (company_id);

CREATE TABLE IF NOT EXISTS crm_accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  company_id TEXT REFERENCES crm_companies (id) ON DELETE SET NULL,
  status TEXT,
  health TEXT,
  plan TEXT,
  value NUMERIC(14, 2),
  account_manager TEXT,
  start_date DATE,
  renewal_date DATE,
  source TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_accounts_company_idx ON crm_accounts (company_id);

CREATE TABLE IF NOT EXISTS crm_deals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  stage TEXT,
  amount NUMERIC(14, 2),
  company_id TEXT REFERENCES crm_companies (id) ON DELETE SET NULL,
  person_id TEXT REFERENCES crm_people (id) ON DELETE SET NULL,
  account_id TEXT REFERENCES crm_accounts (id) ON DELETE SET NULL,
  owner TEXT,
  close_date DATE,
  probability NUMERIC(5, 2),
  next_step TEXT,
  next_step_date DATE,
  lost_reason TEXT,
  source TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_deals_stage_idx ON crm_deals (stage);
CREATE INDEX IF NOT EXISTS crm_deals_company_idx ON crm_deals (company_id);
CREATE INDEX IF NOT EXISTS crm_deals_person_idx ON crm_deals (person_id);

CREATE TABLE IF NOT EXISTS crm_activities (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  kind TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  person_id TEXT REFERENCES crm_people (id) ON DELETE SET NULL,
  company_id TEXT REFERENCES crm_companies (id) ON DELETE SET NULL,
  deal_id TEXT REFERENCES crm_deals (id) ON DELETE SET NULL,
  account_id TEXT REFERENCES crm_accounts (id) ON DELETE SET NULL,
  summary TEXT,
  recorded_by TEXT,
  source TEXT,
  source_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS crm_activities_source_key ON crm_activities (source, source_ref) WHERE source IS NOT NULL AND source_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_activities_occurred_idx ON crm_activities (occurred_at DESC);
CREATE INDEX IF NOT EXISTS crm_activities_person_idx ON crm_activities (person_id);
CREATE INDEX IF NOT EXISTS crm_activities_company_idx ON crm_activities (company_id);
CREATE INDEX IF NOT EXISTS crm_activities_deal_idx ON crm_activities (deal_id);

CREATE TABLE IF NOT EXISTS crm_tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  due_date DATE,
  owner TEXT,
  person_id TEXT REFERENCES crm_people (id) ON DELETE SET NULL,
  company_id TEXT REFERENCES crm_companies (id) ON DELETE SET NULL,
  deal_id TEXT REFERENCES crm_deals (id) ON DELETE SET NULL,
  account_id TEXT REFERENCES crm_accounts (id) ON DELETE SET NULL,
  notes TEXT,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_tasks_due_idx ON crm_tasks (status, due_date);

CREATE TABLE IF NOT EXISTS crm_lists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'people',
  description TEXT,
  owner TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_list_members (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  list_id TEXT NOT NULL REFERENCES crm_lists (id) ON DELETE CASCADE,
  person_id TEXT REFERENCES crm_people (id) ON DELETE CASCADE,
  company_id TEXT REFERENCES crm_companies (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS crm_list_members_key ON crm_list_members (list_id, coalesce(person_id, ''), coalesce(company_id, ''));

CREATE TABLE IF NOT EXISTS crm_review_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  kind TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  entity TEXT,
  record_id TEXT,
  field TEXT,
  proposed_value TEXT,
  reason TEXT,
  source TEXT,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_review_items_status_idx ON crm_review_items (status, created_at DESC);

CREATE TABLE IF NOT EXISTS crm_sync_sources (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  source TEXT,
  kind TEXT,
  owner TEXT,
  shared BOOLEAN NOT NULL DEFAULT false,
  account_label TEXT,
  automation_id TEXT,
  status TEXT NOT NULL DEFAULT 'connecting',
  scope JSONB,
  last_synced_at TIMESTAMPTZ,
  items_last_run INTEGER,
  items_total INTEGER,
  last_error TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_sync_sources_owner_idx ON crm_sync_sources (owner, kind);

CREATE TABLE IF NOT EXISTS crm_audit (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT,
  changes JSONB,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_audit_record_idx ON crm_audit (entity, record_id, at DESC);
