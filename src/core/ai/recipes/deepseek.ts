import type { Recipe } from '../types.ts';

/** V4-native ids plus legacy aliases (retire 2026-07-24 per DeepSeek API docs). */
const CHAT_MODELS = [
  'deepseek-v4-pro',
  'deepseek-v4-flash',
  'deepseek-chat',
  'deepseek-reasoner',
] as const;

/**
 * DeepSeek exposes an OpenAI-compatible /chat/completions endpoint.
 * Useful as the second hop in a refusal-fallback chain, cheap expansion
 * (v4-flash), and research delegation.
 *
 * API key: `DEEPSEEK_API_KEY` env or `deepseek_api_key` in ~/.gbrain/config.json
 * (file plane → buildGatewayConfig). Base URL override: `provider_base_urls.deepseek`
 * or `DEEPSEEK_BASE_URL` env.
 */
export const deepseek: Recipe = {
  id: 'deepseek',
  name: 'DeepSeek',
  tier: 'openai-compat',
  implementation: 'openai-compatible',
  base_url_default: 'https://api.deepseek.com/v1',
  auth_env: {
    required: ['DEEPSEEK_API_KEY'],
    setup_url: 'https://platform.deepseek.com/api_keys',
  },
  touchpoints: {
    expansion: {
      models: [...CHAT_MODELS],
      // v4-flash output-side baseline for spend hints (ExpansionTouchpoint uses single rate).
      cost_per_1m_tokens_usd: 0.28,
      price_last_verified: '2026-07-04',
    },
    chat: {
      models: [...CHAT_MODELS],
      supports_tools: true,
      supports_subagent_loop: true,
      supports_prompt_cache: false,
      max_context_tokens: 1_000_000,
      // v4-pro cache-miss baseline; openai-compat tier accepts any hosted id.
      cost_per_1m_input_usd: 0.435,
      cost_per_1m_output_usd: 0.87,
      price_last_verified: '2026-07-04',
    },
  },
  setup_hint:
    'Get an API key at https://platform.deepseek.com/api_keys, then set `deepseek_api_key` in ~/.gbrain/config.json or `export DEEPSEEK_API_KEY=...`.',
};
