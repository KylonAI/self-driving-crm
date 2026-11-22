export interface KylonWorkspaceContext {
  productUrl: string;
  appId: string;
  channelId: string;
}

export type KylonLinkTarget = "_self" | "_blank";

export interface KylonPreviewFile {
  id?: string | null;
  source?: "app_file" | "workspace_file" | string | null;
  workspaceId?: string | null;
  workspaceFileId?: string | null;
  name?: string | null;
  contentType?: string | null;
  previewUrl?: string | null;
  directUrl?: string | null;
  downloadUrl?: string | null;
}

/** One element the person has selected, as the App names it. */
export interface KylonViewSelectionItem {
  id: string;
  /** App-defined element kind, e.g. `text`, `rectangle`, `row`. */
  type?: string;
  /** Short human-readable label for this element. */
  label?: string;
}

/** The region the person has in view, in the App's own coordinates. */
export interface KylonViewViewport {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  zoom?: number;
}

/**
 * What the App reports about its current screen when Kylon asks. The page
 * path is deliberately absent: the shell already tracks where the frame is
 * and never takes the App's word for its own location. Every field is
 * optional; report what the screen actually has. Send the whole selection —
 * Kylon trims it to its own cap and keeps the true count, but an App that
 * pre-trims loses that count.
 */
export interface KylonViewDescription {
  title?: string;
  selection?: KylonViewSelectionItem[];
  viewport?: KylonViewViewport;
  /** App-declared revision of the thing on screen, for a later conflict check. */
  revision?: string;
}

export type KylonDescribeView = () => KylonViewDescription | null | undefined;

declare global {
  interface Window {
    KylonBridge?: {
      navigate?: (href: string, target?: KylonLinkTarget) => boolean;
      previewFile?: (file: KylonPreviewFile, onFallback?: () => void) => boolean;
      /**
       * Register a handler invoked when the Kylon shell asks the embedded App
       * to refresh its data (e.g. after an agent updates App data from the
       * App's thread). Returns an unsubscribe function.
       */
      onRefresh?: (handler: () => void) => () => void;
      /**
       * Register a handler invoked when the Kylon shell asks what is on
       * screen — it runs at the moment a person sends a message with this App
       * open, and the answer travels with that message so the Agent can see
       * the page, selection and viewport they meant. Return `null` to decline;
       * the shell then falls back to the page alone. Returns an unsubscribe
       * function.
       */
      onDescribeView?: (handler: KylonDescribeView) => () => void;
    };
  }
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function getKylonWorkspaceContext(appId: string): KylonWorkspaceContext {
  const channelId =
    process.env.NEXT_PUBLIC_KYLON_CHANNEL_ID ?? process.env.KYLON_CHANNEL_ID ?? "demo";

  return {
    productUrl: trimTrailingSlash(
      process.env.NEXT_PUBLIC_KYLON_PRODUCT_APP_URL ?? "https://app.kylon.io",
    ),
    appId: process.env.NEXT_PUBLIC_KYLON_APP_ID ?? process.env.KYLON_APP_ID ?? appId,
    channelId,
  };
}

export function appRecordThreadHref(
  context: KylonWorkspaceContext,
  entityId: string,
  recordId: string,
) {
  const targetId = [context.appId, entityId, recordId].join("/");
  return `${context.productUrl}/channel/${context.channelId}/thread/app_record/${encodeURIComponent(targetId)}`;
}

export function openKylonUrl(href: string, target: KylonLinkTarget = "_self") {
  if (typeof window === "undefined") return false;
  return window.KylonBridge?.navigate?.(href, target) ?? false;
}

export function previewKylonFile(file: KylonPreviewFile, onFallback?: () => void) {
  if (typeof window === "undefined") return false;
  return window.KylonBridge?.previewFile?.(file, onFallback) ?? false;
}

/**
 * Tell Kylon what this screen shows, until the returned function is called.
 *
 * Registers with `window.KylonBridge.onDescribeView`. The bridge script loads
 * after hydration, so this also registers on the `kylon:bridge-ready` event
 * to avoid a load-order race. Outside Kylon (the App opened directly in a
 * browser) the bridge is absent and this is a no-op. `useKylonDescribeView`
 * is the React form.
 */
export function registerKylonDescribeView(describe: KylonDescribeView): () => void {
  if (typeof window === "undefined") return () => undefined;
  let unsubscribe: (() => void) | undefined;

  function register() {
    if (unsubscribe) return;
    unsubscribe = window.KylonBridge?.onDescribeView?.(describe);
  }

  register();
  window.addEventListener("kylon:bridge-ready", register);
  return () => {
    window.removeEventListener("kylon:bridge-ready", register);
    unsubscribe?.();
    unsubscribe = undefined;
  };
}
