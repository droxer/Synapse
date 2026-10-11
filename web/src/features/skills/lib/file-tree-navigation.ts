import type { FileTreeNode } from "../api/skills-api";

/** A tree row currently rendered (its ancestors are all expanded). */
export interface VisibleTreeItem {
  readonly node: FileTreeNode;
  readonly parentPath: string | null;
}

/** Flatten the tree into the rows that are currently visible, in DOM order. */
export function flattenVisible(
  nodes: readonly FileTreeNode[],
  isExpanded: (path: string) => boolean,
  parentPath: string | null = null,
): readonly VisibleTreeItem[] {
  return nodes.flatMap((node) => {
    const self: VisibleTreeItem = { node, parentPath };
    const showChildren = node.type === "directory" && node.children && isExpanded(node.path);
    return showChildren
      ? [self, ...flattenVisible(node.children ?? [], isExpanded, node.path)]
      : [self];
  });
}

export type TreeKeyAction =
  | { readonly kind: "focus"; readonly path: string }
  | { readonly kind: "expand"; readonly path: string }
  | { readonly kind: "collapse"; readonly path: string }
  | { readonly kind: "none" };

/**
 * Resolve a keydown on a tree row into an action, following the WAI-ARIA tree view
 * pattern: Up/Down move, Right expands or enters a folder, Left collapses or moves to the
 * parent, Home/End jump to the first/last visible row.
 */
export function resolveTreeKey(
  key: string,
  items: readonly VisibleTreeItem[],
  currentPath: string,
  isExpanded: (path: string) => boolean,
): TreeKeyAction {
  const index = items.findIndex((item) => item.node.path === currentPath);
  if (index < 0) return { kind: "none" };
  const current = items[index];
  const isDir = current.node.type === "directory";

  switch (key) {
    case "ArrowDown":
      return index < items.length - 1 ? { kind: "focus", path: items[index + 1].node.path } : { kind: "none" };
    case "ArrowUp":
      return index > 0 ? { kind: "focus", path: items[index - 1].node.path } : { kind: "none" };
    case "Home":
      return { kind: "focus", path: items[0].node.path };
    case "End":
      return { kind: "focus", path: items[items.length - 1].node.path };
    case "ArrowRight":
      if (!isDir) return { kind: "none" };
      if (!isExpanded(current.node.path)) return { kind: "expand", path: current.node.path };
      return current.node.children && current.node.children.length > 0
        ? { kind: "focus", path: current.node.children[0].path }
        : { kind: "none" };
    case "ArrowLeft":
      if (isDir && isExpanded(current.node.path)) return { kind: "collapse", path: current.node.path };
      return current.parentPath ? { kind: "focus", path: current.parentPath } : { kind: "none" };
    default:
      return { kind: "none" };
  }
}
