/** Conservative filtering shared by capture, preview, export and submission. */
export function redactReportText(value: string, secrets: string[] = [], paths: string[] = []): string {
 let text = String(value).replace(/\u001b\[[0-9;]*[A-Za-z]/g, '').replace(/\0/g, '');
 for (const secret of [...secrets].filter(v=>v.length>=4).sort((a,b)=>b.length-a.length)) text=text.split(secret).join('[скрыто]');
 for (const p of [...paths].filter(Boolean).sort((a,b)=>b.length-a.length)) {
  text=text.split(p).join('[путь]').split(p.replace(/\\/g,'/')).join('[путь]');
 }
 return text.split(/\r?\n/).filter(line=>!/\[CHAT\]|chat\.type|<[^>]{1,32}>\s/i.test(line)).map(line=>{
  if(/(?:access.?token|refresh.?token|client.?token|community.?token|reportKey|authKey|authorization|bearer|password|passwd|cookie|credential|launcher_secret|session.?id|api.?key|\btoken|\bsecret|sefi\.ticket)\s*["'=:\s]/i.test(line)) return '[строка с данными авторизации скрыта]';
  return line.replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,'[данные авторизации скрыты]').replace(/\b[a-f0-9]{32,}\b/gi,'[идентификатор скрыт]').replace(/(https?:\/\/)[^/\s:@]+:[^/\s@]+@/gi,'$1[скрыто]@').replace(/[A-Z]:[\\/][^\r\n"'<>]*/gi,'[путь]')
   .replace(/\/(?:Users|home)\/[^\s"'<>]+/g,'[путь]')
   .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email скрыт]');
 }).join('\n').slice(0,128*1024);
}
export function reportLines(text: string, fromStart=false): string[] {
 const lines=text.split(/\r?\n/).filter(Boolean);
 return (fromStart?lines.slice(0,300):lines.slice(-300)).map(line=>line.slice(0,900));
}
