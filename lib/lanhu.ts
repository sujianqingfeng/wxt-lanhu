export type LanhuRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type LanhuLayerNode = {
  id?: string;
  name?: string;
  type?: string | null;
  frame?: Partial<LanhuRect>;
  realFrame?: Partial<LanhuRect>;
  combinedFrame?: Partial<LanhuRect>;
  layers?: LanhuLayerNode[];
  transform?: unknown;
  [key: string]: unknown;
};

export type LanhuSketchJson = {
  meta?: unknown;
  assets?: unknown;
  artboard?: LanhuLayerNode;
  [key: string]: unknown;
};

export type LanhuTree = {
  nodesById: Record<string, LanhuLayerNode>;
  childrenById: Record<string, string[]>;
  parentById: Record<string, string | null>;
  rootIds: string[];
};

export function parseLanhuTree(sketchJson: LanhuSketchJson): LanhuTree {
  const artboard = sketchJson.artboard;
  if (!artboard || typeof artboard !== 'object') {
    return { nodesById: {}, childrenById: {}, parentById: {}, rootIds: [] };
  }

  const nodesById: Record<string, LanhuLayerNode> = {};
  const childrenById: Record<string, string[]> = {};
  const parentById: Record<string, string | null> = {};
  const rootIds: string[] = [];

  const rootId = artboard.id;
  if (!rootId) return { nodesById: {}, childrenById: {}, parentById: {}, rootIds: [] };

  rootIds.push(rootId);
  parentById[rootId] = null;
  nodesById[rootId] = artboard;

  const stack: Array<{ parentId: string; nodes: LanhuLayerNode[] }> = [];
  if (Array.isArray(artboard.layers) && artboard.layers.length) {
    stack.push({ parentId: rootId, nodes: artboard.layers });
  }

  while (stack.length) {
    const { parentId, nodes } = stack.pop()!;
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue;
      if (!node.id) continue;

      const id = node.id;
      nodesById[id] = node;
      parentById[id] = parentId;
      (childrenById[parentId] ??= []).push(id);

      if (Array.isArray(node.layers) && node.layers.length) {
        stack.push({ parentId: id, nodes: node.layers });
      }
    }
  }

  return { nodesById, childrenById, parentById, rootIds };
}

export function getNodeLabel(node: LanhuLayerNode): string {
  const name = (node.name ?? '').trim();
  const type = (node.type ?? '').toString().trim();
  if (name && type) return `${name} (${type})`;
  if (name) return name;
  if (type) return `(${type})`;
  return '(unnamed)';
}

export function getNodeRect(node: LanhuLayerNode): LanhuRect | null {
  const frame = node.frame ?? node.realFrame ?? node.combinedFrame ?? null;
  if (
    frame &&
    isFiniteNumber(frame.left) &&
    isFiniteNumber(frame.top) &&
    isFiniteNumber(frame.width) &&
    isFiniteNumber(frame.height)
  ) {
    return { left: frame.left, top: frame.top, width: frame.width, height: frame.height };
  }
  return null;
}

export function getAncestorIds(tree: LanhuTree, id: string): string[] {
  const result: string[] = [];
  let currentId = id;
  while (true) {
    const parentId = tree.parentById[currentId];
    if (!parentId) break;
    result.push(parentId);
    currentId = parentId;
  }
  return result;
}

export function getDescendantIds(tree: LanhuTree, rootId: string, includeSelf = true): string[] {
  const result: string[] = [];
  const queue: string[] = [];
  if (includeSelf) result.push(rootId);
  queue.push(rootId);
  while (queue.length) {
    const id = queue.shift()!;
    const childIds = tree.childrenById[id] ?? [];
    for (const childId of childIds) {
      result.push(childId);
      queue.push(childId);
    }
  }
  return result;
}

export function pickExportNode(node: LanhuLayerNode): Record<string, unknown> {
  return {
    id: node.id,
    name: node.name ?? null,
    type: node.type ?? null,
    frame: node.frame ?? null,
    realFrame: node.realFrame ?? null,
    combinedFrame: node.combinedFrame ?? null,
    transform: node.transform ?? null,
    opacity: node.opacity ?? null,
    visible: node.visible ?? null,
    rotation: node.rotation ?? null,
    clipped: node.clipped ?? null,
    isMask: node.isMask ?? null,
    origin: node.origin ?? null,
    radius: node.radius ?? null,
    style: node.style ?? null,
    paths: node.paths ?? null,
    text: node.text ?? null,
    image: node.image ?? null,
    sharedStyle: node.sharedStyle ?? null,
  };
}

export function compactJson(value: unknown): unknown {
  if (value == null) return undefined;
  if (Array.isArray(value)) {
    const next = value
      .map((v) => compactJson(v))
      .filter((v) => v !== undefined);
    return next.length ? next : undefined;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      const cv = compactJson(v);
      if (cv !== undefined) next[k] = cv;
    }
    return Object.keys(next).length ? next : undefined;
  }
  return value;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
