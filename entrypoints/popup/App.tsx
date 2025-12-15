import { useEffect, useMemo, useState } from 'react';
import {
  getAncestorIds,
  getDescendantIds,
  getNodeLabel,
  getNodeRect,
  parseLanhuTree,
  pickExportNode,
  type LanhuRect,
  type LanhuSketchJson,
  type LanhuTree,
} from '@/lib/lanhu';
import './App.css';

type LoadResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

function App() {
  const [pageUrl, setPageUrl] = useState('');
  const [jsonUrl, setJsonUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [raw, setRaw] = useState<LanhuSketchJson | null>(null);
  const [tree, setTree] = useState<LanhuTree | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [exportText, setExportText] = useState('');
  const [view, setView] = useState<'tree' | 'wireframe'>('tree');

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

  const rectIndex = useMemo(() => {
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

  const wireframeViewBox = useMemo(() => {
    if (!tree || !rectIndex) return null;
    const rootId = tree.rootIds[0];
    if (!rootId) return null;
    const root = tree.nodesById[rootId];
    const rootRect = root ? getNodeRect(root) : null;

    const sample = rectIndex.filter((x) => x.id !== rootId).slice(0, 120);
    if (rootRect && sample.length) {
      const inBounds = sample.filter((x) => {
        const r = x.rect;
        return (
          r.left >= 0 &&
          r.top >= 0 &&
          r.left + r.width <= rootRect.width * 1.1 &&
          r.top + r.height <= rootRect.height * 1.1
        );
      }).length;
      if (inBounds / sample.length >= 0.6) {
        return { x: 0, y: 0, width: rootRect.width, height: rootRect.height };
      }
      return { x: rootRect.left, y: rootRect.top, width: rootRect.width, height: rootRect.height };
    }

    let minLeft = Number.POSITIVE_INFINITY;
    let minTop = Number.POSITIVE_INFINITY;
    let maxRight = Number.NEGATIVE_INFINITY;
    let maxBottom = Number.NEGATIVE_INFINITY;
    for (const x of rectIndex) {
      minLeft = Math.min(minLeft, x.rect.left);
      minTop = Math.min(minTop, x.rect.top);
      maxRight = Math.max(maxRight, x.rect.left + x.rect.width);
      maxBottom = Math.max(maxBottom, x.rect.top + x.rect.height);
    }
    if (!Number.isFinite(minLeft) || !Number.isFinite(minTop) || !Number.isFinite(maxRight) || !Number.isFinite(maxBottom)) {
      return null;
    }
    return { x: minLeft, y: minTop, width: maxRight - minLeft, height: maxBottom - minTop };
  }, [tree, rectIndex]);

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

  async function loadByPageUrl(urlOverride?: string) {
    setLoading(true);
    setError(null);
    setExportText('');
    try {
      const finalUrl = (urlOverride ?? pageUrl).trim();
      if (!finalUrl) throw new Error('页面链接为空');

      const res = (await browser.runtime.sendMessage({
        type: 'lanhu.loadFromPageUrl',
        pageUrl: finalUrl,
      })) as LoadResult;
      if (!res?.ok) throw new Error(res?.error || '加载失败');
      applySketchJson(res.data);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadByJsonUrl() {
    setLoading(true);
    setError(null);
    setExportText('');
    try {
      const res = (await browser.runtime.sendMessage({
        type: 'lanhu.loadFromJsonUrl',
        jsonUrl,
      })) as LoadResult;
      if (!res?.ok) throw new Error(res?.error || '加载失败');
      applySketchJson(res.data);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadFromFile(file: File) {
    setLoading(true);
    setError(null);
    setExportText('');
    try {
      const text = await file.text();
      const data = JSON.parse(text) as unknown;
      applySketchJson(data);
    } catch (e) {
      setError(`读取文件失败：${getErrorMessage(e)}`);
    } finally {
      setLoading(false);
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
    setExportText(JSON.stringify(payload, null, 2));
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

  return (
    <div className="app">
      <header className="header">
        <div className="title">Lanhu Layer Tree</div>
        <div className="subtitle">方案 A：树搜索 / 路径选择</div>
      </header>

      <section className="section">
        <div className="row">
          <label className="label">蓝湖页面链接</label>
          <input
            className="input"
            value={pageUrl}
            onChange={(e) => setPageUrl(e.target.value)}
            placeholder="https://lanhuapp.com/web/#/item/project/detailDetach?...&image_id=..."
          />
          <button
            className="btn"
            disabled={loading || !pageUrl.trim()}
            onClick={() => loadByPageUrl()}
          >
            解析并加载
          </button>
        </div>

        <div className="row">
          <label className="label">json_url</label>
          <input
            className="input"
            value={jsonUrl}
            onChange={(e) => setJsonUrl(e.target.value)}
            placeholder="https://alipic.lanhuapp.com/SketchJSON..."
          />
          <button className="btn" disabled={loading || !jsonUrl.trim()} onClick={loadByJsonUrl}>
            加载
          </button>
          <label className="btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <input
              type="file"
              accept="application/json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) loadFromFile(file);
                e.currentTarget.value = '';
              }}
            />
            导入文件…
          </label>
        </div>

        {error ? <div className="error">{error}</div> : null}
        {loading ? <div className="hint">加载中…（需要你已在浏览器登录蓝湖）</div> : null}
        {raw ? (
          <div className="hint">
            已加载节点：{tree ? Object.keys(tree.nodesById).length : 0}
          </div>
        ) : (
          <div className="hint">先加载 SketchJSON，然后在下面树里选中一个节点导出。</div>
        )}
      </section>

      <section className="section split">
        <div className="panel">
          <div className="row" style={{ marginBottom: 10 }}>
            <div className="seg">
              <button
                className={`segBtn ${view === 'wireframe' ? 'active' : ''}`}
                onClick={() => setView('wireframe')}
                disabled={!tree}
              >
                线框图
              </button>
              <button
                className={`segBtn ${view === 'tree' ? 'active' : ''}`}
                onClick={() => setView('tree')}
                disabled={!tree}
              >
                树
              </button>
            </div>

            {view === 'tree' ? (
              <input
                className="input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索 name / id"
              />
            ) : (
              <div className="hint" style={{ marginLeft: 'auto' }}>
                点击线框区域选择
              </div>
            )}
          </div>

          {view === 'wireframe' ? (
            <div className="wireframe">
              {tree && rectIndex && wireframeViewBox ? (
                <WireframeView
                  tree={tree}
                  rectIndex={rectIndex}
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

function WireframeView(props: {
  tree: LanhuTree;
  rectIndex: Array<{ id: string; rect: LanhuRect; area: number }>;
  viewBox: { x: number; y: number; width: number; height: number };
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { tree, rectIndex, viewBox, selectedId, onSelect } = props;

  const layersToDraw = useMemo(() => {
    const max = 4000;
    return rectIndex.slice(0, max);
  }, [rectIndex]);

  function pickIdAtPoint(x: number, y: number): string | null {
    // rectIndex 已按面积从小到大排序，第一次命中就是最“贴合”的节点
    for (const item of rectIndex) {
      const r = item.rect;
      if (x >= r.left && x <= r.left + r.width && y >= r.top && y <= r.top + r.height) {
        return item.id;
      }
    }
    return null;
  }

  function onClickSvg(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const rx = (e.clientX - rect.left) / rect.width;
    const ry = (e.clientY - rect.top) / rect.height;
    const x = viewBox.x + rx * viewBox.width;
    const y = viewBox.y + ry * viewBox.height;
    const id = pickIdAtPoint(x, y);
    if (id) onSelect(id);
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
