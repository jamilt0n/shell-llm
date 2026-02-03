#!/usr/bin/env node
// cli.js - Shell LLM CLI
// Portable LLM interface via OpenRouter

import { getRouter } from './router.js';
import { MODELS } from './llm.js';

const HELP = `
Shell LLM - Portable LLM CLI via OpenRouter

Usage:
  shell-llm "message"           Send message (preprocessed + routed)
  sllm "message"                Short alias
  shell-llm @opus "message"     Send to specific model
  shell-llm @sonnet "message"   Send to Sonnet (default)
  shell-llm @haiku "message"    Send to Haiku (fast)
  shell-llm @gpt4 "message"     Send to GPT-4
  shell-llm //message           Bypass preprocessing (direct mode)

Options:
  -s, --stream                  Stream output in real-time
  -m, --model <model>           Use specific model
  --no-preprocess               Skip prompt preprocessing
  -h, --help                    Show this help

Models:
  opus   - Claude Opus (complex reasoning, architecture)
  sonnet - Claude Sonnet (general purpose, default)
  haiku  - Claude Haiku (quick tasks)
  gpt4   - GPT-4o (implementation, coding)

Environment:
  OPENROUTER_API_KEY            Required: Your OpenRouter API key
  SHELL_LLM_DEFAULT_MODEL       Optional: Default model (default: sonnet)
  SHELL_LLM_DIRECT              Set to 1 to skip preprocessing
  SHELL_LLM_NO_PREPROCESS       Set to 1 to disable preprocessing

Examples:
  shell-llm "help me fix this bug"           → Routes to gpt4 (keyword: fix)
  shell-llm "review the security of this"    → Routes to opus (keyword: security)
  shell-llm @haiku "format this as json"     → Direct to haiku
  shell-llm -s "explain recursion"           → Stream response
`;

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(HELP);
    process.exit(0);
  }

  // Check for API key
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('Error: OPENROUTER_API_KEY environment variable is required');
    console.error('Get your API key at https://openrouter.ai/keys');
    process.exit(1);
  }

  // Parse options
  let stream = false;
  let modelOverride = null;
  const messageArgs = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '-s' || arg === '--stream') {
      stream = true;
    } else if (arg === '-m' || arg === '--model') {
      modelOverride = args[++i];
    } else if (arg === '--no-preprocess') {
      process.env.SHELL_LLM_NO_PREPROCESS = '1';
    } else if (arg === 'models') {
      showModels();
      return;
    } else {
      messageArgs.push(arg);
    }
  }

  const message = messageArgs.join(' ');
  if (!message.trim()) {
    console.error('No message provided');
    process.exit(1);
  }

  // Apply model override via @mention if specified
  const finalMessage = modelOverride ? `@${modelOverride} ${message}` : message;

  try {
    if (stream) {
      await handleStream(finalMessage);
    } else {
      await handleMessage(finalMessage);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

async function handleMessage(message) {
  const router = getRouter({
    defaultModel: process.env.SHELL_LLM_DEFAULT_MODEL || 'sonnet',
  });

  console.log('Processing...\n');
  const result = await router.route(message);

  // Display preprocessing info
  if (result.corrections?.length > 0) {
    console.log('Corrections:');
    result.corrections.forEach(c => console.log(`  - ${c}`));
  }

  if (result.references_resolved?.length > 0) {
    console.log('Resolved:');
    result.references_resolved.forEach(r => console.log(`  - ${r}`));
  }

  if (result.enhanced !== result.original) {
    console.log(`\nOriginal: "${result.original}"`);
    console.log(`Enhanced: "${result.enhanced}"`);
  }

  console.log(`\n→ ${result.model} (${result.routing_reason})`);
  console.log(`  Model: ${result.modelId}`);
  console.log(`  Latency: ${result.latency_ms}ms`);

  if (result.usage) {
    console.log(`  Tokens: ${result.usage.total_tokens || 'N/A'}`);
  }

  console.log('');

  // Display response
  if (result.response) {
    console.log(result.response);
  }
}

async function handleStream(message) {
  const router = getRouter({
    defaultModel: process.env.SHELL_LLM_DEFAULT_MODEL || 'sonnet',
  });

  for await (const chunk of router.routeStream(message)) {
    process.stdout.write(chunk);
  }
  console.log('');
}

function showModels() {
  console.log('\nAvailable Models:\n');

  const router = getRouter();
  const info = router.getModelInfo();

  for (const [name, details] of Object.entries(info)) {
    console.log(`  ${name.padEnd(8)} - ${details.description}`);
    console.log(`           Model ID: ${details.modelId}`);
    console.log(`           Keywords: ${details.keywords.join(', ')}`);
    console.log('');
  }

  console.log('You can also use any OpenRouter model ID directly with -m flag.');
  console.log('Example: shell-llm -m "meta-llama/llama-3-70b-instruct" "your prompt"');
}

main();
