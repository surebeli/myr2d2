import argparse
import uvicorn
import os
import sys

try:
    from llama_cpp.server.app import create_app
    from llama_cpp.server.settings import Settings
except ImportError:
    print("Error: llama-cpp-python is not installed.")
    print("Please run 'python install.py' first.")
    sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Run Local LLM Server")
    parser.add_argument("--model", type=str, required=True, help="Path to the GGUF model file")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Host to bind to")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind to")
    parser.add_argument("--n_gpu_layers", type=int, default=-1, help="Number of layers to offload to GPU (-1 for all)")
    parser.add_argument("--n_ctx", type=int, default=2048, help="Context window size")
    
    args = parser.parse_args()

    if not os.path.exists(args.model):
        print(f"Error: Model file not found at {args.model}")
        return

    print(f"Starting server with model: {args.model}")
    print(f"GPU Layers: {args.n_gpu_layers}")

    # Set environment variables for the settings
    os.environ["MODEL"] = args.model
    os.environ["N_GPU_LAYERS"] = str(args.n_gpu_layers)
    os.environ["N_CTX"] = str(args.n_ctx)
    
    # Create the app
    # We can pass settings explicitly or rely on env vars. 
    # Using create_app() reads from env vars or defaults.
    app = create_app()

    print(f"Server running at http://{args.host}:{args.port}")
    print(f"Docs available at http://{args.host}:{args.port}/docs")
    
    uvicorn.run(app, host=args.host, port=args.port)

if __name__ == "__main__":
    main()
