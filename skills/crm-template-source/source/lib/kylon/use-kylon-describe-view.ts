"use client";

import { useEffect, useRef } from "react";
import { type KylonViewDescription, registerKylonDescribeView } from "./bridge";

/**
 * Tell Kylon what this screen shows. Pass a function that describes the
 * current view, or `null` while there is nothing to describe (the screen is
 * not on top, its data has not loaded). Registration follows only that
 * presence, so the describing function may change identity on every render
 * without re-registering; the latest one is called when the shell asks.
 */
export function useKylonDescribeView(describe: (() => KylonViewDescription | null) | null) {
  const latest = useRef(describe);
  latest.current = describe;
  const enabled = describe !== null;

  useEffect(() => {
    if (!enabled) return;
    return registerKylonDescribeView(() => latest.current?.() ?? null);
  }, [enabled]);
}
