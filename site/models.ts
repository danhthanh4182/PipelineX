// Models configured for this site. The framework includes a `default` model defined by
// environment variables LLM_BASE_URL / LLM_API_KEY / LLM_MODEL.
// Named model presets and step defaults can be declared here. Steps omitted default to `default`.
// Steps can be overridden via environment variables (PREFILTER_MODEL, SCORE_MODEL...) or via the Admin Dashboard.

import type { ModelPreset } from "@aihot/contracts/site-config";
export type { ModelPreset } from "@aihot/contracts/site-config";

/** Example named model presets (each configured with its own env vars). */
export const PRESETS: Record<string, ModelPreset> = {
  // GLM 5.3 Flash always reasons; low effort keeps short structured tasks fast.
  "glm-5.3-flash": {
    service: "zhipu", model: "glm-5.3-flash", baseUrlEnv: "ZHIPU_BASE_URL", apiKeyEnv: "ZHIPU_API_KEY",
    extra: { thinking: { type: "enabled" }, reasoning_effort: "low" }, jsonMode: true, vision: true,
  },
  // The scorer's parameters for glm-5.3-flash: temperature 1 with high reasoning, up to 180 s per call.
  "glm-5.3-flash-selection": {
    service: "zhipu", model: "glm-5.3-flash", baseUrlEnv: "ZHIPU_BASE_URL", apiKeyEnv: "ZHIPU_API_KEY",
    extra: { thinking: { type: "enabled", clear_thinking: false }, reasoning_effort: "high", top_p: 0.95 }, jsonMode: true, vision: true,
    scoreCall: { temperature: 1, maxTokens: 65_536, timeoutMs: 180_000 },
  },
  // DeepSeek Flash reasons by default; structured tasks switch it off.
  "deepseek-flash": {
    service: "deepseek", model: "deepseek-flash", baseUrlEnv: "DEEPSEEK_BASE_URL", apiKeyEnv: "DEEPSEEK_API_KEY",
    extra: { thinking: { type: "disabled" } }, jsonMode: true,
  },
  "deepseek-flash-think": {
    service: "deepseek", model: "deepseek-flash", baseUrlEnv: "DEEPSEEK_BASE_URL", apiKeyEnv: "DEEPSEEK_API_KEY", reasoningTokens: 4000, jsonMode: true,
  },
  "qwen3.7-flash": {
    service: "dashscope", model: "qwen3.7-flash", baseUrlEnv: "DASHSCOPE_BASE_URL", apiKeyEnv: "DASHSCOPE_API_KEY",
    extra: { enable_thinking: false }, jsonMode: true,
  },
  "qwen3.8-flash": {
    service: "dashscope", model: "qwen3.8-flash", baseUrlEnv: "DASHSCOPE_BASE_URL", apiKeyEnv: "DASHSCOPE_API_KEY",
    extra: { enable_thinking: false }, jsonMode: true,
  },
  "mimo-v2.6-flash": {
    service: "mimo", model: "mimo-v2.6-flash", baseUrlEnv: "XIAOMI_MIMO_BASE_URL", apiKeyEnv: "XIAOMI_MIMO_API_KEY",
    extra: { thinking: { type: "disabled" } }, jsonMode: true,
  },
  // PipelineX: free providers first, paid last (see pipelinex-chain).
  // NVIDIA's API: free developer tier, about 40 requests a minute, and a tighter limit per model: MiniMax answers 429 well
  // below 40 when the video steps use it too. It is its own service so its 429s neither trip the circuit for the
  // Nemotron fallback nor share its MODEL_RPM ceiling.
  "nvidia-vl": {
    service: "nvidia", model: "nvidia/nemotron-3.5-super-vl-120b-a12b", baseUrlEnv: "NVIDIA_BASE_URL", apiKeyEnv: "NVIDIA_API_KEY",
    reasoningTokens: 8000, jsonMode: true, vision: true,
  },
  "nvidia-minimax": {
    service: "nvidia-minimax", model: "minimaxai/minimax-m3.1-flash", baseUrlEnv: "NVIDIA_BASE_URL", apiKeyEnv: "NVIDIA_API_KEY",
    jsonMode: true, vision: false,
  },
  "nvidia-nemotron": {
    service: "nvidia", model: "nvidia/nemotron-3.5-lightning-30b-a3b", baseUrlEnv: "NVIDIA_BASE_URL", apiKeyEnv: "NVIDIA_API_KEY",
    reasoningTokens: 8000, jsonMode: true, vision: false,
  },
  "nvidia-nemotron-vl": {
    service: "nvidia", model: "nvidia/nemotron-3.5-super-vl-120b-a12b", baseUrlEnv: "NVIDIA_BASE_URL", apiKeyEnv: "NVIDIA_API_KEY",
    reasoningTokens: 8000, jsonMode: true, vision: true,
  },
  // OpenRouter's free variant: $0, 20 requests a minute and 1,000 a day (50 before $10 of credit was ever bought).
  "openrouter-free-nemotron": {
    service: "openrouter-free", model: "nvidia/nemotron-3.5-super-vl:free", baseUrlEnv: "OPENROUTER_BASE_URL", apiKeyEnv: "OPENROUTER_API_KEY",
    reasoningTokens: 8000, jsonMode: true, vision: true,
  },
  // OrcaRouter's free DeepSeek Flash (text only): 10 requests a minute and 50 a day before $20 was ever paid, then
  // 20 and 800; a small prompt cap on the lowest tier. A different model from Nemotron, so it comes after both free Nemotrons.
  "orcarouter-free-deepseek": {
    service: "orcarouter-free", model: "deepseek/deepseek-v4.1-flash-free", baseUrlEnv: "ORCAROUTER_BASE_URL", apiKeyEnv: "ORCAROUTER_API_KEY",
    jsonMode: true, vision: false,
  },
  // OpenRouter paid: defined for an explicit choice (admin model page or a step variable); not in pipelinex-chain.
  "openrouter-nemotron": {
    service: "openrouter", model: "nvidia/nemotron-3.5-super-vl", baseUrlEnv: "OPENROUTER_BASE_URL", apiKeyEnv: "OPENROUTER_API_KEY",
    reasoningTokens: 8000, jsonMode: true, vision: true,
  },
  "pipelinex-chain": {
    service: "chain", model: "pipelinex-chain", baseUrlEnv: "LLM_BASE_URL", apiKeyEnv: "LLM_API_KEY", jsonMode: true, vision: true,
    // Primary: NVIDIA Nemotron 120b Super-VL (nvidia-vl) and MiniMax Flash (nvidia-minimax) with verified 4s, 8s, 12s backoff, then free fallbacks.
    chain: ["nvidia-vl", "nvidia-minimax", "nvidia-nemotron", "openrouter-free-nemotron", "orcarouter-free-deepseek", "default"],
  },
  "qwen3-vl-flash": {
    service: "dashscope", model: "qwen3-vl-flash", baseUrlEnv: "DASHSCOPE_BASE_URL", apiKeyEnv: "DASHSCOPE_API_KEY",
    extra: { enable_thinking: false }, jsonMode: false, vision: true,
  },
};

/**
 * Default model per pipeline step (names match PRESETS keys or "default").
 * Example: { score: "glm-5.3-flash-selection", groupReview: "mimo-v2.6-flash" }
 */
// PipelineX: the code defaults stay the engine's ("default" = LLM_*), so the engine's tests run as upstream; the
// deployment routes every step to pipelinex-chain in .env (PREFILTER_MODEL=pipelinex-chain, …, see .env.example).
export const DEFAULTS: Record<string, string> = {};
