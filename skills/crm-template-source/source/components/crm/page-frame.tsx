import type { ReactNode } from "react";

/** A scrolling page with the CRM's title row. */
export function PageFrame({ title, subtitle, actions, children }: { title: string; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-6 pt-5 pb-10">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[20px] font-semibold tracking-[-0.3px]">{title}</h1>
            {subtitle ? <p className="mt-1 max-w-[680px] text-[13px] leading-5 text-ky-ink-2">{subtitle}</p> : null}
          </div>
          {actions}
        </div>
        {children}
      </div>
    </div>
  );
}

export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <h2 className="text-[14px] font-semibold text-ky-ink">{title}</h2>
        <span className="flex-1" />
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Two to four headline numbers in one quiet row, separated by hairlines rather than boxed in cards. */
export function Figures({ items }: { items: Array<{ label: string; value: string; hint?: string }> }) {
  return (
    <dl className="grid grid-cols-2 border-y border-ky-hairline min-[720px]:grid-cols-4">
      {items.map((item, index) => (
        <div key={item.label} className={`flex flex-col gap-1 px-4 py-3 ${index % 2 === 1 ? "border-l border-ky-hairline" : ""} ${index >= 2 ? "max-[719px]:border-t max-[719px]:border-ky-hairline min-[720px]:border-l" : ""}`}>
          <dt className="text-[12px] text-ky-ink-3">{item.label}</dt>
          <dd className="text-[22px] leading-7 font-semibold tracking-[-0.3px] text-ky-ink tabular-nums">{item.value}</dd>
          {item.hint ? <dd className="text-[12px] text-ky-ink-3">{item.hint}</dd> : null}
        </div>
      ))}
    </dl>
  );
}
