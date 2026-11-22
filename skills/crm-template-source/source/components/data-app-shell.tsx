"use client";

import {
  BarChart3,
  Cable,
  Briefcase,
  Building2,
  CalendarDays,
  Handshake,
  Home,
  Inbox,
  ListChecks,
  Menu,
  Send,
  SlidersHorizontal,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, Suspense, useEffect, useState } from "react";
import { CountBadge, KylonMark } from "@/components/crm/ui";
import { useCounts, useSettings } from "@/lib/crm/client";
import { formatNumber } from "@/lib/crm/display";
import { DEFAULT_LABELS, type ObjectLabels } from "@/lib/crm/presets";
import { cn } from "@/lib/utils";

interface NavItem {
  key: string;
  label: (labels: ObjectLabels) => string;
  href: string;
  icon: LucideIcon;
  count?: (counts: Record<string, number>) => number | undefined;
  badge?: (counts: Record<string, number>) => number | undefined;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    label: "Work",
    items: [
      { key: "home", label: () => "Home", href: "/home", icon: Home },
      { key: "follow-ups", label: () => "Follow-ups", href: "/follow-ups", icon: Send, badge: (c) => c.tasks_due || undefined },
    ],
  },
  {
    label: "Relationships",
    items: [
      { key: "people", label: (l) => l.people, href: "/people", icon: Users, count: (c) => c.people },
      { key: "companies", label: (l) => l.companies, href: "/companies", icon: Building2, count: (c) => c.companies },
      { key: "accounts", label: (l) => l.accounts, href: "/accounts", icon: Briefcase, count: (c) => c.accounts },
    ],
  },
  {
    label: "Pipeline",
    items: [
      { key: "deals", label: (l) => l.deals, href: "/deals", icon: Handshake, count: (c) => c.deals },
      { key: "meetings", label: () => "Meetings", href: "/meetings", icon: CalendarDays },
      { key: "lists", label: () => "Lists", href: "/lists", icon: ListChecks, count: (c) => c.lists || undefined },
    ],
  },
  {
    label: "Reports",
    items: [{ key: "insights", label: () => "Insights", href: "/insights", icon: BarChart3 }],
  },
  {
    label: "Settings",
    items: [
      {
        key: "sources",
        label: () => "Data sources",
        href: "/settings/sources",
        icon: Cable,
        badge: (c) => c.sources_attention || undefined,
      },
      { key: "review", label: () => "Review", href: "/review", icon: Inbox, badge: (c) => c.review_open || undefined },
      { key: "fields", label: () => "Fields & data quality", href: "/settings/fields", icon: SlidersHorizontal },
    ],
  },
];

function activeKey(pathname: string): string {
  if (pathname === "/") return "home";
  for (const group of NAV)
    for (const item of group.items) if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return item.key;
  return "";
}

function SidebarItem({
  item,
  labels,
  active,
  counts,
  onNavigate,
}: {
  item: NavItem;
  labels: ObjectLabels;
  active: boolean;
  counts: Record<string, number>;
  onNavigate?: () => void;
}) {
  const count = item.count?.(counts);
  const badge = item.badge?.(counts);
  const Icon = item.icon;
  return (
    <Link
      href={item.href as Route}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn("flex h-8 items-center gap-2.5 rounded-[8px] px-2 text-[13px] text-ky-ink", active ? "bg-ky-selected" : "hover:bg-ky-hover")}
    >
      <Icon className="size-4 shrink-0 text-ky-ink-3" strokeWidth={1.5} />
      <span className="min-w-0 flex-1 truncate">{item.label(labels)}</span>
      {badge ? <CountBadge>{formatNumber(badge)}</CountBadge> : null}
      {!badge && count !== undefined ? <span className="text-[11px] text-ky-ink-3 tabular-nums">{formatNumber(count)}</span> : null}
    </Link>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const counts = useCounts().data ?? {};
  const labels = useSettings().data?.labels ?? DEFAULT_LABELS;
  const key = activeKey(pathname);
  return (
    <nav aria-label="CRM" className="flex flex-col gap-4">
      {NAV.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          <p className="ky-text-product-menu-title px-2 pb-1 text-ky-muted">{group.label}</p>
          {group.items.map((item) => (
            <SidebarItem key={item.key} item={item} labels={labels} active={key === item.key} counts={counts} onNavigate={onNavigate} />
          ))}
        </div>
      ))}
    </nav>
  );
}

function currentTitle(pathname: string, labels: ObjectLabels): string {
  const key = activeKey(pathname);
  for (const group of NAV) for (const item of group.items) if (item.key === key) return item.label(labels);
  return "CRM";
}

export interface DataAppShellProps {
  children: ReactNode;
}

export function DataAppShell({ children }: DataAppShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const settings = useSettings().data;
  const labels = settings?.labels ?? DEFAULT_LABELS;
  const title = settings?.org_name ? `${settings.org_name} CRM` : "CRM";

  useEffect(() => setMenuOpen(false), [pathname]);

  if (pathname.startsWith("/present")) {
    return <main className="flex min-h-dvh bg-ky-chrome text-ky-ink">{children}</main>;
  }

  return (
    <main className="flex h-dvh overflow-hidden bg-ky-chrome text-ky-ink">
      <aside className="hidden w-[224px] shrink-0 flex-col overflow-y-auto border-r border-ky-hairline px-3 pt-4 pb-6 min-[720px]:flex">
        <div className="mb-5 flex items-center gap-2 px-2">
          <span className="flex size-7 items-center justify-center">
            <KylonMark size={17} />
          </span>
          <span className="truncate text-[13px] font-semibold">{title}</span>
        </div>
        <Suspense>
          <SidebarContent />
        </Suspense>
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-ky-hairline px-4 min-[720px]:hidden">
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="flex size-8 items-center justify-center rounded-[8px] hover:bg-ky-hover"
          >
            {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
          <KylonMark size={16} />
          <span className="truncate text-[13px] font-semibold">{currentTitle(pathname, labels)}</span>
        </header>
        {menuOpen ? (
          <div className="absolute inset-x-0 top-12 bottom-0 z-40 overflow-y-auto bg-ky-chrome px-3 py-4 min-[720px]:hidden">
            <Suspense>
              <SidebarContent onNavigate={() => setMenuOpen(false)} />
            </Suspense>
          </div>
        ) : null}
        <div className="flex min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </main>
  );
}
