import type { EdgeDevice, EdgeDeviceId } from "./types.js";

export type EdgeDeviceRegistry = {
  upsert: (device: EdgeDevice) => void;
  get: (id: EdgeDeviceId) => EdgeDevice | undefined;
  list: () => EdgeDevice[];
};

export const createInMemoryEdgeDeviceRegistry = (): EdgeDeviceRegistry => {
  const byId = new Map<EdgeDeviceId, EdgeDevice>();
  return {
    upsert: (device) => {
      byId.set(device.id, device);
    },
    get: (id) => byId.get(id),
    list: () => Array.from(byId.values()),
  };
};

