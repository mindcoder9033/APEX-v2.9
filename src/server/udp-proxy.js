/**
 * APEX UDP-to-WebSocket Proxy Server & Static HTTP Host
 * Serves the Pit-Wall Web UI (port 3000), listens for UDP telemetry (port 9999),
 * and streams over WebSocket (port 8080).
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dgram from 'node:dgram';
import { WebSocketServer, WebSocket } from 'ws';
import { execSync } from 'node:child_process';
import { CONFIG } from './config.js';
import { TelemetryParser } from '../shared/telemetry-parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, '../../public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

/**
 * Helper to check if a process is a Node process.
 * @param {number} pid 
 * @returns {boolean}
 */
function isNodeProcess(pid) {
  try {
    if (process.platform === 'win32') {
      const output = execSync(`tasklist /FI "PID eq ${pid}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      return output.toLowerCase().includes('node');
    } else {
      const output = execSync(`ps -p ${pid} -o comm=`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      return output.toLowerCase().includes('node');
    }
  } catch {
    return false;
  }
}

/**
 * Helper to kill any other Node process occupying a given port.
 * @param {number} port 
 */
function killProcessUsingPort(port) {
  if (!port) return;
  try {
    if (process.platform === 'win32') {
      const output = execSync('netstat -ano', { encoding: 'utf8' });
      const lines = output.split('\n');
      const pids = new Set();
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 4) {
          const localAddress = parts[1];
          const pidStr = parts[parts.length - 1];
          const pid = parseInt(pidStr, 10);
          if (localAddress && !isNaN(pid) && pid > 0 && pid !== process.pid) {
            if (localAddress.endsWith(':' + port)) {
              pids.add(pid);
            }
          }
        }
      }
      for (const pid of pids) {
        if (isNodeProcess(pid)) {
          try {
            console.log(`[CLEANUP] Port ${port} is occupied by zombie Node process (PID ${pid}). Terminating...`);
            execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
          } catch {
            // Ignore termination failures
          }
        }
      }
    } else {
      try {
        const output = execSync(`lsof -t -i :${port}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
        const pids = output
          .split('\n')
          .map(p => parseInt(p.trim(), 10))
          .filter(p => !isNaN(p) && p !== process.pid);

        for (const pid of pids) {
          if (isNodeProcess(pid)) {
            try {
              console.log(`[CLEANUP] Port ${port} is occupied by zombie Node process (PID ${pid}). Terminating...`);
              execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
            } catch {
              // Ignore termination failures
            }
          }
        }
      } catch {
        // lsof returns non-zero if no processes found, which is normal
      }
    }
  } catch (err) {
    console.warn(`[CLEANUP WARNING] Failed to clear port ${port}:`, err.message);
  }
}

export class UdpProxyServer {
  constructor(options = {}) {
    this.httpPort = options.httpPort || CONFIG.http.port;
    this.httpHost = options.httpHost || CONFIG.http.host;
    this.udpPort = options.udpPort || CONFIG.udp.port;
    this.udpHost = options.udpHost || CONFIG.udp.host;
    this.wsPort = options.wsPort || CONFIG.ws.port;
    this.wsHost = options.wsHost || CONFIG.ws.host;
    this.wsPortSpecified = options.wsPort !== undefined;

    this.httpServer = null;
    this.udpSocket = null;
    this.wss = null;
    this.clients = new Set();
    this.stats = {
      packetsReceived: 0,
      packetsPerSecond: 0,
      bytesReceived: 0,
      invalidPackets: 0,
      clientsConnected: 0,
      lastPacketTime: null
    };

    this._packetCountInterval = null;
    this._heartbeatInterval = null;
    this._recentPacketCounter = 0;
  }

