import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

export type GameLocation = { mode: 'menu' | 'singleplayer' | 'multiplayer'; server?: string };
export function gameLocation(value: unknown): GameLocation | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  if (input.mode === 'menu' || input.mode === 'singleplayer') return { mode: input.mode };
  if (input.mode === 'multiplayer' && typeof input.server === 'string' && input.server.length <= 255
    && /^[a-zA-Z0-9.\-:\[\]]+$/.test(input.server)) return { mode: 'multiplayer', server: input.server };
  return null;
}

/** Per-launch directory, not an API. Only a small game-state heartbeat is read. */
export async function watchGamePresence(onChange: (value: GameLocation | null) => void) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'sefi-presence-'));
  const file = path.join(directory, 'state.json');
  let closed = false, reading = false;
  const read = async () => {
    if (closed || reading) return;
    reading = true;
    let location: GameLocation | null = null;
    try {
      const handle = await fs.open(file, 'r');
      try {
        const stat = await handle.stat();
        if (stat.isFile() && stat.size <= 2048 && Date.now() - stat.mtimeMs < 15000) {
          const buffer = Buffer.alloc(2049);
          const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
          if (bytesRead <= 2048) location = gameLocation(JSON.parse(buffer.toString('utf8', 0, bytesRead)));
        }
      } finally { await handle.close(); }
    } catch { /* Missing, stale or malformed telemetry means unknown location. */ }
    reading = false;
    if (!closed) onChange(location);
  };
  const timer = setInterval(() => { void read(); }, 2000); timer.unref();
  return { file, close() {
    if (closed) return;
    closed = true; clearInterval(timer);
    // No recursive removal: the game may still be finishing its last write.
    void fs.unlink(file).catch(() => {}).then(() => fs.unlink(file + '.tmp').catch(() => {}))
      .then(() => fs.rmdir(directory).catch(() => {}));
  } };
}
