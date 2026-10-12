"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchConversations } from "@/shared/api/conversation-list-api";
import {
  toHistoryItem,
  useAppStore,
  type ConversationHistoryItem,
} from "@/shared/stores";

const SEARCH_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 250;

interface SearchState {
  readonly query: string;
  readonly items: readonly ConversationHistoryItem[];
  readonly total: number;
}

interface AllTasks {
  readonly tasks: readonly ConversationHistoryItem[];
  readonly total: number;
  readonly isLoading: boolean;
  readonly hasMore: boolean;
  readonly error: string | null;
  readonly query: string;
  readonly setQuery: (query: string) => void;
  readonly loadMore: () => Promise<void>;
  readonly removeTask: (id: string) => void;
}

/**
 * Full task list for the /tasks page. Without a query it pages through the
 * shared store (same data as the sidebar); with a query it searches server-side.
 */
export function useAllTasks(): AllTasks {
  const history = useAppStore((s) => s.conversationHistory);
  const historyTotal = useAppStore((s) => s.totalConversations);
  const isLoadingHistory = useAppStore((s) => s.isLoadingHistory);
  const loadMoreHistory = useAppStore((s) => s.loadMore);

  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SearchState | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedQuery = query.trim();

  useEffect(() => {
    if (!trimmedQuery) {
      setSearch(null);
      setError(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { items, total } = await fetchConversations(SEARCH_PAGE_SIZE, 0, trimmedQuery);
        if (!cancelled) {
          setSearch({ query: trimmedQuery, items: items.map(toHistoryItem), total });
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[useAllTasks] search failed:", err);
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmedQuery]);

  const loadMoreSearch = useCallback(async () => {
    if (!search || isSearching || search.items.length >= search.total) return;
    setIsSearching(true);
    try {
      const { items, total } = await fetchConversations(
        SEARCH_PAGE_SIZE,
        search.items.length,
        search.query,
      );
      setSearch((prev) => {
        if (!prev || prev.query !== search.query) return prev;
        const seen = new Set(prev.items.map((t) => t.id));
        return {
          ...prev,
          items: [...prev.items, ...items.map(toHistoryItem).filter((t) => !seen.has(t.id))],
          total,
        };
      });
    } catch (err) {
      console.error("[useAllTasks] load more failed:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSearching(false);
    }
  }, [search, isSearching]);

  const removeTask = useCallback((id: string) => {
    setSearch((prev) =>
      prev
        ? { ...prev, items: prev.items.filter((t) => t.id !== id), total: Math.max(0, prev.total - 1) }
        : prev,
    );
  }, []);

  if (trimmedQuery) {
    const isCurrent = search?.query === trimmedQuery;
    const items = isCurrent ? search.items : [];
    const total = isCurrent ? search.total : 0;
    return {
      tasks: items,
      total,
      isLoading: isSearching || (!isCurrent && error === null),
      hasMore: items.length < total,
      error,
      query,
      setQuery,
      loadMore: loadMoreSearch,
      removeTask,
    };
  }

  return {
    tasks: history,
    total: historyTotal,
    isLoading: isLoadingHistory,
    hasMore: history.length < historyTotal,
    error: null,
    query,
    setQuery,
    loadMore: loadMoreHistory,
    removeTask,
  };
}
