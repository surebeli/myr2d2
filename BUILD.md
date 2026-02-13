# 构建与打包（统一入口）

本仓库使用 `node scripts/build/index.mjs` 作为统一构建入口，用于：

- 构建/打包 `LocalModelMacOS`（RN macOS）
- 打包 `speechassistant`（本地 Whisper ASR daemon）
- 打包/部署 `myopenclaw`（本地 CLI + Gateway）

## 常用命令

```bash
node scripts/build/index.mjs --help
```

## 环境依赖（macOS）

- Xcode Command Line Tools（提供 `xcodebuild`、`codesign`）
- Node.js（构建 openclaw / RN 打包）
- Corepack（默认随 Node 提供，用于提供 `pnpm`）

### 依赖安装

```bash
node scripts/build/index.mjs bootstrap
```

### 运行测试

```bash
node scripts/build/index.mjs verify
```

### 构建 openclaw

需要安装 `pnpm`：

```bash
node scripts/build/index.mjs build:openclaw
```

### macOS 打包（Release）

会生成：

- `dist/LocalModelMacOS.app`
- `dist/SpeechAssistant-macos.zip`（包含 app + speechassistant + openclaw + 部署脚本）

```bash
node scripts/build/index.mjs package:macos
```

## 部署（本机）

将 openclaw wrapper 安装到 `~/.local/bin/openclaw`，并为 `speechassistant` 创建 venv 安装依赖：

```bash
node scripts/build/index.mjs deploy:local
```

支持控制是否同步最新源码到部署目录：

```bash
node scripts/build/index.mjs deploy:local --sync
node scripts/build/index.mjs deploy:local --no-sync
```

部署目录默认是 `~/.local/share/myr2d2`，可自定义：

```bash
node scripts/build/index.mjs deploy:local --target /path/to/deploy
```

也可以直接运行：

```bash
bash scripts/deploy/install-all-local.sh
```
