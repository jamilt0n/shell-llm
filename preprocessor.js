// preprocessor.js - Prompt preprocessing with Haiku
// Fixes typos, enhances clarity, suggests routing

import { invoke } from './llm.js';

const PREPROCESS_MODEL = 'anthropic/claude-3.5-haiku';

/**
 * Preprocess a user prompt for clarity and routing
 *
 * @param {string} userInput - Raw user input
 * @param {object} options
 * @param {string} options.context - Optional context from previous interaction
 * @returns {Promise<{enhanced: string, corrections: string[], suggested_model: string|null}>}
 */
export async function preprocess(userInput, options = {}) {
  const prompt = buildPreprocessPrompt(userInput, options.context);

  try {
    const result = await invoke(prompt, {
      model: PREPROCESS_MODEL,
      maxTokens: 1024,
      temperature: 0.3,
    });

    return parsePreprocessResult(result.text, userInput);
  } catch (error) {
    // Graceful degradation: return original if preprocessing fails
    return {
      enhanced: userInput,
      corrections: [],
      references_resolved: [],
      suggested_model: null,
      error: error.message,
    };
  }
}

function buildPreprocessPrompt(userInput, context) {
  const contextSection = context
    ? `<context>\n${context}\n</context>\n\n`
    : '';

  return `You are a prompt preprocessor for an LLM CLI tool. Your job is to:
1. Fix spelling and grammar errors in the user's input
2. Resolve vague references if context is provided ("yes", "that", "do it")
3. Keep the user's intent and tone intact
4. Be concise - don't over-elaborate

${contextSection}<user_input>
${userInput}
</user_input>

Respond in this exact JSON format:
{
  "enhanced": "The corrected and clarified prompt to send",
  "corrections": ["list of corrections made, if any"],
  "references_resolved": ["list of references resolved using context, if any"],
  "suggested_model": "opus|sonnet|haiku|gpt4|null based on task type"
}

If the input is already clear and correct, return it unchanged with empty corrections array.
For suggested_model:
- "opus" for complex reasoning, security, architecture, deep analysis
- "sonnet" for general purpose, research, documentation (default)
- "haiku" for quick tasks, formatting, simple questions
- "gpt4" for implementation, coding, debugging
- null if unclear or should use default`;
}

function parsePreprocessResult(result, originalInput) {
  try {
    // Extract JSON from response (may have markdown code blocks)
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        enhanced: originalInput,
        corrections: [],
        references_resolved: [],
        suggested_model: null,
        raw: result,
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      enhanced: parsed.enhanced || originalInput,
      corrections: parsed.corrections || [],
      references_resolved: parsed.references_resolved || [],
      suggested_model: parsed.suggested_model || null,
      raw: result,
    };
  } catch (e) {
    // If parsing fails, return original input
    return {
      enhanced: originalInput,
      corrections: [],
      references_resolved: [],
      suggested_model: null,
      error: e.message,
      raw: result,
    };
  }
}

/**
 * Check if input should bypass preprocessing
 */
export function shouldBypass(input) {
  // Direct mode indicators
  if (input.startsWith('//')) return true;
  if (input.startsWith('/direct ')) return true;
  if (process.env.SHELL_LLM_DIRECT === '1') return true;
  return false;
}

/**
 * Extract model target from input if specified
 * @returns {{target: string|null, cleanInput: string}}
 */
export function extractTarget(input) {
  // @mention style: @opus, @sonnet, @haiku, @gpt4
  const mentionMatch = input.match(/^@(opus|sonnet|haiku|gpt4?|codex)\s*/i);
  if (mentionMatch) {
    return {
      target: mentionMatch[1].toLowerCase(),
      cleanInput: input.slice(mentionMatch[0].length),
    };
  }

  // -m flag style: -m opus
  const flagMatch = input.match(/^-m\s+(opus|sonnet|haiku|gpt4?|codex)\s+/i);
  if (flagMatch) {
    return {
      target: flagMatch[1].toLowerCase(),
      cleanInput: input.slice(flagMatch[0].length),
    };
  }

  return { target: null, cleanInput: input };
}
