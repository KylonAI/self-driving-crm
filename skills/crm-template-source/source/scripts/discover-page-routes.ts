import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { PageRoute } from "@/lib/app-definition/agent-documents";

/** File routes are available before build/upload; no previous .next output is read. */
export async function discoverPageRoutes(root: string): Promise<PageRoute[]> {
  const routes = new Map<string, PageRoute>();
  async function walk(directory: string, parts: string[]): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    if (entries.some((entry) => entry.isFile() && /^page\.(tsx?|jsx?|mdx)$/.test(entry.name))) {
      const parameters: string[] = [];
      const segments = parts.filter((part) => !/^\([^)]*\)$/.test(part)).map((part) => {
        const optional = /^\[\[\.\.\.([^\]]+)\]\]$/.exec(part);
        const catchAll = /^\[\.\.\.([^\]]+)\]$/.exec(part);
        const dynamic = /^\[([^\]]+)\]$/.exec(part);
        const name = optional?.[1] ?? catchAll?.[1] ?? dynamic?.[1];
        if (!name) return part;
        parameters.push(name);
        return `{${name}${optional ? "...?" : catchAll ? "..." : ""}}`;
      });
      const path = `/${segments.join("/")}`;
      routes.set(path, { path, parameters });
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith("_") || entry.name.startsWith("@") ||
          /^\(\.{1,3}\)/.test(entry.name)) continue;
      await walk(join(directory, entry.name), [...parts, entry.name]);
    }
  }
  for (const directory of [join(root, "app"), join(root, "src/app")]) {
    try { await walk(directory, []); break; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  return [...routes.values()].sort((a, b) => a.path.localeCompare(b.path));
}
