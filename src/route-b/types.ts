export type WakeEventPayload = {
  wake_word?: string;
  confidence?: number;
  ts?: string;
};

export type AudioStreamStartParams = {
  codec?: "opus" | "pcm16";
  sampleRate?: number;
  channels?: number;
};

export type AudioStreamStartResult = {
  session_id: string;
  uplink_url: string;
  downlink_url: string;
  token: string;
};

export type AudioStreamStopParams = {
  session_id?: string;
};

export type AudioPlayStartParams = {
  codec?: "opus" | "pcm16";
  sampleRate?: number;
  channels?: number;
};

export type AudioPlayStartResult = {
  session_id: string;
  downlink_url: string;
  token: string;
};

