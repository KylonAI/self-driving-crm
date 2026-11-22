"use client";

import { useEffect } from "react";

const STORAGE_KEY = "crm-template-theme";

/**
 * Runs before first paint: the Kylon bridge sends no theme, so the App follows
 * the system setting. `?theme=light|dark|system` overrides it and is remembered
 * on this device (useful for review and screenshots).
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var k='${STORAGE_KEY}';var q=new URLSearchParams(location.search).get('theme');if(q==='light'||q==='dark'||q==='system'){localStorage.setItem(k,q)}var s=localStorage.getItem(k)||'system';var d=s==='dark'||(s==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.setAttribute('data-theme',d?'dark':'light');r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light'}catch(e){}})();`;

function apply(dark: boolean) {
  const root = document.documentElement;
  root.setAttribute("data-theme", dark ? "dark" : "light");
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
}

/** Keeps following the system setting while the App is open. */
export function ThemeWatcher() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      const stored = localStorage.getItem(STORAGE_KEY) ?? "system";
      apply(stored === "dark" || (stored === "system" && media.matches));
    };
    const query = new URLSearchParams(window.location.search).get("theme");
    if (query === "light" || query === "dark" || query === "system") localStorage.setItem(STORAGE_KEY, query);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  return null;
}
