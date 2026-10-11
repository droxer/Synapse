"use client";

import { useSyncExternalStore, useCallback, useEffect } from "react";
import { fetchSkills, fetchSkillDetail } from "../api/skills-api";
import type { Skill } from "../api/skills-api";

/* ── module-level cache ── */

const cache = new Map<string, Skill>();
const pendingFetches = new Set<string>();
/** Names whose single-skill fetch failed (e.g. 404); cleared on refetch. */
const failedFetches = new Set<string>();
const listeners = new Set<() => void>();
let bulkFetchState: "idle" | "loading" | "done" | "failed" = "idle";

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Snapshot value changes whenever cache is updated. */
let snapshot = 0;
function getSnapshot(): number {
  return snapshot;
}

function bumpSnapshot() {
  snapshot += 1;
  notify();
}

async function doBulkFetch(): Promise<void> {
  if (bulkFetchState !== "idle") return;
  bulkFetchState = "loading";
  try {
    const skills = await fetchSkills();
    for (const skill of skills) {
      cache.set(skill.name, skill);
    }
    bulkFetchState = "done";
    bumpSnapshot();
  } catch {
    bulkFetchState = "failed";
    bumpSnapshot(); // notify so components can show fallback instead of skeleton
  }
}

/** Force re-fetch the full skills list (e.g. after install/uninstall). */
async function refetchSkills(): Promise<void> {
  bulkFetchState = "loading";
  bumpSnapshot();
  try {
    const skills = await fetchSkills();
    cache.clear();
    failedFetches.clear();
    for (const skill of skills) {
      cache.set(skill.name, skill);
    }
    bulkFetchState = "done";
    bumpSnapshot();
  } catch {
    bulkFetchState = "failed";
    bumpSnapshot();
  }
}

async function fetchAndCacheSingle(name: string): Promise<void> {
  if (pendingFetches.has(name)) return;
  pendingFetches.add(name);
  try {
    const skill = await fetchSkillDetail(name);
    cache.set(skill.name, skill);
    bumpSnapshot();
  } catch {
    // Remember the failure so the detail page can show a not-found state
    // instead of a skeleton, and so getSkill doesn't refetch in a loop.
    failedFetches.add(name);
    bumpSnapshot();
  } finally {
    pendingFetches.delete(name);
  }
}

/* ── hook ── */

export function useSkillsCache() {
  // Subscribe to cache changes — triggers re-render when cache updates
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Kick off bulk fetch after mount (not during render)
  useEffect(() => {
    doBulkFetch();
  }, []);

  const getSkill = useCallback((name: string): Skill | null => {
    const cached = cache.get(name) ?? null;
    if (
      cached === null &&
      !failedFetches.has(name) &&
      (bulkFetchState === "done" || bulkFetchState === "failed")
    ) {
      // Skill not cached at all — try individual fetch
      fetchAndCacheSingle(name);
    } else if (cached !== null && cached.instructions === null && !pendingFetches.has(name)) {
      // Cached from bulk fetch without instructions — fetch full detail
      fetchAndCacheSingle(name);
    }
    return cached;
  }, []);

  const getAllSkills = useCallback((): readonly Skill[] => {
    return Array.from(cache.values());
  }, []);

  /** True once the skill is known to be missing (bulk list loaded and single fetch failed). */
  const isSkillMissing = useCallback((name: string): boolean => {
    return !cache.has(name) && failedFetches.has(name);
  }, []);

  const refetch = useCallback(() => {
    refetchSkills();
  }, []);

  const isLoading = bulkFetchState === "idle" || bulkFetchState === "loading";

  return { getSkill, getAllSkills, isSkillMissing, refetch, isLoading } as const;
}
