import type { CrmType, ObjectLabels, Stage } from "@/lib/crm/presets";

export interface CrmSettings {
  crm_type: CrmType | null;
  org_name: string | null;
  labels: ObjectLabels;
  deal_stages: Stage[];
  currency: string;
  amount_label: string;
  /** Set by the install skill when the person confirmed the CRM type; null on a blank template. */
  installed_at: string | null;
}
