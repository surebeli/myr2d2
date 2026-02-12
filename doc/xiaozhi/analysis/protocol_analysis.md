# Protocol_Agent 子报告

## 1. 分析结果

| 模块 | 文件 | 方案 | 亮点 | 来源 |
| :--- | :--- | :--- | :--- | :--- |
| **MCP Server** | `main/mcp_server.h`<br>`main/mcp_server.cc` | **C++ Lambda 映射**<br>使用 `std::function` 和 `PropertyList` 定义工具，支持动态注册。 | **内置常用工具集**<br>预置了设备状态、音量、亮度、拍照等工具，且支持 Prompt Cache 优化（常用工具前置）。 | 本地代码 |
| **Protocol Base** | `main/protocols/protocol.h`<br>`main/protocols/protocol.cc` | **抽象基类**<br>定义了 `SendAudio` (二进制) 和 `SendText` (JSON) 接口，以及生命周期回调。 | **MCP 消息封装**<br>提供 `SendMcpMessage` 统一封装 MCP JSON-RPC 消息。支持心跳超时检测 (120s)。 | 本地代码 |
| **WebSocket** | `main/protocols/websocket_protocol.cc` | **标准 WebSocket**<br>文本帧传输 JSON 控制指令，二进制帧传输 Opus 音频。 | **简单高效**<br>适合局域网或高带宽环境，实现简单。 | 本地代码 |
| **MQTT + UDP** | `main/protocols/mqtt_protocol.cc` | **混合传输**<br>MQTT 负责控制信道 (高可靠)，UDP 负责音频信道 (低延迟)。 | **加密与容错**<br>UDP 音频流包含 AES 加密和序列号 (`local_sequence_`)，适应不稳定网络。 | 本地代码 |

## 2. 上下文评估

**[高]**
- 核心代码 `mcp_server.cc` 和 `protocols/` 下的关键实现已完整读取。
- 清楚掌握了 MCP 工具注册机制、JSON 协议格式以及两种传输层的差异。
- 依赖关系清晰：`McpServer` 依赖 `Board` 进行硬件控制，`Protocol` 负责数据传输。

## 3. 问题/建议

1.  **JSON 处理风险**：目前大量使用 `cJSON` 进行手动拼接和解析（如 `SendWakeWordDetected` 中手动拼字符串），容易引入格式错误。建议封装 JSON 构建器或使用更现代的 C++ JSON 库（如果资源允许）。
2.  **硬编码配置**：
    *   超时时间 `kTimeoutSeconds = 120` 硬编码在 `protocol.cc`。
    *   MQTT 心跳 `MQTT_PING_INTERVAL_SECONDS 90` 硬编码在头文件。
    *   建议移至 `Kconfig` 或运行时配置。
3.  **阻塞风险**：MCP 工具执行在协议线程或主线程中（取决于调用上下文），如 `self.camera.take_photo` 虽然降低了任务优先级，但仍可能影响实时性。建议长耗时工具异步执行。
4.  **扩展性**：`McpServer::AddCommonTools` 中混合了不同硬件（Camera, LVGL）的逻辑，通过 `#ifdef` 控制。随着工具增多，建议将工具注册逻辑分散到各硬件模块中（如 `Camera::RegisterMcpTools()`）。

## 4. JSON总结

```json
{
  "highlights": [
    "支持 WebSocket 和 MQTT+UDP 双协议栈，适应不同网络环境",
    "MCP 工具系统设计灵活，支持 Lambda 绑定和动态参数校验",
    "UDP 音频传输实现了 AES 加密和丢包对抗（序列号）",
    "针对 LLM 优化：常用工具前置以利用 Prompt Cache"
  ],
  "issues": [
    "JSON 构造采用手动字符串拼接，存在转义风险",
    "关键网络参数（超时、心跳）硬编码",
    "McpServer 类职责过重，包含了具体硬件的工具实现逻辑"
  ]
}
```
