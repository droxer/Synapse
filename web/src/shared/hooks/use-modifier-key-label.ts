"use client";

import { useSyncExternalStore } from "react";

const MAC_LABEL = "⌘";
const OTHER_LABEL = "Ctrl";

function subscribe(): () => void {
  // Platform never changes during a session.
  return () => {};
}

function getClientSnapshot(): string {
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    navigator.platform ??
    "";
  return /mac|iphone|ipad|ipod/i.test(platform) ? MAC_LABEL : OTHER_LABEL;
}

function getServerSnapshot(): string {
  return MAC_LABEL;
}

/** Returns the label of the primary shortcut modifier for the current platform ("⌘" or "Ctrl"). */
export function useModifierKeyLabel(): string {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
