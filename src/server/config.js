/**
 * APEX Telemetry Server Configuration
 */
export const CONFIG = {
  http: {
    port: parseInt(process.env.APEX_HTTP_PORT || '3000', 10),
    host: process.env.APEX_HTTP_HOST || '0.0.0.0'
  },
  udp: {
    port: parseInt(process.env.APEX_UDP_PORT || '9999', 10),
    host: process.env.APEX_UDP_HOST || '0.0.0.0',
    expectedPacketSize: 331,
    minPacketSize: 311
  },
  ws: {
    port: parseInt(process.env.APEX_WS_PORT || '8080', 10),
    host: process.env.APEX_WS_HOST || '0.0.0.0',
    heartbeatIntervalMs: 5000,
    clientTimeoutMs: 15000
  },
  buffer: {
    maxSamples: 100000 // 100,000 samples @ 60Hz ~= 27.7 minutes
  }
};
