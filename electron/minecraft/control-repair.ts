import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { execFile } from 'child_process';
import { atomicWrite } from './atomic-files';
import { normalizeGameDirectory } from './game-directory';
import type { ControlRepairResult } from '../../src/types';

export const JEI_CLICK_BINDINGS = [
 'key_key.jei.transferRecipeBookmark',
 'key_key.jei.maxTransferRecipeBookmark',
 'key_key.jei.cheatItemStack',
 'key_key.jei.toggleCheatModeConfigButton',
 'key_key.jei.toggleHideIngredient',
] as const;

export function repairClickBindingsText(text: string): { text: string; changed: string[] } {
 if(text.includes('\0')) throw new Error('Файл настроек повреждён. Исправление отменено.');
 const changed = new Set<string>(), present = new Set<string>();
 const wanted = new Set<string>(JEI_CLICK_BINDINGS);
 let output = text.replace(/(^|\r?\n)(key_key\.jei\.[^:\r\n]+):([^\r\n]*)/g, (line, prefix, name, value) => {
  if(!wanted.has(name)) return line;
  present.add(name);
  // Preserve custom non-mouse bindings and already unbound keys.
  if(!/^key\.mouse\.left(?::.*)?$/.test(value)) return line;
  changed.add(name);
  return prefix + name + ':key.keyboard.unknown';
 });
 const missing = JEI_CLICK_BINDINGS.filter(name => !present.has(name));
 if(missing.length) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  if(output && !output.endsWith('\n')) output += eol;
  output += missing.map(name => name + ':key.keyboard.unknown').join(eol) + eol;
  missing.forEach(name => changed.add(name));
 }
 return { text: output, changed: [...changed] };
}

export async function assertMinecraftClosed(): Promise<void> {
 const marker = 'net.fabricmc.loader.impl.launch.knot.KnotClient|net.minecraft.client.main.Main|org.quiltmc.loader.impl.launch.knot.KnotClient';
 const command = process.platform === 'win32' ? 'powershell.exe' : 'pgrep';
 const args = process.platform === 'win32' ? ['-NoProfile', '-NonInteractive', '-Command',
  "Get-CimInstance Win32_Process -Filter \"Name = 'java.exe' OR Name = 'javaw.exe'\" -ErrorAction Stop | Where-Object { $_.CommandLine -match '" + marker + "' } | Select-Object -ExpandProperty ProcessId"] : ['-f', marker];
 const running = await new Promise<boolean>((resolve, reject) => {
  execFile(command, args, { windowsHide: true, timeout: 10000, maxBuffer: 4096 }, (error, stdout) => {
   if(error && !(process.platform !== 'win32' && error.code === 1)) {
    reject(new Error('Не удалось проверить, закрыт ли Minecraft. Повторите исправление после закрытия игры.')); return;
   }
   resolve(stdout.trim().length > 0);
  });
 });
 if(running) throw new Error('Закройте Minecraft перед исправлением: открытая игра может перезаписать настройки.');
}

export function repairResourcePacksText(text: string): {text:string; changed:string[]} {
 let found=false,changed=false;
 const output=text.replace(/(^|\r?\n)resourcePacks:([^\r\n]*)/g,(line,prefix,value)=>{
  found=true;let packs:unknown;try{packs=JSON.parse(value);}catch{throw new Error('Список ресурс-паков повреждён. Исправление отменено.');}
  if(!Array.isArray(packs) || packs.some(p=>typeof p!=='string'))throw new Error('Некорректный список ресурс-паков.');
  if(packs.includes('file/Homestead GUI'))return line;
  changed=true;return prefix+'resourcePacks:'+JSON.stringify([...packs,'file/Homestead GUI']);
 });
 if(!found)throw new Error('В настройках нет списка ресурс-паков. Сначала запустите и закройте Minecraft.');
 return {text:output,changed:changed?['resourcePacks']:[]};
}
export async function repairClickBindings(directory:string,assertIdle=assertMinecraftClosed):Promise<ControlRepairResult>{
 return repairOptions(directory,repairClickBindingsText,assertIdle);
}
export async function repairResourcePacks(directory:string,assertIdle=assertMinecraftClosed):Promise<ControlRepairResult>{
 await assertIdle();
 const pack=path.join(normalizeGameDirectory(directory),'resourcepacks','Homestead GUI','pack.mcmeta');
 if(!(await fs.lstat(pack).catch(()=>null))?.isFile())throw new Error('Ресурс-пак Homestead GUI не установлен. Сначала восстановите сборку.');
 return repairOptions(directory,repairResourcePacksText,assertIdle);
}
async function repairOptions(directory:string,transform:(text:string)=>{text:string;changed:string[]},assertIdle:()=>Promise<void>):Promise<ControlRepairResult>{
 await assertIdle();
 const root = await fs.realpath(normalizeGameDirectory(directory));
 const file = path.join(root, 'options.txt');
 let stat;
 try { stat = await fs.lstat(file); }
 catch(error: any) { if(error.code === 'ENOENT') throw new Error('Сначала один раз запустите и закройте Minecraft, затем повторите исправление.'); throw error; }
 if(!stat.isFile() || stat.isSymbolicLink() || stat.size > 2 * 1024 * 1024) throw new Error('Файл настроек недоступен для безопасного исправления.');
 const lock = file + '.sefi-controls.lock';
 let handle;
 try { handle = await fs.open(lock, 'wx', 0o600); }
 catch(error: any) { if(error.code === 'EEXIST') throw new Error('Исправление уже выполняется. Дождитесь завершения.'); throw error; }
 try {
  const original = await fs.readFile(file);
  const text=original.toString('utf8');
  if(!Buffer.from(text,'utf8').equals(original))throw new Error('Файл настроек повреждён. Исправление отменено.');
  const update = transform(text);
  if(!update.changed.length) return { changed: 0 };
  const backupDir = path.join(root, 'sefi-backups', 'controls');
  for(const dir of [path.join(root, 'sefi-backups'), backupDir]) {
   await fs.mkdir(dir, {recursive:true});
   const info = await fs.lstat(dir);
   if(!info.isDirectory() || info.isSymbolicLink()) throw new Error('Не удалось безопасно сохранить резервную копию настроек.');
  }
  const backupPath = path.join(backupDir, 'options-before-click-fix-' + Date.now() + '-' + randomUUID() + '.txt');
  await fs.writeFile(backupPath, original, {flag:'wx',mode:0o600});
  await assertIdle();
  if(!(await fs.readFile(file)).equals(original)) throw new Error('Настройки изменились во время исправления. Повторите после закрытия игры.');
  await atomicWrite(file, update.text);
  return { changed: update.changed.length, backupPath };
 } finally { await handle.close(); await fs.unlink(lock); }
}