  /**
   * Starts HTTP server, WebSocket server, and UDP socket listener
   */
  async start() {
    // Proactively clear the UDP port to resolve any conflicts from prior zombie processes.
    // Since UDP and HTTP servers run on the same Node process in production, terminating
    // the process using the UDP port is sufficient to clean up the entire old instance.
    killProcessUsingPort(this.udpPort);

    await this.startHttpServer();
    await this.startWebSocketServer();
    await this.startUdpSocket();
    this.startMetricsTracker();

    const actualWsPort = (this.httpServer && (!this.wsPortSpecified || this.wsPort === this.httpPort))
      ? this.httpPort
      : this.wsPort;

    console.log(`\n======================================================`);
    console.log(`  🏎️   APEX PIT-WALL COMMAND CENTER ACTIVE`);
    console.log(`  🖥️   Web Dashboard: http://localhost:${this.httpPort}`);
    console.log(`  📡   UDP Listener:  ${this.udpHost}:${this.udpPort}`);
    console.log(`  🌐   WebSocket Hub: ws://${this.wsHost}:${actualWsPort}`);
    console.log(`======================================================`);
    console.log(`  ⏳   Awaiting Forza Motorsport / Horizon telemetry on port ${this.udpPort}...`);
    console.log(`  💡   (Or run 'npm run mock:stream' in a separate terminal to test)\n`);
  }

  /**
   * Static HTTP File Server for Web UI
   */
  startHttpServer() {
    return new Promise((resolve, reject) => {
      this.httpServer = http.createServer(async (req, res) => {
        let reqPath = req.url.split('?')[0];
        if (!reqPath || reqPath === '/') {
          reqPath = '/index.html';
        }
        const safePath = path.normalize(reqPath).replace(/^(\.\.[/\\])+/, '');
        const filePath = path.join(PUBLIC_DIR, safePath);

        fs.stat(filePath, (err, stats) => {
          if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
          }

          const ext = path.extname(filePath).toLowerCase();
          const contentType = MIME_TYPES[ext] || 'application/octet-stream';

          res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'no-cache'
          });

          fs.createReadStream(filePath).pipe(res);
        });
      });

