import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getAncestorIds,
  getDescendantIds,
  getNodeLabel,
  getNodeRect,
  parseLanhuTree,
  pickExportNode,
  compactJson,
  type LanhuRect,
  type LanhuSketchJson,
  type LanhuTree,
} from '@/lib/lanhu';
import './App.css';

type LoadResult =
  | { ok: true; data: unknown; meta?: { cached: boolean; fetchedAt: number; jsonUrl?: string } }
  | { ok: false; error: string };

function App() {
  const [pageUrl, setPageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMeta, setLoadMeta] = useState<{ cached: boolean; fetchedAt: number; jsonUrl?: string } | null>(
    null,
  );

  const [raw, setRaw] = useState<LanhuSketchJson | null>(null);
  const [tree, setTree] = useState<LanhuTree | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [exportText, setExportText] = useState('');
  const [view, setView] = useState<'tree' | 'wireframe'>('tree');
  const [compactExport, setCompactExport] = useState(true);
  const [hiddenById, setHiddenById] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        const url = tabs?.[0]?.url ?? '';
        if (!url) return;
        if (canceled) return;
        setPageUrl(url);
      } catch (e) {
        if (canceled) return;
        setError(`获取当前页面 URL 失败：${getErrorMessage(e)}`);
      }
    })();
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    if (!pageUrl) return;
    if (!pageUrl.startsWith('https://lanhuapp.com/web/')) return;
    void (async () => {
      try {
        const res = (await browser.runtime.sendMessage({
          type: 'lanhu.getCachedFromPageUrl',
          pageUrl,
        })) as LoadResult;
        if (res?.ok) {
          setLoadMeta(res.meta ?? null);
          applySketchJson(res.data);
        }
      } catch {
        // ignore cache read errors
      }
    })();
  }, [pageUrl]);

  const rectIndexAll = useMemo(() => {
    if (!tree) return null;
    const items: Array<{ id: string; rect: LanhuRect; area: number }> = [];
    for (const [id, node] of Object.entries(tree.nodesById)) {
      const rect = getNodeRect(node);
      if (!rect) continue;
      const area = rect.width * rect.height;
      if (!Number.isFinite(area) || area <= 0) continue;
      items.push({ id, rect, area });
    }
    items.sort((a, b) => a.area - b.area);
    return items;
  }, [tree]);

  const rectIndexVisible = useMemo(() => {
    if (!rectIndexAll) return null;
    if (!Object.keys(hiddenById).length) return rectIndexAll;
    return rectIndexAll.filter((x) => !hiddenById[x.id]);
  }, [rectIndexAll, hiddenById]);

  const wireframeViewBox = useMemo(() => {
    if (!tree || !rectIndexVisible) return null;
    const rootId = tree.rootIds[0];
    if (!rootId) return null;
    const root = tree.nodesById[rootId];
    const rootRect = root ? getNodeRect(root) : null;

    // 统一使用画板宽高，但坐标从 (0, 0) 开始；
    // 画板本身在 SketchJSON 里通常是全局坐标（left 很大），
    // 子节点是相对坐标（0 ~ width），这里直接用相对坐标系渲染。
    if (rootRect && Number.isFinite(rootRect.width) && Number.isFinite(rootRect.height)) {
      if (rootRect.width > 0 && rootRect.height > 0) {
        return { x: 0, y: 0, width: rootRect.width, height: rootRect.height };
      }
    }

    let minLeft = Number.POSITIVE_INFINITY;
    let minTop = Number.POSITIVE_INFINITY;
    let maxRight = Number.NEGATIVE_INFINITY;
    let maxBottom = Number.NEGATIVE_INFINITY;
    for (const x of rectIndexVisible) {
      minLeft = Math.min(minLeft, x.rect.left);
      minTop = Math.min(minTop, x.rect.top);
      maxRight = Math.max(maxRight, x.rect.left + x.rect.width);
      maxBottom = Math.max(maxBottom, x.rect.top + x.rect.height);
    }
    if (!Number.isFinite(minLeft) || !Number.isFinite(minTop) || !Number.isFinite(maxRight) || !Number.isFinite(maxBottom)) {
      return null;
    }
    return { x: minLeft, y: minTop, width: maxRight - minLeft, height: maxBottom - minTop };
  }, [tree, rectIndexVisible]);

  const visibleIds = useMemo(() => {
    if (!tree) return null;
    const q = search.trim().toLowerCase();
    if (!q) return null;

    const keep = new Set<string>();
    for (const [id, node] of Object.entries(tree.nodesById)) {
      const name = (node.name ?? '').toString().toLowerCase();
      if (id.toLowerCase().includes(q) || name.includes(q)) {
        keep.add(id);
        for (const ancestorId of getAncestorIds(tree, id)) keep.add(ancestorId);
      }
    }
    for (const rootId of tree.rootIds) keep.add(rootId);
    return keep;
  }, [tree, search]);

  async function loadByPageUrl(force: boolean) {
    setLoading(true);
    setError(null);
    setExportText('');
    try {
      const finalUrl = pageUrl.trim();
      if (!finalUrl) throw new Error('页面链接为空');

      const res = (await browser.runtime.sendMessage({
        type: 'lanhu.loadFromPageUrl',
        pageUrl: finalUrl,
        force,
      })) as LoadResult;
      if (!res?.ok) throw new Error(res?.error || '加载失败');
      setLoadMeta(res.meta ?? null);
      applySketchJson(res.data);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function clearCache() {
    try {
      await browser.runtime.sendMessage({ type: 'lanhu.clearCache' });
      setLoadMeta(null);
    } catch (e) {
      setError(`清除缓存失败：${getErrorMessage(e)}`);
    }
  }

  function applySketchJson(data: unknown) {
    if (!data || typeof data !== 'object') throw new Error('SketchJSON 不是对象');
    const sketchJson = data as LanhuSketchJson;
    const nextTree = parseLanhuTree(sketchJson);
    if (!Object.keys(nextTree.nodesById).length)
      throw new Error('SketchJSON 里没解析到 artboard/layers 节点');
    setRaw(sketchJson);
    setTree(nextTree);
    const defaultRoot = nextTree.rootIds[0] ?? null;
    setSelectedId(defaultRoot);
    setExpanded(Object.fromEntries(nextTree.rootIds.map((id) => [id, true])));
    setView('wireframe');
    setHiddenById({});
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function exportSelectedDescendants() {
    if (!tree || !selectedId) return;
    const ids = getDescendantIds(tree, selectedId, true);
    const nodes = ids.map((id) => pickExportNode(tree.nodesById[id]));
    const parentById: Record<string, string | null> = {};
    for (const id of ids) parentById[id] = tree.parentById[id] ?? null;
    const payload = {
      selectedId,
      count: nodes.length,
      parentById,
      nodes,
    };
    const out = compactExport ? (compactJson(payload) ?? payload) : payload;
    setExportText(JSON.stringify(out, null, 2));
  }

  function exportVisuallyContained() {
    if (!tree || !selectedId || !rectIndexAll) return;
    const containerRect = getNodeRect(tree.nodesById[selectedId]);
    if (!containerRect) return;

    const included = new Set<string>();
    for (const { id, rect } of rectIndexAll) {
      if (isRectInside(rect, containerRect)) included.add(id);
    }
    included.add(selectedId);

    const ids = getTreePreorderIds(tree, included);
    const nodes = ids.map((id) => pickExportNode(tree.nodesById[id]));
    const parentById: Record<string, string | null> = {};
    for (const id of ids) parentById[id] = tree.parentById[id] ?? null;

    const payload = {
      selectedId,
      count: nodes.length,
      parentById,
      nodes,
    };
    const out = compactExport ? (compactJson(payload) ?? payload) : payload;
    setExportText(JSON.stringify(out, null, 2));
  }

  function hideSelectedInWireframe() {
    if (!selectedId) return;
    setHiddenById((prev) => {
      if (prev[selectedId]) return prev;
      return { ...prev, [selectedId]: true };
    });
  }

  function unhideSelectedInWireframe() {
    if (!selectedId) return;
    setHiddenById((prev) => {
      if (!prev[selectedId]) return prev;
      const next = { ...prev };
      delete next[selectedId];
      return next;
    });
  }

  function unhideAllInWireframe() {
    setHiddenById({});
  }

  async function copyExport() {
    if (!exportText) return;
    try {
      await navigator.clipboard.writeText(exportText);
    } catch (e) {
      setError(`复制失败：${getErrorMessage(e)}`);
    }
  }

  const selectedNode = selectedId && tree ? tree.nodesById[selectedId] : null;
  const selectedRect = selectedNode ? getNodeRect(selectedNode) : null;
  const selectedChildrenCount =
    selectedId && tree ? (tree.childrenById[selectedId]?.length ?? 0) : 0;
  const selectedDescCount =
    selectedId && tree ? getDescendantIds(tree, selectedId, false).length : 0;
  const hiddenCount = useMemo(() => Object.keys(hiddenById).length, [hiddenById]);

  const headerHint = useMemo(() => {
    if (!raw) return '';
    const nodeCount = tree ? Object.keys(tree.nodesById).length : 0;
    const parts = [`已加载节点：${nodeCount}`];
    if (loadMeta) {
      parts.push(loadMeta.cached ? '来自缓存' : '最新请求');
      parts.push(new Date(loadMeta.fetchedAt).toLocaleString());
    }
    return parts.join(' · ');
  }, [raw, tree, loadMeta]);

  return (
    <div className="app">
      <header className="header">
        <div className="headerLeft">
          <div className="title">Lanhu Layer Tree</div>
          {headerHint ? (
            <div className="headerHint" title={headerHint}>
              {headerHint}
            </div>
          ) : null}
        </div>

        <div className="headerRight">
          <div className="seg">
            <button
              className={`segBtn ${view === 'wireframe' ? 'active' : ''}`}
              onClick={() => setView('wireframe')}
              disabled={!tree}
              title="线框图"
            >
              线框图
            </button>
            <button
              className={`segBtn ${view === 'tree' ? 'active' : ''}`}
              onClick={() => setView('tree')}
              disabled={!tree}
              title="树"
            >
              树
            </button>
          </div>

          <IconButton
            title="加载（优先使用缓存）"
            ariaLabel="加载"
            disabled={loading || !pageUrl.startsWith('https://lanhuapp.com/web/')}
            onClick={() => loadByPageUrl(false)}
          >
            <IconDownload />
          </IconButton>
          <IconButton
            title="刷新（忽略缓存，重新请求）"
            ariaLabel="刷新"
            disabled={loading || !pageUrl.startsWith('https://lanhuapp.com/web/')}
            onClick={() => loadByPageUrl(true)}
          >
            <IconRefresh />
          </IconButton>
          <IconButton
            title="清除缓存"
            ariaLabel="清除缓存"
            disabled={loading}
            onClick={clearCache}
          >
            <IconTrash />
          </IconButton>
        </div>
      </header>

      <div className="topNotes">
        {error ? <div className="error">{error}</div> : null}
        {loading ? <div className="hint">加载中…（需要你已在浏览器登录蓝湖）</div> : null}
        {!raw ? <div className="hint">点击右上角“加载”开始。</div> : null}
      </div>

      <section className="section split">
        <div className="panel">
          {view === 'tree' ? (
            <div className="row" style={{ marginBottom: 10 }}>
              <input
                className="input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索 name / id"
              />
            </div>
          ) : null}

          {view === 'wireframe' ? (
            <div className="wireframe">
              {tree && rectIndexVisible && wireframeViewBox ? (
                <WireframeView
                  tree={tree}
                  rectIndex={rectIndexVisible}
                  viewBox={wireframeViewBox}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              ) : (
                <div className="hint">暂无数据</div>
              )}
            </div>
          ) : (
            <div className="tree">
              {tree ? (
                tree.rootIds.map((id) => (
                  <TreeNode
                    key={id}
                    id={id}
                    depth={0}
                    tree={tree}
                    selectedId={selectedId}
                    expanded={expanded}
                    visibleIds={visibleIds}
                    onToggle={toggleExpanded}
                    onSelect={setSelectedId}
                  />
                ))
              ) : (
                <div className="hint">暂无数据</div>
              )}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="meta">
            <div className="metaRow">
              <div className="metaKey">选中</div>
              <div className="metaVal">{selectedId ?? '-'}</div>
            </div>
            <div className="metaRow">
              <div className="metaKey">标题</div>
              <div className="metaVal">{selectedNode ? getNodeLabel(selectedNode) : '-'}</div>
            </div>
            <div className="metaRow">
              <div className="metaKey">Children</div>
              <div className="metaVal">{selectedNode ? selectedChildrenCount : '-'}</div>
            </div>
            <div className="metaRow">
              <div className="metaKey">Descendants</div>
              <div className="metaVal">{selectedNode ? selectedDescCount : '-'}</div>
            </div>
            <div className="metaRow">
              <div className="metaKey">Frame</div>
              <div className="metaVal">
                {selectedRect
                  ? `left=${selectedRect.left}, top=${selectedRect.top}, w=${selectedRect.width}, h=${selectedRect.height}`
                  : '-'}
              </div>
            </div>
          </div>

          <div className="row">
            <button className="btn" disabled={!tree || !selectedId} onClick={exportSelectedDescendants}>
              导出 descendants
            </button>
            <button
              className="btn"
              disabled={!tree || !selectedId || !rectIndexAll}
              onClick={exportVisuallyContained}
              title="导出选中框内所有节点（按 frame/realFrame/combinedFrame 的几何包含判断）"
            >
              导出 包含
            </button>
            <label className="chk">
              <input
                type="checkbox"
                checked={compactExport}
                onChange={(e) => setCompactExport(e.target.checked)}
              />
              过滤空字段
            </label>
          </div>

          <div className="row">
            <button
              className="btn"
              disabled={!selectedId || view !== 'wireframe' || !!hiddenById[selectedId]}
              onClick={hideSelectedInWireframe}
              title="仅影响线框图显示/点选，不影响树视图与导出"
            >
              隐藏选中
            </button>
            <button
              className="btn"
              disabled={!selectedId || view !== 'wireframe' || !hiddenById[selectedId]}
              onClick={unhideSelectedInWireframe}
            >
              取消隐藏
            </button>
            <button
              className="btn"
              disabled={view !== 'wireframe' || !hiddenCount}
              onClick={unhideAllInWireframe}
              title={hiddenCount ? `已隐藏 ${hiddenCount} 个` : undefined}
            >
              恢复全部
            </button>
            <button className="btn" disabled={!exportText} onClick={copyExport}>
              复制 JSON
            </button>
          </div>

          <textarea className="textarea" readOnly value={exportText} placeholder="导出结果会出现在这里" />
        </div>
      </section>
    </div>
  );
}

export default App;

function isRectInside(inner: LanhuRect, outer: LanhuRect): boolean {
  const eps = 0.01;
  const innerRight = inner.left + inner.width;
  const innerBottom = inner.top + inner.height;
  const outerRight = outer.left + outer.width;
  const outerBottom = outer.top + outer.height;
  return (
    inner.left >= outer.left - eps &&
    inner.top >= outer.top - eps &&
    innerRight <= outerRight + eps &&
    innerBottom <= outerBottom + eps
  );
}

function getTreePreorderIds(tree: LanhuTree, included: Set<string>): string[] {
  const result: string[] = [];
  const stack: Array<{ id: string; idx: number }> = [];

  for (let i = tree.rootIds.length - 1; i >= 0; i--) {
    const rootId = tree.rootIds[i];
    stack.push({ id: rootId, idx: -1 });
  }

  while (stack.length) {
    const top = stack[stack.length - 1]!;
    if (top.idx === -1) {
      top.idx = 0;
      if (included.has(top.id)) result.push(top.id);
    }

    const children = tree.childrenById[top.id] ?? [];
    if (top.idx >= children.length) {
      stack.pop();
      continue;
    }

    const childId = children[top.idx]!;
    top.idx++;
    stack.push({ id: childId, idx: -1 });
  }

  return result;
}

function TreeNode(props: {
  id: string;
  depth: number;
  tree: LanhuTree;
  selectedId: string | null;
  expanded: Record<string, boolean>;
  visibleIds: Set<string> | null;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const { id, depth, tree, selectedId, expanded, visibleIds, onToggle, onSelect } = props;
  const node = tree.nodesById[id];
  if (!node) return null;

  if (visibleIds && !visibleIds.has(id)) return null;

  const childIds = tree.childrenById[id] ?? [];
  const isExpanded = expanded[id] ?? depth < 1;
  const hasChildren = childIds.length > 0;
  const isSelected = selectedId === id;

  return (
    <div className="treeNode">
      <div
        className={`treeRow ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        <button
          className="twisty"
          disabled={!hasChildren}
          onClick={() => onToggle(id)}
          title={hasChildren ? (isExpanded ? '收起' : '展开') : '无子节点'}
        >
          {hasChildren ? (isExpanded ? '▾' : '▸') : '·'}
        </button>
        <button className="treeBtn" onClick={() => onSelect(id)} title={id}>
          {getNodeLabel(node)}
        </button>
      </div>

      {hasChildren && isExpanded ? (
        <div className="treeChildren">
          {childIds.map((childId) => (
            <TreeNode
              key={childId}
              id={childId}
              depth={depth + 1}
              tree={tree}
              selectedId={selectedId}
              expanded={expanded}
              visibleIds={visibleIds}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function IconButton(props: {
  title: string;
  ariaLabel: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const { title, ariaLabel, disabled, onClick, children } = props;
  return (
    <button
      type="button"
      className="iconBtn"
      title={title}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function IconDownload() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3v10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 11l4 4 4-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 21h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M21 12a9 9 0 1 1-3-6.7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 3v6h-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 6h18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 6V4h8v2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 6l-1 14H6L5 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 11v6M14 11v6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WireframeView(props: {
  tree: LanhuTree;
  rectIndex: Array<{ id: string; rect: LanhuRect; area: number }>;
  viewBox: { x: number; y: number; width: number; height: number };
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { tree, rectIndex, viewBox, selectedId, onSelect } = props;
  const lastPickRef = useRef<{ sig: string } | null>(null);

  const layersToDraw = useMemo(() => {
    const max = 4000;
    return rectIndex.slice(0, max);
  }, [rectIndex]);

  function pickCandidatesAtPoint(x: number, y: number): string[] {
    const candidates: string[] = [];
    for (const item of rectIndex) {
      const r = item.rect;
      if (x >= r.left && x <= r.left + r.width && y >= r.top && y <= r.top + r.height) {
        candidates.push(item.id);
      }
    }
    return candidates;
  }

  function onClickSvg(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const rx = (e.clientX - rect.left) / rect.width;
    const ry = (e.clientY - rect.top) / rect.height;
    const x = viewBox.x + rx * viewBox.width;
    const y = viewBox.y + ry * viewBox.height;
    const candidateIds = pickCandidatesAtPoint(x, y);
    if (!candidateIds.length) return;

    const sig = candidateIds.join('|');
    let nextId = candidateIds[0];

    // 同一区域重复点击：从小到大“扩选”（选更大的框），直到最大的候选
    if (lastPickRef.current?.sig === sig && selectedId) {
      const idx = candidateIds.indexOf(selectedId);
      if (idx >= 0 && idx < candidateIds.length - 1) nextId = candidateIds[idx + 1];
      else if (idx >= 0) nextId = candidateIds[idx];
    }

    lastPickRef.current = { sig };
    onSelect(nextId);
  }

  const selectedRect = selectedId ? getNodeRect(tree.nodesById[selectedId]) : null;

  return (
    <svg
      className="wireframeSvg"
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
      preserveAspectRatio="xMidYMid meet"
      onClick={onClickSvg}
    >
      <rect
        x={viewBox.x}
        y={viewBox.y}
        width={viewBox.width}
        height={viewBox.height}
        fill="#ffffff"
        stroke="#e5e7eb"
        strokeWidth={1}
      />

      {layersToDraw.map(({ id, rect }) => {
        const node = tree.nodesById[id];
        const label = node ? getNodeLabel(node) : id;
        return (
          <rect
            key={id}
            x={rect.left}
            y={rect.top}
            width={rect.width}
            height={rect.height}
            fill="transparent"
            stroke="rgba(17, 24, 39, 0.22)"
            strokeWidth={1}
          >
            <title>{label}</title>
          </rect>
        );
      })}

      {selectedRect ? (
        <rect
          x={selectedRect.left}
          y={selectedRect.top}
          width={selectedRect.width}
          height={selectedRect.height}
          fill="transparent"
          stroke="#6366f1"
          strokeWidth={2}
        />
      ) : null}
    </svg>
  );
}
