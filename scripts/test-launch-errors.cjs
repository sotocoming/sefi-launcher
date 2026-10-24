const fs=require('fs'),ts=require('typescript'),assert=require('node:assert/strict');
const mod={exports:{}};new Function('exports',ts.transpileModule(fs.readFileSync(require('path').join(__dirname,'../src/utils/errors.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(mod.exports);
const {launchFailure,launchDiagnostics}=mod.exports;
const cases=[
['ENOSPC write failed','disk','settings','java'],['OutOfMemoryError: Java heap space','memory','settings','game'],
['Could not reserve enough space for 6291456KB object heap','memory','settings','game'],
['Сессия SEFI отозвана. Войдите в SEFI Community заново.','account','accounts'],
['Для Minecraft Player нужен вход Microsoft.','account','accounts'],
['Активный аккаунт не найден. Выберите или добавьте профиль.','account','accounts'],
['HTTP 429','rate-limit','retry'],['fetch failed ENOTFOUND','network','retry'],['ETIMEDOUT','timeout','retry'],
['Сервис SEFI временно недоступен (HTTP 503). Аккаунт сохранён; повторите запуск позже.','service','retry'],
['В установке лаунчера отсутствует SEFI Auth.','launcher','settings','launcher'],
['EACCES: access denied','permission','settings','java'],['Windows запретила запуск Java.','permission','settings','java'],
['Для этой сборки нужна Java 21. Выберите Java SEFI в настройках.','java','settings','java'],
['Диск недоступен. Папка игры не существует.','directory','settings','java'],
['Архив Java повреждён: проверка SHA256 не пройдена.','integrity','retry'],
['Сборка не совпадает с контрольной суммой сервера.','integrity','retry'],
['Источник Java ответил HTTP 404.','download','retry'],
['Выбранный адрес сервера больше недоступен.','server','server'],
['Minecraft завершился с ошибкой (код 1). Exception on startup','crash','retry'],
['unexpected failure','unknown','retry']];
for(const [message,kind,action,tab]of cases){const f=launchFailure(message);assert.equal(f.kind,kind,message);assert.equal(f.action,action,message);assert.equal(f.tab,tab,message);assert(f.title&&f.description&&f.actionLabel);}
const redacted=launchDiagnostics("Error invoking remote method 'launch-game': Error: Authorization: Bearer secretJWT --accessToken gameSecret refresh_token=renewal communityToken:commSecret");
for(const secret of ['secretJWT','gameSecret','renewal','commSecret'])assert(!redacted.includes(secret),secret);
assert.equal(launchFailure('').kind,'unknown');assert(launchDiagnostics('a'.repeat(9000)).length<=8000);
console.log('PASS: '+cases.length+' native launch error categories, correct recovery destinations, IPC cleanup and credential redaction');
