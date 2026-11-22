import type { CrmType } from "@/lib/crm/presets";

/**
 * The data sources a CRM of each type usually draws from. The install skill
 * reads the same list to recommend what each person should connect; the Data
 * sources page shows which of them are connected and fresh.
 */

export type SourceKind =
  | "email"
  | "calendar"
  | "meeting_notes"
  | "booking"
  | "forms"
  | "billing"
  | "support"
  | "product"
  | "deal_flow"
  | "portfolio"
  | "enrichment"
  | "import";

export interface SourceOption {
  id: string;
  label: string;
  kind: SourceKind;
  /** True when each person connects their own account (mailboxes, calendars, note takers). */
  personal: boolean;
}

export const SOURCE_KINDS: Record<SourceKind, { label: string; hint: string }> = {
  email: { label: "Email", hint: "Conversations with people outside the team." },
  calendar: { label: "Calendar", hint: "Meetings that have outside guests." },
  meeting_notes: { label: "Meeting notes", hint: "Recaps, transcripts and action items from note takers." },
  booking: { label: "Booking", hint: "Meetings people book themselves." },
  forms: { label: "Forms", hint: "Inbound form replies and sign-ups." },
  billing: { label: "Billing", hint: "Subscriptions, payments and invoices." },
  support: { label: "Support", hint: "Tickets and conversations with customers." },
  product: { label: "Product usage", hint: "What customers do in your product." },
  deal_flow: { label: "Deal flow", hint: "Intros, pitch decks and data rooms." },
  portfolio: { label: "Portfolio data", hint: "Updates and metrics from companies you invested in." },
  enrichment: { label: "Enrichment", hint: "Company and contact details filled in from outside data." },
  import: { label: "One-time import", hint: "Records moved over from the tool used before." },
};

export const SOURCES: SourceOption[] = [
  { id: "gmail", label: "Gmail", kind: "email", personal: true },
  { id: "outlook", label: "Outlook", kind: "email", personal: true },
  { id: "google_calendar", label: "Google Calendar", kind: "calendar", personal: true },
  { id: "outlook_calendar", label: "Outlook Calendar", kind: "calendar", personal: true },
  { id: "read_ai", label: "Read AI", kind: "meeting_notes", personal: true },
  { id: "fireflies", label: "Fireflies", kind: "meeting_notes", personal: true },
  { id: "otter", label: "Otter", kind: "meeting_notes", personal: true },
  { id: "fathom", label: "Fathom", kind: "meeting_notes", personal: true },
  { id: "granola", label: "Granola", kind: "meeting_notes", personal: true },
  { id: "tldv", label: "tl;dv", kind: "meeting_notes", personal: true },
  { id: "zoom", label: "Zoom", kind: "meeting_notes", personal: true },
  { id: "google_meet", label: "Google Meet", kind: "meeting_notes", personal: true },
  { id: "cal_com", label: "Cal.com", kind: "booking", personal: false },
  { id: "calendly", label: "Calendly", kind: "booking", personal: false },
  { id: "typeform", label: "Typeform", kind: "forms", personal: false },
  { id: "tally", label: "Tally", kind: "forms", personal: false },
  { id: "google_forms", label: "Google Forms", kind: "forms", personal: false },
  { id: "website_form", label: "Website form", kind: "forms", personal: false },
  { id: "stripe", label: "Stripe", kind: "billing", personal: false },
  { id: "intercom", label: "Intercom", kind: "support", personal: false },
  { id: "zendesk", label: "Zendesk", kind: "support", personal: false },
  { id: "posthog", label: "PostHog", kind: "product", personal: false },
  { id: "segment", label: "Segment", kind: "product", personal: false },
  { id: "docsend", label: "DocSend", kind: "deal_flow", personal: false },
  { id: "intro_email", label: "Intro emails", kind: "deal_flow", personal: true },
  { id: "carta", label: "Carta", kind: "portfolio", personal: false },
  { id: "visible", label: "Visible", kind: "portfolio", personal: false },
  { id: "investor_updates", label: "Investor updates", kind: "portfolio", personal: true },
  { id: "apollo", label: "Apollo", kind: "enrichment", personal: false },
  { id: "crunchbase", label: "Crunchbase", kind: "enrichment", personal: false },
  { id: "harmonic", label: "Harmonic", kind: "enrichment", personal: false },
  { id: "hubspot", label: "HubSpot", kind: "import", personal: false },
  { id: "salesforce", label: "Salesforce", kind: "import", personal: false },
  { id: "pipedrive", label: "Pipedrive", kind: "import", personal: false },
  { id: "affinity", label: "Affinity", kind: "import", personal: false },
  { id: "airtable", label: "Airtable", kind: "import", personal: false },
  { id: "other", label: "Other", kind: "import", personal: false },
];

const COMMON: SourceKind[] = ["email", "calendar", "meeting_notes", "booking", "forms"];

/** Which kinds a CRM of each type should cover, in the order the install skill asks about them. */
export const KINDS_BY_TYPE: Record<CrmType, SourceKind[]> = {
  b2b: [...COMMON, "billing", "support", "product", "enrichment", "import"],
  vc: [...COMMON, "deal_flow", "portfolio", "enrichment", "import"],
  partners: [...COMMON, "billing", "enrichment", "import"],
  recruiting: [...COMMON, "enrichment", "import"],
  other: [...COMMON, "import"],
};

export function sourceLabel(id: unknown): string {
  return SOURCES.find((source) => source.id === id)?.label ?? (typeof id === "string" ? id : "Unknown");
}
