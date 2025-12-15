# Lanhu Layer Tree（蓝湖标注/结构提取）

一个 Chrome MV3 插件：在蓝湖页面上 **自动解析当前设计图的 JSON（FigmaJSON）**，提供：

- 线框图视图：用矩形线框渲染 layer，点击选择（支持同一区域重复点击“扩选”更大的框）
- 树视图：按层级浏览/搜索（name / id）
- 导出：导出选中节点及其所有 descendants（可勾选过滤空字段）
- 缓存：按 `project_id + image_id` 缓存数据，二次打开优先读缓存；支持刷新/清缓存

## 数据来源

插件会从当前蓝湖页面 URL 中解析 `project_id` 和 `image_id`，然后：

1. 请求 `https://lanhuapp.com/api/project/image?...` 获取 `json_url`
2. 请求 `https://alipic.lanhuapp.com/FigmaJSON*.json` 获取设计 JSON

> 注意：不要在 README / issue 里粘贴任何 Cookie、token 或 session 字符串（属于敏感凭证）。

当前仅支持你提供的 **新 JSON 结构**（FigmaJSON）：

```json
{
  "meta": {},
  "assets": [],
  "artboard": {
    "id": "...",
    "layers": [/* ... */]
  }
}
```

## 使用方式

1. 在浏览器登录蓝湖
2. 打开蓝湖设计图页面（例如 `https://lanhuapp.com/web/#/item/project/detailDetach?...&project_id=...&image_id=...`）
3. 点击插件图标
4. 右上角点击：
   - `加载`：优先使用缓存
   - `刷新`：忽略缓存，重新请求
   - `清缓存`：清除本地缓存
5. 在“线框图/树”里选中节点后，点击“导出 descendants”

## 开发

```bash
npm i
npm run dev
```

- dev server 端口：`5000`（见 `wxt.config.ts`）
- dev 不会自动启动 Chrome（见 `wxt.config.ts` 的 `webExt.disabled`）
- 手动在 Chrome 加载开发产物：`output/chrome-mv3-dev`

生产构建：

```bash
npm run build
```

产物目录：`output/chrome-mv3`

## 权限说明

- `host_permissions`：`lanhuapp.com`、`alipic.lanhuapp.com`
- `tabs`：读取当前 tab 的 URL
- `storage`：缓存 JSON

## 调试

查看 background 日志：

- `chrome://extensions` → 本扩展 → `Service worker` → `Inspect` → Console
- 日志前缀：`[lanhu]`

