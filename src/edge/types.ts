export type EdgeDeviceId = string;

export type EdgeDevice = {
  id: EdgeDeviceId;
  displayName?: string;
};

export type CapabilityTool = {
  name: string;
  description?: string;
  inputSchema?: unknown;
};

