# 子报告 05：WhatsApp Bridge（whatsapp_bridge）

核心文件：
- Node bridge：[bridge/src/index.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/bridge/src/index.ts)、[bridge/src/server.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/bridge/src/server.ts)、[bridge/src/whatsapp.ts](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/bridge/src/whatsapp.ts)
- Python channel：[channels/whatsapp.py](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/channels/whatsapp.py)

## 结论摘要

- 协议层非常薄：Python 与 Node 通过 WebSocket 交换 JSON 消息，Node 将 Baileys 事件广播给所有 WS client。
- 重连是“双层”的：Node 侧在 WhatsApp 断开时尝试 5s 后 reconnect；Python 侧在 WS 断开时 5s 后 reconnect。
- 可靠性弱点主要集中在“无离线队列/无 ack 链路/无应用层心跳”：断线期间消息可能丢失，发送成功与否在 Python 侧不可观测。

## WebSocket 消息协议

### Python → Bridge（发送消息）

- `{"type":"send","to":<jid>,"text":<text>}`  
  Python 侧发送实现：[whatsapp.py:L75-L88](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/channels/whatsapp.py#L75-L88)  
  Node 侧处理入口：[server.ts:L44-L52](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/bridge/src/server.ts#L44-L52)

### Bridge → Python（入站/状态/二维码/错误）

- 入站消息：`{"type":"message","id","sender","content","timestamp","isGroup"}`  
  Node 构造：[whatsapp.ts:L107-L131](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/bridge/src/whatsapp.ts#L107-L131)  
  Node 广播：[server.ts:L76-L83](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/bridge/src/server.ts#L76-L83)  
  Python 消费：[whatsapp.py:L91-L125](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/channels/whatsapp.py#L91-L125)
- 连接状态：`{"type":"status","status":"connected"|"disconnected"}`（[whatsapp.ts:L83-L101](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/bridge/src/whatsapp.ts#L83-L101)）
- 二维码：`{"type":"qr","qr":<string>}`（[whatsapp.ts:L76-L81](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/bridge/src/whatsapp.ts#L76-L81)）
- 错误：`{"type":"error","error":<string>}`（[server.ts:L44-L52](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/bridge/src/server.ts#L44-L52)）
- 发送回执：`{"type":"sent","to":<to>}`（Node 会发送，但 Python 侧当前未处理该类型）  
  Node：同上 [server.ts:L44-L52](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/bridge/src/server.ts#L44-L52)

## 生命周期与重连

- Bridge 启动：`BridgeServer.start()` 启动 WS server 并连接 WhatsApp（[index.ts:L32-L49](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/bridge/src/index.ts#L32-L49)；[server.ts:L26-L68](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/bridge/src/server.ts#L26-L68)）。
- Node → WhatsApp 重连：非 logout 的 close 会在 5 秒后 reconnect（[whatsapp.ts:L83-L97](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/bridge/src/whatsapp.ts#L83-L97)）。
- Python → Bridge 重连：WS 断开或异常后 sleep 5s 继续 connect（[whatsapp.py:L41-L65](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/channels/whatsapp.py#L41-L65)）。

## 可靠性与可观测性问题（按严重度）

- **断线期间消息丢失**：Node 侧仅 `broadcast`，无缓存/重放；Python 不在线时消息直接丢（[server.ts:L76-L83](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/bridge/src/server.ts#L76-L83)）。
- **发送缺少端到端确认**：Python `send()` 只是 `ws.send`；Node 虽发送 `type:"sent"`，但 Python 不消费该回执，无法判断是否投递成功（[whatsapp.py:L75-L90](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/channels/whatsapp.py#L75-L90)）。
- **connected 语义不一致**：Python 的 `_connected` 表示“WS 连接成功”，不代表 WhatsApp 已连上；实际发送可能在 Node 端因未连接 WhatsApp 而失败（[whatsapp.py:L43-L47](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/channels/whatsapp.py#L43-L47)；[whatsapp.ts:L171-L177](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/bridge/src/whatsapp.ts#L171-L177)）。
- **内容覆盖面有限**：Bridge 只提取文本/带 caption 的媒体等；其他类型可能被丢弃（[whatsapp.ts:L134-L169](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/bridge/src/whatsapp.ts#L134-L169)）。
- **语音不可用**：语音消息在 bridge 侧被替换成占位符，Python 侧提示不支持下载/转写（[whatsapp.ts:L163-L166](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/bridge/src/whatsapp.ts#L163-L166)；[whatsapp.py:L110-L114](file:///Users/litianyi/Documents/__secondlife/__project/myr2d2/thirdparty/mynanobot/nanobot/channels/whatsapp.py#L110-L114)）。

