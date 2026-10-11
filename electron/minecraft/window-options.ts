import fs from 'fs/promises';
import path from 'path';
import { atomicWrite } from './atomic-files';

export async function applyFullscreenSetting(gameDir: string, fullscreen: boolean): Promise<void> {
  const file = path.join(gameDir, 'options.txt');
  let source = '';
  try { source = await fs.readFile(file, 'utf-8'); }
  catch (error: any) { if (error.code !== 'ENOENT') throw error; }
  const lines = source.split(/\r?\n/).filter(line => !line.startsWith('fullscreen:'));
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  lines.push(`fullscreen:${fullscreen === true}`);
  const output=lines.join('\n')+'\n';
  if(output!==source)await atomicWrite(file,output);
}
