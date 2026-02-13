# Speech Assistant (macOS)

本模块提供一个本地常驻语音助手：监听麦克风 → 识别唤醒词“小虾米” → 继续听你下一句话 → 本地 Whisper 转写 → 把文本发送给 `openclaw agent` 执行，并把 OpenClaw 的返回信息回传给 UI。

## 快速开始

1) 安装依赖（创建 venv 并安装 Python 包）

```bash
cd speechassistant
python3 install.py
```

2) 安装本地 Whisper（二选一）

- `whisper`（openai-whisper）：`brew install openai-whisper`
- `whisper-cli`（whisper.cpp）：自行安装并准备模型文件路径（建议用 UI 填写模型路径）

3) 启动 daemon

```bash
cd speechassistant
./.venv/bin/python3 server.py
```

默认监听：`http://127.0.0.1:8765`，并提供 WebSocket：`ws://127.0.0.1:8765/ws`

## 模型策略（M1 Ultra 默认）

- 插电（效果优先）：`large-v3`
- 不插电（性能优先）：`small`

可在 UI 中分别选择 AC/Battery 模型，配置会写回 `speechassistant/config.json`。

## OpenClaw 接入

默认调用：

```bash
openclaw agent --message "<text>" --json
```

需要 `openclaw` 在 PATH 中，且本机 Gateway/Agent 可用。

## 端到端验证清单

1) 在 `LocalModelMacOS` 的 Speech 页点击 Install，然后点击 Start
2) UI 显示 Daemon: RUNNING
3) 点击 Start Listening 后说“小虾米”
4) UI 出现 wake 状态变化，并在日志里出现“我在”
5) 随后说一段指令（例如“总结今天的日志”）
6) UI 显示 transcript，并在 OpenClaw 区域看到返回内容
