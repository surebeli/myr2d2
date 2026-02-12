import platform
import subprocess
import sys
import os

def install_dependencies():
    system = platform.system()
    machine = platform.machine()
    
    print(f"Detected System: {system}, Machine: {machine}")
    
    env = os.environ.copy()
    
    # Common pip install command
    pip_cmd = [sys.executable, "-m", "pip", "install", "--no-cache-dir"]
    
    # 1. Install other dependencies first
    print("Installing general dependencies...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])

    # 2. Re-install llama-cpp-python with hardware acceleration
    print("Installing llama-cpp-python with hardware acceleration...")
    
    if system == "Darwin" and machine == "arm64":
        print("Configuring for MacOS Apple Silicon (Metal)...")
        env["CMAKE_ARGS"] = "-DLLAMA_METAL=on"
        subprocess.check_call(pip_cmd + ["--force-reinstall", "llama-cpp-python"], env=env)
        
    elif system == "Windows":
        print("Configuring for Windows (assuming CUDA for NVIDIA GPU)...")
        # Assuming the user has CUDA installed as they mentioned 30xx series
        env["CMAKE_ARGS"] = "-DLLAMA_CUDA=on"
        subprocess.check_call(pip_cmd + ["--force-reinstall", "llama-cpp-python"], env=env)
        
    elif system == "Linux":
        print("Configuring for Linux (assuming CUDA)...")
        env["CMAKE_ARGS"] = "-DLLAMA_CUDA=on"
        subprocess.check_call(pip_cmd + ["--force-reinstall", "llama-cpp-python"], env=env)
        
    else:
        print("Unknown platform or architecture. Installing CPU version...")
        subprocess.check_call(pip_cmd + ["llama-cpp-python"])

    print("\nInstallation complete!")

if __name__ == "__main__":
    install_dependencies()
