"use client";

import { AlertCircle, Bot, Briefcase, Building2, Handshake, type LucideIcon, User } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useWorkspaceMemberProfiles } from "@/components/providers/kylon-workspace-provider";
import { type Labeled, type Tone, initials } from "@/lib/crm/display";
import { type RecordType, useOpenRecord } from "@/lib/crm/url";
import { cn } from "@/lib/utils";

const TAG_TONE: Record<Tone, string> = {
  olive: "bg-olive-tint text-olive-ink",
  sage: "bg-sage-tint text-sage-ink",
  sun: "bg-sun-tint text-sun-ink",
  clay: "bg-clay-tint text-clay-ink",
};

/** A status tag: the hue's tint behind the same hue's ink. One per cell. */
export function Tag({ tone, children, className, title }: { tone: Tone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-[22px] max-w-full shrink-0 items-center gap-1 truncate rounded-full px-2 text-[11.5px] leading-none font-semibold whitespace-nowrap",
        TAG_TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * A state in words. Only states that need attention or carry a win get a tag
 * (Olive, Sun, Clay); neutral defaults such as Prospect or Lead stay plain
 * text so a column of them reads quietly.
 */
export function StateLabel({ state, plainClassName }: { state: Labeled | null; plainClassName?: string }) {
  if (!state) return null;
  if (!state.tone) return <span className={cn("truncate text-[13px] text-ky-ink", plainClassName)}>{state.label}</span>;
  return <Tag tone={state.tone}>{state.label}</Tag>;
}

/** The Olive count badge (sidebar review count). */
export function CountBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[var(--ky-component-badge-bg)] px-[5px] text-[10.5px] leading-none font-semibold text-[var(--ky-component-badge-fg)] tabular-nums">
      {children}
    </span>
  );
}

/** The Kylon mark: four blades, one colour, no frame. Olive by default. */
export function KylonMark({ size = 24, className, spinning = false }: { size?: number; className?: string; spinning?: boolean }) {
  return (
    <svg
      viewBox="56 56 128 128"
      width={size}
      height={size}
      aria-hidden="true"
      className={cn("shrink-0 text-ky-accent", spinning && "animate-spin [animation-duration:1.6s] motion-reduce:animate-none", className)}
      fill="currentColor"
    >
      <path fillRule="evenodd" clipRule="evenodd" d="M112.008 56L118.519 108.091C112.958 108.775 108.575 113.263 108.052 118.872C103.767 118.057 99.5661 116.805 95.5168 115.128C87.752 111.912 80.6961 107.198 74.7532 101.255C68.8104 95.3121 64.0964 88.2568 60.8801 80.4922C58.6868 75.1971 57.2196 69.6423 56.508 63.9795C55.9572 59.5958 59.5899 56.0002 64.008 56H112.008Z" />
      <path d="M108.092 121.488C108.779 127.046 113.267 131.426 118.875 131.947C118.06 136.235 116.807 140.44 115.129 144.492C111.913 152.257 107.199 159.312 101.256 165.255C95.313 171.198 88.2578 175.912 80.4932 179.128C75.1981 181.321 69.6433 182.789 63.9805 183.501C59.5967 184.052 56.001 180.418 56.001 176V128L108.092 121.488Z" />
      <path d="M131.946 121.125C136.235 121.94 140.44 123.193 144.493 124.872C152.258 128.088 159.313 132.802 165.256 138.745C171.199 144.688 175.913 151.743 179.129 159.508C181.322 164.803 182.79 170.358 183.502 176.021C184.053 180.404 180.419 184 176.001 184H128.001L121.489 131.907C127.047 131.219 131.425 126.732 131.946 121.125Z" />
      <path fillRule="evenodd" clipRule="evenodd" d="M176.021 56.4985C180.405 55.9477 184.001 59.5813 184.001 63.9995V111.999L131.907 118.51C131.219 112.953 126.733 108.574 121.126 108.052C121.941 103.764 123.195 99.5604 124.873 95.5083C128.089 87.7434 132.803 80.6876 138.746 74.7446C144.689 68.8018 151.744 64.0878 159.509 60.8716C164.804 58.6783 170.359 57.2101 176.021 56.4985Z" />
    </svg>
  );
}

