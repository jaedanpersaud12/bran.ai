import "server-only";

import { createDeepSeek, type DeepSeekLanguageModelChatOptions } from "@ai-sdk/deepseek";

/**
 * The model bran talks to — the only file that knows which provider that is.
 *
 * DeepSeek, chosen for every AI feature (context/build-plan.md). Everything
 * else asks this module for `model()` and `callOptions`, so moving to another
 * provider, or to AI Gateway, is a change here and nowhere else.
 *
 * `deepseek-v4-flash` with thinking off: bran's uses so far are short,
 * grounded sentences from numbers it already has, where reasoning tokens are
 * cost and latency for nothing. `AI_MODEL` overrides the id without a deploy
 * of new code (e.g. `deepseek-v4-pro` for a harder task later).
 */

const DEFAULT_MODEL = "deepseek-v4-flash";

const apiKey = process.env.DEEPSEEK_API_KEY;

/** Whether AI features should run at all. Without a key, every caller falls back. */
export const aiConfigured = Boolean(apiKey);

export const modelId = process.env.AI_MODEL || DEFAULT_MODEL;

// `DEEPSEEK_BASE_URL` is for a proxy, or a local stand-in when testing the
// wiring without spending tokens; unset, the provider uses DeepSeek's own API.
const deepSeek = createDeepSeek({
  apiKey: apiKey ?? "",
  baseURL: process.env.DEEPSEEK_BASE_URL || undefined,
});

export function model() {
  return deepSeek(modelId);
}

/**
 * The model for images. `deepseek-v4-flash` is text-only; DeepSeek serves
 * images through an experimental vision variant (provider docs). Only 07's
 * photo import uses it.
 */
export const visionModelId = process.env.AI_VISION_MODEL || "deepseek-v4-flash-vision-exp";

export function visionModel() {
  return deepSeek(visionModelId);
}

/** Provider options every call passes along. */
export const callOptions = {
  providerOptions: {
    deepseek: { thinking: { type: "disabled" } } satisfies DeepSeekLanguageModelChatOptions,
  },
};
