export type GatewayEndpoint = {
  url: string;
  token?: string;
  password?: string;
};

export type XiaoZhiEndpoint = {
  mcpUrl: string;
  dataPlaneUrl?: string;
};

export type ConnectivityConfig = {
  gateway: GatewayEndpoint;
  xiaozhi: XiaoZhiEndpoint;
};