/** An image that falls back to its initials when the URL is missing or fails to load. */
function AvatarImage({ src, fallback }: { src?: string | null; fallback: ReactNode }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <>{fallback}</>;
  return <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="size-full object-cover" />;
}

/** People are circles; initials sit on Rosa tint when there is no photo. */
export function PersonAvatar({ name, size = 24, src }: { name: string; size?: number; src?: string | null }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--ky-component-avatar-initials-bg)] font-semibold text-[var(--ky-component-avatar-initials-fg)]"
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.38)) }}
      aria-hidden="true"
    >
      <AvatarImage src={src} fallback={initials(name)} />
    </span>
  );
}

/** Companies are rounded squares: the logo on white (in both themes, since logos are drawn for white), or the initial on Sage tint. */
export function CompanyAvatar({ name, size = 24, src }: { name: string; size?: number; src?: string | null }) {
  // Remember which logo failed, so a row that gets another company tries its logo.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showLogo = Boolean(src) && failedSrc !== src;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[6px] font-semibold",
        showLogo ? "border border-ky-hairline bg-white" : "bg-sage-tint text-sage-ink",
      )}
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.42)) }}
      aria-hidden="true"
    >
      {showLogo ? (
        <img src={src as string} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedSrc(src ?? null)} className="size-full object-contain" />
      ) : (
        initials(name).slice(0, 1)
      )}
    </span>
  );
}

/** Accounts are rounder Olive tiles, so an account never looks like its company. */
export function AccountAvatar({ size = 24 }: { size?: number }) {
  const glyph = Math.max(8, Math.round(size * 0.58));
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[30%] bg-olive-tint text-olive-ink"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Briefcase style={{ width: glyph, height: glyph }} strokeWidth={size <= 18 ? 2.25 : 1.75} />
    </span>
  );
}

/** A record's own mark: people are circles, companies rounded squares, accounts Olive tiles, deals neutral tiles. */
export function RecordAvatar({ type, name, size = 24, src }: { type: RecordType; name: string; size?: number; src?: string | null }) {
  if (type === "person") return <PersonAvatar name={name} size={size} src={src} />;
  if (type === "account") return <AccountAvatar size={size} />;
  if (type === "deal") return <DealAvatar size={size} />;
  return <CompanyAvatar name={name} size={size} src={src} />;
}

export function DealAvatar({ size = 24 }: { size?: number }) {
  const glyph = Math.max(8, Math.round(size * 0.56));
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-[30%] bg-ky-hover text-ky-ink-2" style={{ width: size, height: size }} aria-hidden="true">
      <Handshake style={{ width: glyph, height: glyph }} strokeWidth={size <= 18 ? 2.25 : 1.75} />
    </span>
  );
}

const TYPE_MARK: Record<RecordType, { icon: LucideIcon; className: string }> = {
  company: { icon: Building2, className: "bg-sage-tint text-sage-ink" },
  account: { icon: Briefcase, className: "bg-olive-tint text-olive-ink" },
  person: { icon: User, className: "bg-rosa-tint text-rosa-ink" },
  deal: { icon: Handshake, className: "bg-ky-hover text-ky-ink-2" },
};

/** Which kind of record this is, said the same way everywhere: the kind's icon and colour, as in the sidebar. */
export function RecordTypeLabel({ type, label, className }: { type: RecordType; label: string; className?: string }) {
  const mark = TYPE_MARK[type];
  const Icon = mark.icon;
  return (
    <span className={cn("inline-flex h-5 shrink-0 items-center gap-1 rounded-full pr-2 pl-1.5 text-[11.5px] leading-none font-semibold whitespace-nowrap", mark.className, className)}>
      <Icon className="size-3" strokeWidth={2} aria-hidden="true" />
      {label}
    </span>
  );
}

