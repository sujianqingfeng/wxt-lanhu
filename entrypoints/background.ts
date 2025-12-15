type LoadFromPageUrlMessage = {
  type: 'lanhu.loadFromPageUrl';
  pageUrl: string;
};

type LoadFromJsonUrlMessage = {
  type: 'lanhu.loadFromJsonUrl';
  jsonUrl: string;
};

type LanhuMessage = LoadFromPageUrlMessage | LoadFromJsonUrlMessage;

type LanhuOk<T> = { ok: true; data: T };
type LanhuErr = { ok: false; error: string };

type LanhuProjectImageResponse = {
  code?: string;
  msg?: string;
  result?: {
    latest_version?: string;
    versions?: Array<{
      id?: string;
      json_url?: string;
      updated?: boolean;
    }>;
  };
};

export default defineBackground(() => {
  // In Chrome MV3, relying on returning a Promise from onMessage can be flaky depending on the polyfill/runtime.
  // Use sendResponse + return true to guarantee the response is delivered.
  browser.runtime.onMessage.addListener((message: LanhuMessage, _sender, sendResponse) => {
    if (!message || typeof message !== 'object' || !('type' in message)) return;

    if (message.type === 'lanhu.loadFromJsonUrl') {
      void (async () => {
        const result = await handleLoadFromJsonUrl(message.jsonUrl);
        sendResponse(result);
      })();
      return true;
    }

    if (message.type === 'lanhu.loadFromPageUrl') {
      void (async () => {
        const result = await handleLoadFromPageUrl(message.pageUrl);
        sendResponse(result);
      })();
      return true;
    }
  });
});

async function handleLoadFromPageUrl(pageUrl: string): Promise<LanhuOk<unknown> | LanhuErr> {
  try {
    const cleanedUrl = pageUrl.replace(/\s+/g, '');
    log('loadFromPageUrl', cleanedUrl);
    const params = parseLanhuPageUrl(cleanedUrl);
    if (!params) {
      log('parse failed');
      return { ok: false, error: '无法从页面链接解析出 project_id / image_id' };
    }
    log('parsed params', params);

    const apiUrlWithTeam = new URL('https://lanhuapp.com/api/project/image');
    apiUrlWithTeam.searchParams.set('dds_status', '1');
    apiUrlWithTeam.searchParams.set('image_id', params.image_id);
    apiUrlWithTeam.searchParams.set('project_id', params.project_id);
    if (params.team_id) apiUrlWithTeam.searchParams.set('team_id', params.team_id);

    const apiUrlWithoutTeam = new URL('https://lanhuapp.com/api/project/image');
    apiUrlWithoutTeam.searchParams.set('dds_status', '1');
    apiUrlWithoutTeam.searchParams.set('image_id', params.image_id);
    apiUrlWithoutTeam.searchParams.set('project_id', params.project_id);

    const attempts: Array<{ label: string; url: string }> = [];
    // Prefer the user's team_id if present, but still fallback to no-team in case Lanhu changed params.
    attempts.push({
      label: params.team_id ? '带 team_id' : '无 team_id',
      url: apiUrlWithTeam.toString(),
    });
    if (params.team_id) {
      attempts.push({ label: '不带 team_id（fallback）', url: apiUrlWithoutTeam.toString() });
    }

    let lastError = '未知错误';
    for (const attempt of attempts) {
      log('project/image request', { label: attempt.label, url: attempt.url });
      const imageRes = await fetch(attempt.url, {
        method: 'GET',
        credentials: 'include',
        headers: { accept: 'application/json, text/plain, */*' },
      });
      if (!imageRes.ok) {
        log('project/image http not ok', { label: attempt.label, status: imageRes.status });
        lastError = `请求 project/image 失败（${attempt.label}）：HTTP ${imageRes.status}`;
        continue;
      }

      const imageJson = (await imageRes.json()) as LanhuProjectImageResponse;
      log('project/image response', {
        label: attempt.label,
        code: imageJson.code,
        msg: imageJson.msg,
        latest_version: imageJson.result?.latest_version,
        versions_len: imageJson.result?.versions?.length ?? 0,
      });
      if (imageJson.code && imageJson.code !== '00000') {
        lastError = `请求 project/image 失败（${attempt.label}）：${imageJson.code} ${imageJson.msg ?? ''}`.trim();
        continue;
      }

      const jsonUrl = pickJsonUrl(imageJson);
      if (!jsonUrl) {
        lastError = `响应里没找到 versions[].json_url（${attempt.label}，可能未登录/无权限/接口变更）`;
        continue;
      }

      log('picked json_url', jsonUrl);
      return await handleLoadFromJsonUrl(jsonUrl);
    }

    return { ok: false, error: lastError };
  } catch (error) {
    log('loadFromPageUrl error', error);
    return { ok: false, error: getErrorMessage(error) };
  }
}

async function handleLoadFromJsonUrl(jsonUrl: string): Promise<LanhuOk<unknown> | LanhuErr> {
  try {
    log('fetch SketchJSON', jsonUrl);
    const res = await fetch(jsonUrl, {
      method: 'GET',
      credentials: 'include',
      headers: { accept: 'application/json, text/plain, */*' },
    });
    if (!res.ok) {
      log('SketchJSON http not ok', res.status);
      return { ok: false, error: `请求 SketchJSON 失败：HTTP ${res.status}` };
    }
    const data = (await res.json()) as unknown;
    if (data && typeof data === 'object') {
      log('SketchJSON keys', Object.keys(data as Record<string, unknown>).slice(0, 20));
    }
    return { ok: true, data };
  } catch (error) {
    log('loadFromJsonUrl error', error);
    return { ok: false, error: getErrorMessage(error) };
  }
}

function parseLanhuPageUrl(
  pageUrl: string,
): { team_id: string | null; project_id: string; image_id: string } | null {
  let url: URL;
  try {
    url = new URL(pageUrl);
  } catch {
    return null;
  }

  // Lanhu uses hash routing: https://lanhuapp.com/web/#/path?tid=...&project_id=...&image_id=...
  const hash = url.hash ?? '';
  const queryIndex = hash.indexOf('?');
  const hashQuery = queryIndex >= 0 ? hash.slice(queryIndex + 1) : '';
  const sp = new URLSearchParams(hashQuery || url.searchParams.toString());

  const team_id = sp.get('team_id') || sp.get('tid') || sp.get('teamId') || null;
  const project_id = sp.get('project_id') || sp.get('pid') || sp.get('projectId') || '';
  const image_id = sp.get('image_id') || sp.get('imageId') || '';

  if (!project_id || !image_id) return null;
  return { team_id, project_id, image_id };
}

function pickJsonUrl(response: LanhuProjectImageResponse): string | null {
  const versions = response.result?.versions ?? [];
  const latestId = response.result?.latest_version;
  const byLatest = latestId ? versions.find((v) => v.id === latestId) : undefined;
  const byUpdated = versions.find((v) => v.updated);
  const picked = byLatest ?? byUpdated ?? versions[0];
  return picked?.json_url ?? null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function log(message: string, extra?: unknown) {
  // MV3 service worker log: chrome://extensions -> 本扩展 -> Service worker -> Inspect
  if (extra === undefined) console.log(`[lanhu] ${message}`);
  else console.log(`[lanhu] ${message}`, extra);
}
