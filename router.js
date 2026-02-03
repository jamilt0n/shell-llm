// router.js - Smart routing and model selection
// Routes prompts to appropriate models based on content/keywords

import { preprocess, shouldBypass, extractTarget } from './preprocessor.js';
import { invoke, invokeStream, MODELS } from './llm.js';

// Model configurations with routing keywords
const MODEL_CONFIGS = {
  opus: {
    description: 'Complex Reasoning',
    keywords: ['security', 'architecture', 'review', 'analyze', 'design', 'complex', 'critical', 'audit', 'evaluate'],
  },
  sonnet: {
    description: 'General Purpose',
    keywords: ['help', 'explain', 'document', 'what', 'how', 'why', 'research', 'find', 'summarize'],
  },
  haiku: {
    description: 'Quick Tasks',
    keywords: ['quick', 'simple', 'list', 'format', 'convert', 'short'],
  },
  gpt4: {
    description: 'Implementation',
    keywords: ['implement', 'code', 'fix', 'debug', 'build', 'create', 'write', 'refactor', 'program'],
  },
};

const DEFAULT_MODEL = 'sonnet';

/**
 * Router handles preprocessing and model selection
 */
export class Router {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.defaultModel = options.defaultModel || DEFAULT_MODEL;
  }

  /**
   * Route a message - the main entry point
   *
   * @param {string} input - Raw user input
   * @param {object} options
   * @returns {Promise<object>} Result with response and metadata
   */
  async route(input, options = {}) {
    const startTime = Date.now();

    // Check for direct target (@opus, @gpt4, etc.)
    const { target, cleanInput } = extractTarget(input);

    // Check for bypass mode (// prefix)
    if (shouldBypass(cleanInput)) {
      const bypassInput = cleanInput.replace(/^(\/\/|\/direct\s+)/, '').trim();
      const modelName = target || this.defaultModel;
      return this.sendDirect(modelName, bypassInput, startTime);
    }

    // Preprocess the input (unless disabled)
    let preprocessResult = {
      enhanced: cleanInput,
      corrections: [],
      references_resolved: [],
      suggested_model: null,
    };

    if (process.env.SHELL_LLM_NO_PREPROCESS !== '1') {
      preprocessResult = await preprocess(cleanInput, {
        context: options.context,
      });
    }

    // Determine target model
    const suggestedModel = preprocessResult.suggested_model;
    const finalModel = target || suggestedModel || this.determineModel(cleanInput);

    // Send to model
    const result = await invoke(preprocessResult.enhanced, {
      model: finalModel,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      systemPrompt: options.systemPrompt,
    });

    return {
      sent: true,
      model: finalModel,
      modelId: result.model,
      original: input,
      enhanced: preprocessResult.enhanced,
      corrections: preprocessResult.corrections,
      references_resolved: preprocessResult.references_resolved,
      routing_reason: target ? 'explicit' : (suggestedModel ? 'ai_suggested' : 'keyword_match'),
      latency_ms: Date.now() - startTime,
      response: result.text,
      usage: result.usage,
    };
  }

  /**
   * Route with streaming output
   */
  async *routeStream(input, options = {}) {
    // Extract target and check bypass
    const { target, cleanInput } = extractTarget(input);
    const bypass = shouldBypass(cleanInput);
    const message = bypass ? cleanInput.replace(/^(\/\/|\/direct\s+)/, '').trim() : cleanInput;
    const modelName = target || this.defaultModel;

    // For streaming, skip preprocessing to reduce latency
    for await (const chunk of invokeStream(message, {
      model: modelName,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      systemPrompt: options.systemPrompt,
    })) {
      yield chunk;
    }
  }

  /**
   * Send directly without preprocessing
   */
  async sendDirect(modelName, message, startTime = Date.now()) {
    const result = await invoke(message, { model: modelName });

    return {
      sent: true,
      model: modelName,
      modelId: result.model,
      original: message,
      enhanced: message,
      corrections: [],
      references_resolved: [],
      routing_reason: 'direct',
      latency_ms: Date.now() - startTime,
      response: result.text,
      usage: result.usage,
    };
  }

  /**
   * Keyword-based model determination
   */
  determineModel(input) {
    const lower = input.toLowerCase();

    for (const [name, config] of Object.entries(MODEL_CONFIGS)) {
      for (const keyword of config.keywords) {
        if (lower.includes(keyword)) {
          return name;
        }
      }
    }

    return this.defaultModel;
  }

  /**
   * Get model info
   */
  getModelInfo() {
    const info = {};
    for (const [name, config] of Object.entries(MODEL_CONFIGS)) {
      info[name] = {
        description: config.description,
        modelId: MODELS[name],
        keywords: config.keywords,
      };
    }
    return info;
  }
}

// Default router instance
let defaultRouter = null;

export function getRouter(options = {}) {
  if (!defaultRouter) {
    defaultRouter = new Router(options);
  }
  return defaultRouter;
}
