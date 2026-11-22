/**
 * CRM types offered in Setup. A type only changes words and the default
 * pipeline; every type shares the same tables, so switching type later never
 * moves or drops data.
 */

export type CrmType = "b2b" | "vc" | "partners" | "recruiting" | "other";

export type StageKind = "open" | "won" | "lost";

export interface Stage {
  id: string;
  label: string;
  kind: StageKind;
}

export interface ObjectLabels {
  companies: string;
  company: string;
  people: string;
  person: string;
  accounts: string;
  account: string;
  deals: string;
  deal: string;
}

export interface CrmPreset {
  type: CrmType;
  name: string;
  summary: string;
  labels: ObjectLabels;
  stages: Stage[];
  /** What the deal amount means for this kind of CRM. */
  amountLabel: string;
}

export const CRM_PRESETS: Record<CrmType, CrmPreset> = {
  b2b: {
    type: "b2b",
    name: "B2B sales",
    summary: "Companies you sell to, the people at them, open deals and paying customers.",
    labels: {
      companies: "Companies",
      company: "Company",
      people: "People",
      person: "Person",
      accounts: "Customers",
      account: "Customer",
      deals: "Deals",
      deal: "Deal",
    },
    stages: [
      { id: "lead", label: "Lead", kind: "open" },
      { id: "qualified", label: "Qualified", kind: "open" },
      { id: "demo", label: "Demo", kind: "open" },
      { id: "proposal", label: "Proposal", kind: "open" },
      { id: "negotiation", label: "Negotiation", kind: "open" },
      { id: "won", label: "Won", kind: "won" },
      { id: "lost", label: "Lost", kind: "lost" },
    ],
    amountLabel: "Deal value",
  },
  vc: {
    type: "vc",
    name: "VC / investing",
    summary: "Startups in your deal flow, founders and co-investors, and the portfolio after you invest.",
    labels: {
      companies: "Startups",
      company: "Startup",
      people: "Founders & contacts",
      person: "Contact",
      accounts: "Portfolio",
      account: "Portfolio company",
      deals: "Deal flow",
      deal: "Deal",
    },
    stages: [
      { id: "sourced", label: "Sourced", kind: "open" },
      { id: "first_meeting", label: "First meeting", kind: "open" },
      { id: "partner_meeting", label: "Partner meeting", kind: "open" },
      { id: "due_diligence", label: "Due diligence", kind: "open" },
      { id: "ic", label: "IC", kind: "open" },
      { id: "term_sheet", label: "Term sheet", kind: "open" },
      { id: "invested", label: "Invested", kind: "won" },
      { id: "passed", label: "Passed", kind: "lost" },
    ],
    amountLabel: "Check size",
  },
  partners: {
    type: "partners",
    name: "Partnerships",
    summary: "Agencies, resellers and integration partners, from first intro to a live partnership.",
    labels: {
      companies: "Partners",
      company: "Partner",
      people: "Contacts",
      person: "Contact",
      accounts: "Active partners",
      account: "Active partner",
      deals: "Partnerships",
      deal: "Partnership",
    },
    stages: [
      { id: "identified", label: "Identified", kind: "open" },
      { id: "intro", label: "Intro", kind: "open" },
      { id: "evaluating", label: "Evaluating", kind: "open" },
      { id: "agreement", label: "Agreement", kind: "open" },
      { id: "live", label: "Live", kind: "won" },
      { id: "declined", label: "Declined", kind: "lost" },
    ],
    amountLabel: "Expected revenue",
  },
  recruiting: {
    type: "recruiting",
    name: "Recruiting",
    summary: "Client companies, candidates, and each placement from sourcing to hire.",
    labels: {
      companies: "Clients",
      company: "Client",
      people: "Candidates",
      person: "Candidate",
      accounts: "Engagements",
      account: "Engagement",
      deals: "Placements",
      deal: "Placement",
    },
    stages: [
      { id: "sourced", label: "Sourced", kind: "open" },
      { id: "screen", label: "Screen", kind: "open" },
      { id: "interview", label: "Interview", kind: "open" },
      { id: "offer", label: "Offer", kind: "open" },
      { id: "hired", label: "Hired", kind: "won" },
      { id: "rejected", label: "Rejected", kind: "lost" },
    ],
    amountLabel: "Fee",
  },
  other: {
    type: "other",
    name: "Something else",
    summary: "A plain relationship tracker. Rename objects and stages in Settings to fit your work.",
    labels: {
      companies: "Organizations",
      company: "Organization",
      people: "People",
      person: "Person",
      accounts: "Accounts",
      account: "Account",
      deals: "Opportunities",
      deal: "Opportunity",
    },
    stages: [
      { id: "new", label: "New", kind: "open" },
      { id: "in_progress", label: "In progress", kind: "open" },
      { id: "won", label: "Won", kind: "won" },
      { id: "lost", label: "Lost", kind: "lost" },
    ],
    amountLabel: "Value",
  },
};

export const CRM_TYPES = Object.keys(CRM_PRESETS) as CrmType[];

export function isCrmType(value: unknown): value is CrmType {
  return typeof value === "string" && value in CRM_PRESETS;
}

/** The labels to show before Setup has run. */
export const DEFAULT_LABELS = CRM_PRESETS.b2b.labels;
