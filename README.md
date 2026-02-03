# shell-llm

Portable LLM CLI with smart routing and preprocessing via OpenRouter.

## Features

- **Model agnostic** - Uses OpenRouter to access Claude, GPT-4, Llama, and any other supported model
- **Smart routing** - Automatically routes prompts to appropriate models based on keywords
- **Preprocessing** - Uses Haiku to fix typos, enhance clarity, and resolve vague references
- **Streaming** - Real-time streaming output support
- **Portable** - Works on macOS, Linux, and anywhere Node.js runs

## Installation

```bash
# Clone the repo
git clone https://github.com/yourusername/shell-llm.git
cd shell-llm

# Install globally
npm link

# Or run directly
node cli.js "your prompt"
```

## Setup

1. Get an API key from [OpenRouter](https://openrouter.ai/keys)
2. Copy the env template:
   ```bash
   cp env.local.template .env.local
   ```
3. Add your API key to `.env.local`
4. Source it in your shell or add to your profile:
   ```bash
   export OPENROUTER_API_KEY="sk-or-v1-..."
   ```

## Usage

```bash
# Basic usage
shell-llm "explain how async/await works in JavaScript"

# Short alias
sllm "explain recursion"

# Target a specific model
shell-llm @opus "review the security implications of this approach"
shell-llm @haiku "format this as a bullet list"
shell-llm @gpt4 "write a function to parse CSV files"

# Bypass preprocessing (direct mode)
shell-llm //just send this exactly as-is

# Stream output
shell-llm -s "write a short story about a robot"

# Use any OpenRouter model
shell-llm -m "meta-llama/llama-3-70b-instruct" "your prompt"

# Show available models
shell-llm models
```

## Smart Routing

The router automatically selects models based on keywords:

| Model  | Keywords | Best For |
|--------|----------|----------|
| opus   | security, architecture, review, analyze | Complex reasoning, deep analysis |
| sonnet | help, explain, research, summarize | General purpose (default) |
| haiku  | quick, simple, list, format | Fast, simple tasks |
| gpt4   | implement, code, fix, debug, build | Implementation, coding |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | Yes | Your OpenRouter API key |
| `SHELL_LLM_DEFAULT_MODEL` | No | Default model (default: sonnet) |
| `SHELL_LLM_NO_PREPROCESS` | No | Set to 1 to disable preprocessing |
| `SHELL_LLM_DIRECT` | No | Set to 1 for always-direct mode |
| `DEBUG` | No | Set to 1 for debug output |

## Files

```
shell-llm/
├── cli.js           # CLI entry point
├── router.js        # Smart routing logic
├── preprocessor.js  # Prompt preprocessing with Haiku
├── llm.js           # OpenRouter API wrapper
├── package.json
├── env.local.template
└── README.md
```

## License

MIT
