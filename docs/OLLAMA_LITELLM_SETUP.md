# Ollama & LiteLLM Setup Guide

## Overview

This guide explains how to configure **local** and **remote** Ollama instances with all VS Code AI extensions used in the Kurukoo project:
- **Opilot** (selfagency.opilot) - Ollama models in GitHub Copilot Chat
- **LiteLLM Chat** (vivswan.litellm-vscode-chat) - LiteLLM proxy integration
- **Llama for VS Code IDE** (ggml-org.llama-vscode) - Local LLM inference

## Architecture

```
VS Code Extensions
├── Opilot (selfagency.opilot)
│   → Direct to Ollama: http://localhost:11434
│   → Uses ollama.ollama extension's backend
├── litellm-vscode-chat (vivswan.litellm-vscode-chat)
│   → LiteLLM Proxy: http://localhost:4000
│   → Proxy → Ollama (local and/or remote)
├── Llama for VS Code IDE (ggml-org.llama-vscode)
│   → Direct to Ollama: http://localhost:11434/v1
│   → Uses completion_models_list + envs_list

LiteLLM Proxy (Node.js)
├── Local Ollama   → http://localhost:11434
└── Remote Ollama  → $OLLAMA_REMOTE_HOST
```

## Local Setup

### 1. Install Ollama
```bash
brew install ollama
brew services start ollama
```

### 2. Pull SmolLM2 model
```bash
npm run ollama:pull-smollm2
```

### 3. Start the LiteLLM proxy
```bash
npm run litellm:start
```

### 4. VS Code extensions
- **Opilot**: `@ollama` chat participant connects directly to `http://localhost:11434`
- **LiteLLM Chat**: Connects to `http://localhost:4000` (the proxy)

### 5. Verify
```bash
npm run ollama:test      # Check Ollama is running
npm run litellm:test        # Check proxy is running
```

## Remote Setup

### Option A: Remote Ollama only (no proxy)

Set the `OLLAMA_REMOTE_HOST` environment variable and restart VS Code:

```bash
# Add to ~/.zshrc or ~/.bashrc
export OLLAMA_REMOTE_HOST="http://your.remote.host:11434"
export OLLAMA_HOST="0.0.0.0:11434"  # On the remote machine, allow external connections
export OLLAMA_API_KEY="your-api-key"  # If remote requires auth
```

Then update VS Code settings:
```json
{
  "selfagency.opilot.opilot.host": "http://your.remote.host:11434"
}
```

### Option B: LiteLLM proxy with remote routing

Start the proxy with the remote host configured:

```bash
OLLAMA_REMOTE_HOST="http://your.remote.host:11434" node scripts/litellm-ollama-proxy.mjs
```

The proxy will then expose both local and remote models on port 4000.

### Option C: Start everything together

```bash
OLLAMA_REMOTE_HOST="http://your.remote.host:11434" npm run litellm:start-all
```

This starts both Ollama (if not running) and the proxy.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OLLAMA_LOCAL_HOST` | Local Ollama URL | `http://localhost:11434` |
| `OLLAMA_REMOTE_HOST` | Remote Ollama URL | `http://localhost:11434` |
| `LITELLM_PROXY_PORT` | Proxy listen port | `4000` |
| `OLLAMA_API_KEY` | Ollama auth token (if required) | empty |
| `OPILOT_HOST` | Opilot's Ollama host URL | `http://localhost:11434` |

## Available Models

| Model | Size | Notes |
|-------|------|-------|
| `smollm2:360m` | 360M params | Kurukoo's student model |
| `gemma3:4b` | 4.3B params | General purpose |
| `qwen3-vl:2b-instruct-q8_0` | 2.1B params | Vision-language |
| `gemma4:e2b` | 5.1B params | Latest Gemma |

## Troubleshooting

### "No endpoint for the completion (fim) model"
**Fix:** Configure the Llama for VS Code IDE extension:
1. Set `llama-vscode.endpoint` to `http://localhost:11434/v1`
2. Set `llama-vscode.endpoint_chat` to `http://localhost:11434/v1`
3. Add a completion model: `llama-vscode.completion_models_list` with `smollm2:360m`
4. Add an environment: `llama-vscode.envs_list` with endpoint + model config
5. Restart VS Code after changing settings

### "Cannot connect to Ollama server"
1. Check if Ollama is running: `curl http://localhost:11434/api/tags`
2. Start Ollama: `brew services start ollama`
3. Check Opilot settings: `selfagency.opilot.opilot.host`

### "Cannot connect to LiteLLM server"
1. Check if proxy is running: `curl http://localhost:4000/health`
2. Start proxy: `npm run litellm:start`
3. Check VS Code settings: `litellm-vscode-chat.servers`

### Remote Ollama not connecting
1. Verify `OLLAMA_REMOTE_HOST` is set correctly
2. Check network connectivity to the remote host
3. Verify the remote Ollama has the models pulled
4. For remote auth: set `OLLAMA_API_KEY` environment variable
