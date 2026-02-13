## drawio-mcp 使用方式

在本仓库中，架构图/流程图以 Mermaid 源文件（`.mmd`）管理，通过 draw.io MCP 工具生成可编辑的 draw.io 链接（`links.json`）。

### 生成链接（需要 Node.js + npx）

```bash
node scripts/drawio-mcp/generate-links.mjs doc/xiaozhi/diagrams
```

生成结果：`doc/xiaozhi/diagrams/links.json`

### 编辑图

- 打开 `links.json` 里对应条目的 `url`
- 在 draw.io 中按需调整样式/布局，并可导出 SVG 后放回本目录以便 Markdown 内嵌

