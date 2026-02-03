// llm.js - OpenRouter API wrapper
// Provides model-agnostic LLM invocation via OpenRouter

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Default models - can use any OpenRouter-supported model
export const MODELS = {
  opus: 'anthropic/claude-opus-4',
  sonnet: 'anthropic/claude-sonnet-4',
  haiku: 'anthropic/claude-3.5-haiku',
  gpt4: 'openai/gpt-4o',
  codex: 'openai/gpt-4o',  // Alias for coding tasks
};

// Model aliases for convenience
const MODEL_ALIASES = {
  'claude': 'anthropic/claude-sonnet-4',
  'claude-opus': 'anthropic/claude-opus-4',
  'claude-sonnet': 'anthropic/claude-sonnet-4',
  'claude-haiku': 'anthropic/claude-3.5-haiku',
  'gpt': 'openai/gpt-4o',
  'gpt-4': 'openai/gpt-4o',
  'gpt-4o': 'openai/gpt-4o',
};

/**
 * Resolve model name to OpenRouter model ID
 */
export function resolveModel(model) {
  if (!model) return MODELS.sonnet;

  // Check named models first
  if (MODELS[model]) return MODELS[model];

  // Check aliases
  if (MODEL_ALIASES[model]) return MODEL_ALIASES[model];

  // Assume it's already a full model ID
  return model;
}

/**
 * Invoke an LLM via OpenRouter
 *
 * @param {string} prompt - The prompt to send
 * @param {object} options - Configuration options
 * @param {string} options.model - Model name or full OpenRouter model ID
 * @param {number} options.maxTokens - Max tokens to generate (default: 4096)
 * @param {number} options.temperature - Temperature (default: 0.7)
 * @param {string} options.systemPrompt - Optional system prompt
 * @returns {Promise<{text: string, model: string, usage: object}>}
 */
export async function invoke(prompt, options = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is required');
  }

  const model = resolveModel(options.model);
  const messages = [];

  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.OPENROUTER_REFERER || 'https://github.com/shell-llm',
      'X-Title': 'shell-llm',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';

  return {
    text,
    model,
    usage: data.usage || null,
  };
}

/**
 * Stream an LLM response via OpenRouter
 * Returns an async generator that yields text chunks
 */
export async function* invokeStream(prompt, options = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is required');
  }

  const model = resolveModel(options.model);
  const messages = [];

  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.OPENROUTER_REFERER || 'https://github.com/shell-llm',
      'X-Title': 'shell-llm',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
      stream: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} ${error}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (!trimmed.startsWith('data: ')) continue;

      try {
        const data = JSON.parse(trimmed.slice(6));
        const content = data.choices?.[0]?.delta?.content;
        if (content) {
          yield content;
        }
      } catch {
        // Ignore parse errors in stream
      }
    }
  }
}

/**
 * Get available models (subset of commonly used)
 */
export function getAvailableModels() {
  return { ...MODELS };
}