      this.httpServer.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.warn(`[HTTP WARN] Port ${this.httpPort} in use, continuing without HTTP static host.`);
          resolve(null);
        } else {
          reject(err);
        }
      });

      this.httpServer.listen(this.httpPort, this.httpHost, () => {
        resolve(this.httpServer);
      });
    });
  }

  /**
   * Initializes WebSocket Server
   */
  startWebSocketServer() {
    return new Promise((resolve, reject) => {
      try {
        let wsOpts = {};
        if (this.httpServer && (!this.wsPortSpecified || this.wsPort === this.httpPort)) {
          // Attach directly to HTTP server for unified port sharing
          wsOpts = { server: this.httpServer };
        } else {
          wsOpts = { port: this.wsPort };
          if (this.wsHost && this.wsHost !== '0.0.0.0') {
            wsOpts.host = this.wsHost;
          }
        }
        this.wss = new WebSocketServer(wsOpts);

        if (wsOpts.server) {
          resolve(this.wss);
        } else {
          this.wss.on('listening', () => {
            resolve(this.wss);
          });
        }

        this.wss.on('error', (err) => {
          console.error(`[WS ERROR] WebSocket server error:`, err.message);
          reject(err);
        });

        this.wss.on('connection', (ws, req) => {
          const clientIp = req.socket.remoteAddress;
          ws.isAlive = true;
          this.clients.add(ws);
          this.stats.clientsConnected = this.clients.size;

          console.log(`[WS CONNECT] Client connected from ${clientIp} (Total: ${this.clients.size})`);

          ws.send(JSON.stringify({
            type: 'status',
            data: {
              connected: true,
              udpPort: this.udpPort,
              stats: this.stats
            }
          }));

          ws.on('pong', () => {
            ws.isAlive = true;
          });

          ws.on('message', (message) => {
            try {
              const msg = JSON.parse(message.toString());
              if (msg.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
              }
            } catch {
              // Ignore non-JSON messages
            }
          });

          ws.on('close', () => {
            this.clients.delete(ws);
            this.stats.clientsConnected = this.clients.size;
            console.log(`[WS DISCONNECT] Client disconnected (Remaining: ${this.clients.size})`);
          });

          ws.on('error', (err) => {
            console.warn(`[WS CLIENT ERROR]`, err.message);
          });
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Initializes UDP Socket Listener
   */
  startUdpSocket() {
    return new Promise((resolve, reject) => {
      this.udpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

      this.udpSocket.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`\n❌ [UDP PORT CONFLICT] Port ${this.udpPort} is already in use!`);
          console.error(`   Please check if another APEX instance is running.\n`);
        } else {
          console.error(`[UDP ERROR]`, err.message);
        }
        reject(err);
      });

      this.udpSocket.on('message', (msg, rinfo) => {
        this.handleUdpPacket(msg, rinfo);
      });

      this.udpSocket.on('listening', () => {
        const address = this.udpSocket.address();
        resolve(address);
      });

      this.udpSocket.bind(this.udpPort, this.udpHost);
    });
  }

  /**
   * Processes incoming UDP packet and forwards to WebSocket clients
   * @param {Buffer} msg 
   * @param {dgram.RemoteInfo} rinfo 
   */
  handleUdpPacket(msg, rinfo) {
    this.stats.packetsReceived++;
    this.stats.bytesReceived += msg.length;
    this.stats.lastPacketTime = Date.now();
    this._recentPacketCounter++;

    if (this.stats.packetsReceived === 1) {
      console.log(`🟢 [UDP STREAM DETECTED] Receiving live telemetry from ${rinfo.address}:${rinfo.port}`);
    }

    const validation = TelemetryParser.validate(msg);
    if (!validation.valid) {
      this.stats.invalidPackets++;
      return;
    }

    if (this.clients.size === 0) return;

    let parsed = null;
    try {
      parsed = TelemetryParser.parse(msg);
    } catch (err) {
      this.stats.invalidPackets++;
      return;
    }

    const payloadJson = JSON.stringify({
      type: 'telemetry',
      data: parsed,
      timestamp: Date.now()
    });

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payloadJson);
      }
    }
  }

  /**
   * Starts periodic metrics and WebSocket heartbeat checks
   */
  startMetricsTracker() {
    this._packetCountInterval = setInterval(() => {
      this.stats.packetsPerSecond = this._recentPacketCounter;
      this._recentPacketCounter = 0;
    }, 1000);

    this._heartbeatInterval = setInterval(() => {
      for (const ws of this.clients) {
        if (!ws.isAlive) {
          this.clients.delete(ws);
          this.stats.clientsConnected = this.clients.size;
          ws.terminate();
          continue;
        }
        ws.isAlive = false;
        ws.ping();
      }
    }, CONFIG.ws.heartbeatIntervalMs);
  }

  /**
   * Helper to parse JSON body from incoming HTTP request
   */
  readRequestBodyJson(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve(parsed);
        } catch (err) {
          reject(new Error('Invalid JSON payload: ' + err.message));
        }
      });
      req.on('error', err => reject(err));
    });
  }

  /**
   * Stops the server gracefully
   */
  async stop() {
    if (this._packetCountInterval) clearInterval(this._packetCountInterval);
    if (this._heartbeatInterval) clearInterval(this._heartbeatInterval);

    for (const ws of this.clients) {
      ws.close(1000, 'Server stopping');
    }
    this.clients.clear();

    await new Promise((resolve) => {
      if (this.httpServer) {
        this.httpServer.close(resolve);
      } else {
        resolve();
      }
    });

    await new Promise((resolve) => {
      if (this.wss) {
        this.wss.close(resolve);
      } else {
        resolve();
      }
    });

    await new Promise((resolve) => {
      if (this.udpSocket) {
        this.udpSocket.close(resolve);
      } else {
        resolve();
      }
    });

    console.log(`[PROXY] APEX Telemetry Server stopped.`);
  }
}

// Auto-run if executed directly as entrypoint
if (process.argv[1] && process.argv[1].endsWith('udp-proxy.js')) {
  const args = process.argv.slice(2);
  let udpPort = CONFIG.udp.port;
  let wsPort = CONFIG.ws.port;
  let httpPort = CONFIG.http.port;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--udp-port' && args[i + 1]) {
      udpPort = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--ws-port' && args[i + 1]) {
      wsPort = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--http-port' && args[i + 1]) {
      httpPort = parseInt(args[i + 1], 10);
      i++;
    }
  }

  const server = new UdpProxyServer({ udpPort, wsPort, httpPort });
  server.start().catch((err) => {
    console.error('Fatal startup error:', err);
    process.exit(1);
  });

  process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT. Shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM. Shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });
}