/** A workspace member: photo or initials; Agents get the Olive ring. */
export function MemberAvatar({ userId, size = 20 }: { userId: string; size?: number }) {
  const members = useWorkspaceMemberProfiles();
  const member = members.get(userId);
  const isAgent = member?.memberType === "agent" || /^[0-9a-f]{12}$/i.test(userId);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--ky-component-avatar-initials-bg)] font-semibold text-[var(--ky-component-avatar-initials-fg)]",
        isAgent && "ring-2 ring-[var(--ky-component-avatar-agent-ring-default)] ring-offset-1 ring-offset-[var(--ky-color-surface-chrome)]",
      )}
      style={{ width: size, height: size, fontSize: Math.max(8, Math.round(size * 0.4)) }}
      aria-hidden="true"
    >
      {member?.avatarUrl ? (
        <img src={member.avatarUrl} alt="" className="size-full object-cover" />
      ) : isAgent && !member ? (
        <Bot className="size-3" />
      ) : (
        initials(member?.name ?? "")
      )}
    </span>
  );
}

export function useMemberName(userId: string | null | undefined): string | null {
  const members = useWorkspaceMemberProfiles();
  if (!userId) return null;
  return members.get(userId)?.name ?? null;
}

/** A member shown as avatar + name; unknown ids never show as ids. */
export function MemberChip({ userId, className }: { userId: string | null | undefined; className?: string }) {
  const name = useMemberName(userId);
  if (!userId) return <span className={cn("text-[13px] text-ky-muted", className)}>Unassigned</span>;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <MemberAvatar userId={userId} size={18} />
      <span className={cn("truncate text-[13px]", name ? "text-ky-ink" : "text-ky-muted")}>{name ?? "Unknown member"}</span>
    </span>
  );
}

/**
 * A person, company, account or deal as a small pill. Clicking opens that
 * record in the side panel of the current page.
 */
export function RecordChip({
  type,
  id,
  name,
  image,
  className,
}: {
  type: RecordType;
  id: string | null | undefined;
  name: string | null | undefined;
  /** A photo (people) or logo (companies), when the record has one. */
  image?: string | null;
  className?: string;
}) {
  const openRecord = useOpenRecord();
  if (!id) return null;
  const label = name ?? "Private record";
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        openRecord(type, id);
      }}
      className={cn(
        "inline-flex h-[22px] max-w-full min-w-0 items-center gap-1.5 rounded-full border border-ky-hairline bg-ky-card py-0 pr-2 pl-[3px] text-left text-[12px] text-ky-ink hover:bg-ky-hover",
        className,
      )}
    >
      <RecordAvatar type={type} name={label} size={16} src={image} />
      <span className={cn("truncate", !name && "text-ky-muted")}>{label}</span>
    </button>
  );
}

export function EmptyState({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[14px] bg-ky-canvas px-6 py-12 text-center">
      <KylonMark size={24} />
      <p className="max-w-[420px] text-[13px] text-ky-ink-2">{title}</p>
      {action}
    </div>
  );
}

export function SkeletonRows({ rows = 8, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="w-full">
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="flex h-10 items-center gap-6 border-b border-ky-divider px-3">
          {Array.from({ length: columns }).map((__, column) => (
            <span
              key={column}
              className="h-3 rounded-[4px] bg-ky-recessed motion-safe:animate-pulse"
              style={{ width: column === 0 ? 180 : 70 + ((row * 13 + column * 29) % 60) }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-center gap-2 text-[13px] text-ky-danger">
      <AlertCircle className="size-4 shrink-0" />
      <span>{message}</span>
      {onRetry ? (
        <button type="button" className="font-semibold underline underline-offset-2" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function PageLoading() {
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <KylonMark size={24} spinning />
    </div>
  );
}
