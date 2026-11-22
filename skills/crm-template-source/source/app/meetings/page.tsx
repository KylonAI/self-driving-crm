"use client";

import { Suspense, useMemo } from "react";
import { ObjectPage } from "@/components/crm/object-page";
import { Segmented } from "@/components/crm/segmented";
import { PageLoading } from "@/components/crm/ui";
import { relationOf } from "@/lib/crm/client";
import { readUrlState } from "@/lib/url-state";
import { useQueryState } from "@/lib/crm/url";

const VIEWS = ["meetings", "all"] as const;

function MeetingsPage() {
  const { params, update } = useQueryState();
  const view = readUrlState(params, "view", VIEWS, "meetings");
  const baseFilters = useMemo(() => (view === "meetings" ? [{ field_id: "kind", operator: "eq", value: "meeting" }] : []), [view]);
  return (
    <ObjectPage
      key={view}
      entity="activities"
      title={() => (view === "meetings" ? "Meetings" : "All activity")}
      singular={() => (view === "meetings" ? "Meeting" : "Activity")}
      baseFilters={baseFilters}
      quickFilters={view === "all" ? ["kind", "recorded_by"] : ["recorded_by"]}
      columns={["subject", "occurred_at", "kind", "person_id", "company_id", "source"]}
      createFields={["subject", "kind", "occurred_at", "person_id", "company_id", "summary"]}
      createDefaults={{ kind: view === "meetings" ? "meeting" : "note", occurred_at: new Date().toISOString() }}
      emptyText={view === "meetings" ? "No meetings yet. Once your meeting-notes Automation writes to the CRM, every meeting lands here." : "Nothing has been logged yet."}
      toolbarExtra={
        <Segmented
          label="Activity view"
          value={view}
          onChange={(next) => update({ view: next === "meetings" ? null : next, f: null })}
          options={[
            { id: "meetings", label: "Meetings" },
            { id: "all", label: "All activity" },
          ]}
        />
      }
      onRowOpen={(row, openRecord) => {
        const person = relationOf(row.data.person_id);
        const company = relationOf(row.data.company_id);
        if (person) openRecord("person", person.id);
        else if (company) openRecord("company", company.id);
      }}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoading />}>
      <MeetingsPage />
    </Suspense>
  );
}
