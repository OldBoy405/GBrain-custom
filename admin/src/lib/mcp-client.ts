/**
 * Tier3 数据通道（见 admin/docs/FRONTEND_PLAN.zh.md §4.3）：
 * 用 admin 面板签发的 API key 作为 Bearer，直接调 `POST /mcp` 的 JSON-RPC，
 * 访问 operations.ts 全量操作 —— 不改任何上游 src/ 文件。
 *
 * 令牌只存内存（遵循 api.ts 的 D11/D12 信任模型：不落 localStorage/sessionStorage）。
 */

let mcpToken: string | null = null;

/** 由"API Keys"页生成 gbrain_ 令牌后调用；仅内存保存。 */
export function setMcpToken(token: string | null): void {
  mcpToken = token;
}

export function hasMcpToken(): boolean {
  return mcpToken != null && mcpToken.length > 0;
}

export interface McpRequestBody {
  jsonrpc: '2.0';
  id: number;
  method: 'tools/call';
  params: { name: string; arguments: Record<string, unknown> };
}

/** 纯函数：构造 tools/call 的 JSON-RPC 请求体（便于单测）。 */
export function buildMcpRequest(name: string, args: Record<string, unknown>, id: number): McpRequestBody {
  return { jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } };
}

let rpcId = 0;

export class McpError extends Error {}

/**
 * 调用一个 gbrain 操作并返回其 JSON 结果。
 * MCP streamable-HTTP 可能以 application/json 或 text/event-stream 应答，两者都解析。
 */
export async function callMcp<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  // 通道自动选择：有内存令牌走 Bearer /mcp；否则走 cookie 鉴权的 /admin/api/op 代理
  // （已登录 admin 免令牌）。两端响应同为 { result: ToolResult } 信封，下方解析共用。
  let res: Response;
  if (hasMcpToken()) {
    const body = buildMcpRequest(name, args, ++rpcId);
    res = await fetch('/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${mcpToken}`,
      },
      body: JSON.stringify(body),
    });
    if (res.status === 401) {
      // Bearer 令牌与 cookie 会话是两条独立信任链——令牌失效/被吊销时清掉内存令牌，
      // 让下一次调用回落到 cookie 鉴权的 /admin/api/op 代理，而不是跳 #login
      // （那是 cookie 会话过期的处理，这里是 API key 过期，语义不同）。
      setMcpToken(null);
      throw new McpError('MCP 令牌已失效，请重新连接（API Keys 页）。');
    }
  } else {
    res = await fetch('/admin/api/op', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, arguments: args }),
    });
    if (res.status === 401) {
      // 与 api.ts apiFetch 一致：401 统一跳登录（D11/D12 信任模型）。
      window.location.hash = '#login';
      throw new McpError('未登录：请先登录管理后台。');
    }
  }
  if (!res.ok) throw new McpError(`MCP HTTP ${res.status}`);

  const raw = await res.text();
  const payload = parseMcpPayload(raw);
  if (payload?.error) throw new McpError(payload.error.message || 'MCP error');

  // 工具级错误：MCP 把操作失败放在 result.isError + content 里（HTTP 仍是 200）。
  // 提取其中的 message/error 文本抛出，让各页通过 error 态呈现（而非静默空态）。
  if (payload?.result?.isError) {
    const errContent = payload.result.content;
    let msg = 'MCP tool error';
    if (Array.isArray(errContent)) {
      const t = errContent.find((c) => c?.type === 'text')?.text;
      if (t) {
        try {
          const j = JSON.parse(t) as { message?: string; error?: string };
          msg = j.message || j.error || t;
        } catch {
          msg = t;
        }
      }
    }
    throw new McpError(msg);
  }

  const content = payload?.result?.content;
  if (Array.isArray(content)) {
    const textPart = content.find((c) => c?.type === 'text');
    if (textPart?.text) {
      try {
        return JSON.parse(textPart.text) as T;
      } catch {
        return textPart.text as unknown as T;
      }
    }
  }
  return payload?.result as T;
}

interface McpEnvelope {
  error?: { message?: string };
  result?: { content?: Array<{ type?: string; text?: string }>; isError?: boolean };
}

/** 从 JSON 或 SSE(data: {...}) 文本中取出最后一个 JSON-RPC 信封。 */
export function parseMcpPayload(raw: string): McpEnvelope | null {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed) as McpEnvelope;
    } catch {
      return null;
    }
  }
  // SSE 帧：取最后一条 data: 行
  const dataLines = trimmed
    .split(/\r?\n/)
    .filter((l) => l.startsWith('data:'))
    .map((l) => l.slice(5).trim());
  for (let i = dataLines.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(dataLines[i]) as McpEnvelope;
    } catch {
      /* try previous */
    }
  }
  return null;
}
