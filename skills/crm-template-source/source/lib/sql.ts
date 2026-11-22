/**
 * Pure SQL helpers shared by server modules and unit tests. Keep this file
 * free of "server-only" imports so node:test can exercise query planning.
 */
export type DbParam = string | number | boolean | Date | null;

export function quoteIdentifier(identifier: string) {
  if (!/^[A-Za-z0-9_]+$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

export function dbValue(value: unknown): DbParam {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Date) return value;
  return JSON.stringify(value);
}
