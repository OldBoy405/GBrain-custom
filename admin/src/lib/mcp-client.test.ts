import { describe, it, expect } from 'vitest';
import { buildMcpRequest, parseMcpPayload, setMcpToken, hasMcpToken } from './mcp-client';

describe('buildMcpRequest', () => {
  it('构造合法的 tools/call JSON-RPC 请求体', () => {
    const b = buildMcpRequest('query', { query: 'hi', limit: 5 }, 7);
    expect(b).toEqual({
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: { name: 'query', arguments: { query: 'hi', limit: 5 } },
    });
  });
});

describe('parseMcpPayload', () => {
  it('解析纯 JSON 信封', () => {
    const env = parseMcpPayload('{"result":{"content":[{"type":"text","text":"ok"}]}}');
    expect(env?.result?.content?.[0]?.text).toBe('ok');
  });
  it('解析 SSE data: 帧并取最后一条', () => {
    const raw = 'event: message\ndata: {"result":{"content":[{"type":"text","text":"a"}]}}\n\ndata: {"error":{"message":"boom"}}\n\n';
    const env = parseMcpPayload(raw);
    expect(env?.error?.message).toBe('boom');
  });
  it('畸形输入返回 null', () => {
    expect(parseMcpPayload('not json')).toBeNull();
  });
});

describe('token 内存存储', () => {
  it('setMcpToken/hasMcpToken 往返', () => {
    setMcpToken(null);
    expect(hasMcpToken()).toBe(false);
    setMcpToken('gbrain_abc');
    expect(hasMcpToken()).toBe(true);
    setMcpToken(null);
  });
});
