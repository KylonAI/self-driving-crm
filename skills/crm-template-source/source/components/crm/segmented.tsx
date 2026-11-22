"use client";

import { cn } from "@/lib/utils";

/** A small set of tabs for one page's view, kept in the URL by the caller. */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: Array<{ id: T; label: string }>; onChange: (value: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex rounded-[10px] border border-ky-hairline bg-ky-card p-0.5">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={value === option.id}
          onClick={() => onChange(option.id)}
          className={cn(
            "h-7 rounded-[8px] px-2.5 text-[12px] whitespace-nowrap",
            value === option.id ? "bg-ky-selected font-semibold text-ky-ink" : "text-ky-ink-2 hover:bg-ky-hover",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
