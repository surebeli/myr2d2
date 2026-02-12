# My Local Model Service

This module provides a local LLM inference service using `llama-cpp-python`. It supports hardware acceleration on Mac (Metal) and Windows (CUDA).

## Prerequisites

- Python 3.8+
- **Mac**: M1/M2/M3 chip (Apple Silicon)
- **Windows**: NVIDIA GPU (RTX 30xx or higher recommended) with CUDA installed.

## Installation

We provide an installation script that automatically detects your platform and installs the correct version of `llama-cpp-python` with hardware acceleration support.

1. Navigate to this directory:
   ```bash
   cd thirdparty/my-local-model
   ```

2. Run the installation script:
   ```bash
   python install.py
   ```

   **Note for Windows Users:**
   Ensure you have installed the CUDA Toolkit appropriate for your GPU driver. You may need Visual Studio Build Tools with C++ support installed as well.

## Usage

### 1. Download a Model

You can use the provided script to download a model (default is Qwen2.5-1.5B-Instruct-GGUF, small and fast):

```bash
python download_model.py
```

This will save the model in the `models/` directory.

### 2. Run the Server

Start the OpenAI-compatible API server:

```bash
python server.py --model models/qwen2.5-1.5b-instruct-q4_k_m.gguf
```

Options:
- `--host`: Host to bind to (default: 0.0.0.0)
- `--port`: Port to bind to (default: 8000)
- `--n_gpu_layers`: Layers to offload to GPU (default: -1, meaning all layers)
- `--n_ctx`: Context window size (default: 2048)

### 3. API Usage

Once the server is running, you can access the API documentation at:
http://localhost:8000/docs

Example using `curl`:

```bash
curl http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

Example using Python `openai` client:

```python
from openai import OpenAI

client = OpenAI(base_url="http://localhost:8000/v1", api_key="sk-xxx")

response = client.chat.completions.create(
    model="local-model",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hello!"}
    ]
)

print(response.choices[0].message.content)
```

## Cross-Platform Notes

- **Mac M1 Ultra**: The installation script uses `-DLLAMA_METAL=on`. The `n_gpu_layers` default of `-1` will utilize the unified memory effectively.
- **Windows RTX 30xx**: The installation script uses `-DLLAMA_CUDA=on`. Ensure CUDA environment variables are set if you encounter build issues.
