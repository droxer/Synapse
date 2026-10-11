"use client";

import { useState, useCallback, useMemo, useRef, type KeyboardEvent } from "react";
import {
  ChevronRight,
  ChevronDown,
  FileText,
  FileCode,
  FileJson,
  File,
  Folder,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import type { FileTreeNode } from "../api/skills-api";
import { flattenVisible, resolveTreeKey } from "../lib/file-tree-navigation";

interface FileTreeProps {
  readonly nodes: readonly FileTreeNode[];
  readonly selectedPath: string | null;
  readonly onSelectFile: (path: string) => void;
  /** Accessible name for the tree (e.g. "Skill files"). */
  readonly ariaLabel: string;
}

const ICON_BY_EXT: Record<string, typeof File> = {
  ".md": FileText,
  ".txt": FileText,
  ".py": FileCode,
  ".ts": FileCode,
  ".tsx": FileCode,
  ".js": FileCode,
  ".jsx": FileCode,
  ".xml": FileCode,
  ".html": FileCode,
  ".css": FileCode,
  ".sh": FileCode,
  ".yaml": FileCode,
  ".yml": FileCode,
  ".toml": FileCode,
  ".json": FileJson,
};

export function getFileIcon(name: string) {
  const ext = name.includes(".") ? `.${name.split(".").pop()}` : "";
  return ICON_BY_EXT[ext.toLowerCase()] ?? File;
}

/** Collect all ancestor directory paths for the selected file. */
function collectExpandedPaths(
  nodes: readonly FileTreeNode[],
  selectedPath: string | null,
  _parentPath: string = "",
): Set<string> {
  const result = new Set<string>();
  if (!selectedPath) return result;

  for (const node of nodes) {
    if (node.type === "directory" && node.children) {
      const childPaths = collectExpandedPaths(node.children, selectedPath, node.path);
      if (childPaths.size > 0 || selectedPath.startsWith(node.path + "/")) {
        result.add(node.path);
        for (const p of childPaths) result.add(p);
      }
    }
  }
  return result;
}

export function FileTree({ nodes, selectedPath, onSelectFile, ariaLabel }: FileTreeProps) {
  // Auto-expand directories containing the selected file
  const autoExpanded = useMemo(
    () => collectExpandedPaths(nodes, selectedPath),
    [nodes, selectedPath],
  );

  const [manualExpanded, setManualExpanded] = useState<Set<string>>(new Set());
  const [manualCollapsed, setManualCollapsed] = useState<Set<string>>(new Set());
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());

  const isExpanded = useCallback(
    (path: string) => {
      if (manualCollapsed.has(path)) return false;
      if (manualExpanded.has(path)) return true;
      return autoExpanded.has(path);
    },
    [autoExpanded, manualExpanded, manualCollapsed],
  );

  const setDirExpanded = useCallback((path: string, expand: boolean) => {
    const without = (prev: Set<string>) => {
      const next = new Set(prev);
      next.delete(path);
      return next;
    };
    if (expand) {
      setManualExpanded((prev) => new Set([...prev, path]));
      setManualCollapsed(without);
    } else {
      setManualCollapsed((prev) => new Set([...prev, path]));
      setManualExpanded(without);
    }
  }, []);

  const toggleDir = useCallback(
    (path: string) => setDirExpanded(path, !isExpanded(path)),
    [isExpanded, setDirExpanded],
  );

  const visibleItems = useMemo(() => flattenVisible(nodes, isExpanded), [nodes, isExpanded]);

  // Roving tabindex: exactly one row is tabbable — the last focused row, else the
  // selected file, else the first row.
  const tabbablePath =
    [focusedPath, selectedPath].find(
      (path) => path !== null && visibleItems.some((item) => item.node.path === path),
    ) ?? visibleItems[0]?.node.path ?? null;

  const focusItem = useCallback((path: string) => {
    setFocusedPath(path);
    itemRefs.current.get(path)?.focus();
  }, []);

  const registerItem = useCallback((path: string, el: HTMLButtonElement | null) => {
    if (el) itemRefs.current.set(path, el);
    else itemRefs.current.delete(path);
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, path: string) => {
      const action = resolveTreeKey(event.key, visibleItems, path, isExpanded);
      if (action.kind === "none") return;
      event.preventDefault();
      if (action.kind === "focus") focusItem(action.path);
      else setDirExpanded(action.path, action.kind === "expand");
    },
    [focusItem, isExpanded, setDirExpanded, visibleItems],
  );

  return (
    <div role="tree" aria-label={ariaLabel} className="py-1">
      {nodes.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          tabbablePath={tabbablePath}
          onSelectFile={onSelectFile}
          isExpanded={isExpanded}
          onToggleDir={toggleDir}
          onFocusItem={setFocusedPath}
          onKeyDown={handleKeyDown}
          registerItem={registerItem}
        />
      ))}
    </div>
  );
}

interface TreeNodeProps {
  readonly node: FileTreeNode;
  readonly depth: number;
  readonly selectedPath: string | null;
  readonly tabbablePath: string | null;
  readonly onSelectFile: (path: string) => void;
  readonly isExpanded: (path: string) => boolean;
  readonly onToggleDir: (path: string) => void;
  readonly onFocusItem: (path: string) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, path: string) => void;
  readonly registerItem: (path: string, el: HTMLButtonElement | null) => void;
}

function groupId(path: string): string {
  return `skill-tree-group-${path.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function TreeNode(props: TreeNodeProps) {
  const { node, depth, selectedPath, tabbablePath, onSelectFile, isExpanded, onToggleDir } = props;
  const isDir = node.type === "directory";
  const expanded = isDir && isExpanded(node.path);
  const isSelected = !isDir && node.path === selectedPath;
  const hasGroup = expanded && Boolean(node.children);
  const FileIcon = isDir
    ? expanded ? FolderOpen : Folder
    : getFileIcon(node.name);

  const handleClick = () => {
    if (isDir) {
      onToggleDir(node.path);
    } else {
      onSelectFile(node.path);
    }
  };

  return (
    <>
      <button
        ref={(el) => props.registerItem(node.path, el)}
        type="button"
        role="treeitem"
        tabIndex={node.path === tabbablePath ? 0 : -1}
        aria-level={depth + 1}
        aria-selected={isDir ? undefined : isSelected}
        aria-expanded={isDir ? expanded : undefined}
        aria-owns={hasGroup ? groupId(node.path) : undefined}
        onClick={handleClick}
        onFocus={() => props.onFocusItem(node.path)}
        onKeyDown={(event) => props.onKeyDown(event, node.path)}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left font-sans text-caption",
          "transition-colors hover:bg-background/70",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40",
          isSelected ? "bg-background text-foreground" : "text-muted-foreground",
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {isDir ? (
          expanded ? (
            <ChevronDown aria-hidden="true" className="h-3 w-3 shrink-0 opacity-60" />
          ) : (
            <ChevronRight aria-hidden="true" className="h-3 w-3 shrink-0 opacity-60" />
          )
        ) : (
          <span aria-hidden="true" className="h-3 w-3 shrink-0" />
        )}
        <FileIcon aria-hidden="true" className={cn(
          "h-3.5 w-3.5 shrink-0",
          isDir ? "text-muted-foreground" : "opacity-60",
        )} />
        <span className="min-w-0 truncate">{node.name}</span>
      </button>
      {hasGroup && (
        <div role="group" id={groupId(node.path)}>
          {node.children?.map((child) => (
            <TreeNode key={child.path} {...props} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </>
  );
}
