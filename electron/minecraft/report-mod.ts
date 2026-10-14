import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import { randomUUID } from 'crypto';
import { installFile, renameFile } from './atomic-files';
export async function ensureReportMod(gameDir:string):Promise<void> {
 const name='sefi-input-diagnostics-0.2.0.jar';
 const candidates=[path.join(process.resourcesPath||'','resources/mods',name),path.join(app.getAppPath(),'resources/mods',name)];
 const source=await Promise.all(candidates.map(async p=>await fs.access(p).then(()=>p,()=>null))).then(paths=>paths.find(Boolean));
 if(!source) throw new Error('В установке лаунчера отсутствует мод отчётов SEFI. Переустановите лаунчер.');
 const mods=path.join(gameDir,'mods');await fs.mkdir(mods,{recursive:true});
 if((await fs.lstat(mods)).isSymbolicLink())throw new Error('Установка мода отчётов через ссылку запрещена.');
 await installFile(source,path.join(mods,name));
 for(const item of await fs.readdir(mods,{withFileTypes:true})) {
  if(item.isFile() && item.name!==name && /^sefi-input-diagnostics-\d[\w.+-]*\.jar$/.test(item.name)) {
   const backup=path.join(gameDir,'sefi-backups','reports-'+randomUUID());await fs.mkdir(backup,{recursive:true});await renameFile(path.join(mods,item.name),path.join(backup,item.name));
  }
 }
}
