import type { SelectOption } from "@/lib/app-definition/types";

/** The four status hues of the Kylon palette. Neutral states stay plain text. */
export type Tone = "olive" | "sage" | "sun" | "clay";

export interface Labeled {
  label: string;
  tone: Tone | null;
}

const COLOR_TONE: Record<string, Tone> = {
  green: "olive",
  blue: "sage",
  purple: "sage",
  cyan: "sage",
  indigo: "sage",
  amber: "sun",
  orange: "sun",
  red: "clay",
  rose: "clay",
  pink: "clay",
};

export function labeled(options: SelectOption[] | undefined, value: unknown): Labeled | null {
  if (typeof value !== "string" || !value) return null;
  const option = options?.find((item) => item.id === value);
  return { label: option?.label ?? value, tone: option?.color ? (COLOR_TONE[option.color] ?? null) : null };
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatMoney(value: unknown, currency = "USD", compact = false): string {
  const number = typeof value === "number" ? value : Number(value);
  if (value === null || value === undefined || value === "" || !Number.isFinite(number)) return "";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: compact || Number.isInteger(number) ? 0 : 2,
      ...(compact ? { notation: "compact" } : {}),
    }).format(number);
  } catch {
    return formatNumber(number);
  }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A calendar date (YYYY-MM-DD) as "Mar 4, 2026", without moving it across time zones. */
export function formatDate(value: unknown): string {
  if (typeof value !== "string" || !value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  const current = new Date().getFullYear();
  const monthName = MONTHS[Number(month) - 1] ?? month;
  return Number(year) === current ? `${monthName} ${Number(day)}` : `${monthName} ${Number(day)}, ${year}`;
}

export function formatDateTime(value: unknown): string {
  if (typeof value !== "string" || !value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function relativeTime(value: unknown): string {
  if (typeof value !== "string" || !value) return "";
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (Number.isNaN(diff)) return "";
  const minutes = Math.round(diff / 60000);
  if (Math.abs(minutes) < 1) return "just now";
  if (Math.abs(minutes) < 60) return minutes > 0 ? `${minutes}m ago` : `in ${-minutes}m`;
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return hours > 0 ? `${hours}h ago` : `in ${-hours}h`;
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return days > 0 ? `${days}d ago` : `in ${-days}d`;
  return formatDate(value.slice(0, 10));
}

export function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")).toUpperCase();
}
