import argparse
import os
from huggingface_hub import hf_hub_download

def download_model(repo_id, filename, local_dir):
    print(f"Downloading {filename} from {repo_id}...")
    try:
        model_path = hf_hub_download(
            repo_id=repo_id,
            filename=filename,
            local_dir=local_dir,
            local_dir_use_symlinks=False
        )
        print(f"Model downloaded to: {model_path}")
        return model_path
    except Exception as e:
        print(f"Error downloading model: {e}")
        return None

def main():
    parser = argparse.ArgumentParser(description="Download GGUF Model")
    # Default to a small, efficient model suitable for testing
    parser.add_argument("--repo", type=str, default="Qwen/Qwen2.5-1.5B-Instruct-GGUF", help="HuggingFace Repository ID")
    parser.add_argument("--file", type=str, default="qwen2.5-1.5b-instruct-q4_k_m.gguf", help="Model filename (GGUF)")
    parser.add_argument("--dir", type=str, default="models", help="Directory to save the model")
    
    args = parser.parse_args()
    
    if not os.path.exists(args.dir):
        os.makedirs(args.dir)
        
    download_model(args.repo, args.file, args.dir)

if __name__ == "__main__":
    main()
