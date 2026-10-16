import net from 'node:net';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export type DiscordActivity = {
  type: 0; details: string; state: string;
  timestamps?: { start: number };
  assets?: { large_image: string; large_text: string };
  buttons?: { label: string; url: string }[];
};

export function rpcFrame(opcode: number, value: unknown): Buffer {
  const payload = Buffer.from(JSON.stringify(value), 'utf8');
  const header = Buffer.alloc(8);
  header.writeUInt32LE(opcode); header.writeUInt32LE(payload.length, 4);
  return Buffer.concat([header, payload]);
}

export class RpcFrames {
  private buffer = Buffer.alloc(0);
  push(chunk: Buffer): { opcode: number; value: any }[] {
    if (this.buffer.length + chunk.length > 128 * 1024) throw new Error('RPC buffer too large');
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const frames = [];
    while (this.buffer.length >= 8) {
      const opcode = this.buffer.readUInt32LE(0), size = this.buffer.readUInt32LE(4);
      if (size > 64 * 1024 || opcode > 4) throw new Error('Invalid RPC frame');
      if (this.buffer.length < size + 8) break;
      frames.push({ opcode, value: JSON.parse(this.buffer.toString('utf8', 8, 8 + size)) });
      this.buffer = this.buffer.subarray(8 + size);
    }
    return frames;
  }
}

export function discordPipe(index: number): string {
  if (process.platform === 'win32') return `\\\\?\\pipe\\discord-ipc-${index}`;
  const prefix = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || process.env.TEMP || '/tmp';
  return path.join(prefix, `discord-ipc-${index}`);
}

/** Local Discord IPC only. No Discord token, account login or remote RPC access. */
export class DiscordRpc {
  private socket?: net.Socket;
  private ready = false;
  private enabled = false;
  private desired: DiscordActivity | null = null;
  private sent = '';
  private pending?: { nonce: string; key: string; at: number };
  private lastSent = 0;
  private retry?: NodeJS.Timeout;
  private flush?: NodeJS.Timeout;
  private generation = 0;
  constructor(private applicationId: string, private pid = process.pid) {}

  setEnabled(enabled: boolean): void {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    if (enabled && /^[0-9]{17,20}$/.test(this.applicationId)) this.connect(0, ++this.generation);
    else this.disconnect();
  }
  setActivity(activity: DiscordActivity | null): void {
    this.desired = activity;
    this.publish();
  }
  private connect(index: number, generation: number): void {
    if (!this.enabled || generation !== this.generation) return;
    const socket = net.createConnection(discordPipe(index));
    this.socket = socket;
    const parser = new RpcFrames();
    let established = false;
    const timeout = setTimeout(() => socket.destroy(), 2500); timeout.unref();
    socket.on('connect', () => socket.write(rpcFrame(0, { v: 1, client_id: this.applicationId })));
    socket.on('data', chunk => {
      if (generation !== this.generation || this.socket !== socket) return;
      try {
        for (const frame of parser.push(chunk)) {
          if (frame.opcode === 3) { socket.write(rpcFrame(4, frame.value)); continue; }
          if (frame.opcode === 2) { socket.destroy(); return; }
          if (frame.opcode !== 1) continue;
          if (frame.value.evt === 'READY') {
            clearTimeout(timeout); established = true; this.ready = true; this.sent = ''; this.lastSent = 0;
            this.publish();
          } else if (frame.value.nonce === this.pending?.nonce) {
            if (frame.value.evt === 'ERROR') { socket.destroy(); return; }
            this.sent = this.pending!.key; this.pending = undefined; this.publish();
          }
        }
      } catch { socket.destroy(); }
    });
    socket.on('error', () => {}); // Discord may be absent or restarted; never disrupt the game.
    socket.on('close', () => {
      clearTimeout(timeout);
      if (generation !== this.generation || this.socket !== socket) return;
      this.socket = undefined; this.ready = false; this.pending = undefined;
      if (!this.enabled) return;
      if (!established && index < 9) this.connect(index + 1, generation);
      else { this.retry = setTimeout(() => this.connect(0, generation), 30000); this.retry.unref(); }
    });
  }
  private publish(): void {
    if (!this.enabled || !this.ready || !this.socket || this.socket.destroyed) return;
    const key = JSON.stringify(this.desired);
    if (key === this.sent || this.flush) return;
    if (this.pending && Date.now() - this.pending.at >= 15000) { this.socket.destroy(); return; }
    const wait = this.pending ? 1000 : Math.max(0, 15000 - (Date.now() - this.lastSent));
    if (wait) { this.flush = setTimeout(() => { this.flush = undefined; this.publish(); }, wait); this.flush.unref(); return; }
    const nonce = randomUUID();
    this.pending = { nonce, key, at: Date.now() }; this.lastSent = Date.now();
    this.socket.write(rpcFrame(1, { cmd: 'SET_ACTIVITY', args: { pid: this.pid, activity: this.desired }, nonce }));
    this.flush = setTimeout(() => { this.flush = undefined; this.publish(); }, 15000); this.flush.unref();
  }
  private disconnect(): void {
    ++this.generation;
    clearTimeout(this.retry); clearTimeout(this.flush); this.retry = undefined; this.flush = undefined;
    const socket = this.socket;
    if (socket && this.ready && !socket.destroyed) {
      socket.end(rpcFrame(1, { cmd: 'SET_ACTIVITY', args: { pid: this.pid, activity: null }, nonce: randomUUID() }));
      const timer = setTimeout(() => socket.destroy(), 500); timer.unref();
    } else socket?.destroy();
    this.socket = undefined; this.ready = false; this.pending = undefined; this.sent = '';
  }
  close(): void { this.enabled = false; this.disconnect(); }
}
