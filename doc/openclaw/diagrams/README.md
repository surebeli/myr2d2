## drawio-mcp 使用方式

本目录使用 Mermaid 源文件（`.mmd`）描述图形结构，通过 draw.io MCP（`open_drawio_mermaid`）生成可编辑的 draw.io 链接（`links.json`）。

### 生成链接

```bash
node scripts/drawio-mcp/generate-links.mjs doc/openclaw/diagrams
```

生成结果：`doc/openclaw/diagrams/links.json`

### 编辑与导出

- 打开 `links.json` 里的 `url`，在 draw.io 中编辑\n- 需要在 Markdown 内嵌时，建议导出 SVG 放回本目录（同名 `*.svg`）

