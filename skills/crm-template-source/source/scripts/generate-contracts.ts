import { mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildAppRegistration } from "@/lib/app-definition/contracts";
import { appDefinition } from "@/lib/app-definition/definition";
import { discoverPageRoutes } from "./discover-page-routes";

// Package scripts run in the App root, including the CommonJS Mission Control template.
const root = process.cwd();
async function generate() {
  let staging: string | undefined;
  try {
    const registration = buildAppRegistration(appDefinition, await discoverPageRoutes(root));
    const files = {
      "manifest.json": `${JSON.stringify(registration.manifest, null, 2)}\n`,
      "openapi.json": `${JSON.stringify(registration.openapi, null, 2)}\n`,
      "app-registration.json": `${JSON.stringify(registration, null, 2)}\n`,
      "llms.txt": registration.agent_docs!,
    };
    staging = await mkdtemp(join(root, ".contracts-"));
    await Promise.all(Object.entries(files).map(([name, content]) => writeFile(join(staging!, name), content)));
    const generated = join(root, "generated");
    const backup = `${staging}-previous`;
    let previous = false;
    try { await rename(generated, backup); previous = true; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    try { await rename(staging, generated); staging = undefined; }
    catch (error) { if (previous) await rename(backup, generated); throw error; }
    if (previous) await rm(backup, { recursive: true });
    console.log(`Generated App contracts and Agent documentation (${registration.manifest.docs?.revision}).`);
  } catch (error) {
    if (staging) await rm(staging, { recursive: true, force: true });
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

void generate();
