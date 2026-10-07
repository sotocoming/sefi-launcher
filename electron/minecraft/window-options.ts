import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

export async function applyFullscreenSetting(gameDir: string, fullscreen: boolean): Promise<void> {
  const file = path.join(gameDir, 'options.txt');
  let source = '';
  try { source = await fs.readFile(file, 'utf-8'); }
  catch (error: any) { if (error.code !== 'ENOENT') throw error; }
  const lines = source.split(/\r?\n/).filter(line => !line.startsWith('fullscreen:'));
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  lines.push(`fullscreen:${fullscreen === true}`);
  await fs.mkdir(gameDir, { recursive: true });
  const temp = path.join(gameDir, `.options-${randomUUID()}.tmp`);
  try {
    await fs.writeFile(temp, lines.join('\n') + '\n', { flag: 'wx' });
    await fs.rename(temp, file);
  } finally { await fs.unlink(temp).catch(() => {}); }
}
