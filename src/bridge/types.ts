export type NodeId = string;

export type OpenClawNodeConfig = {
  gatewayUrl: string;
  nodeId: NodeId;
  token?: string;
  password?: string;
  declaredCommands: string[];
};

export type McpClientConfig = {
  url: string;
};

export type DataPlaneConfig = {
  url?: string;
};

export type ShimConfig = {
  openclaw: OpenClawNodeConfig;
  mcp: McpClientConfig;
  dataPlane: DataPlaneConfig;
};

