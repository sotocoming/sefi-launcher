const {chromium}=require('C:/Users/Creep/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
let source='**Встречаем осень** и *новые приключения*. [Правила сервера](https://example.org/rules)\n\n- Новые места\n- Уютные встречи\n\n1. Обновите клиент\n2. Заходите в игру\n\n> Приходите с друзьями!\n\n```js\nconsole.log("<img>");\n```\n\n<img src=x onerror="window.pwned=true">\n<script>window.pwned=true</script>\n[опасная](javascript:alert(1))';
source += '\n\nСайт (https://mc.sotocoming.ru/) и Discord (https://discord.gg/AZKGFPzpsa). Поддержка (https://dalink.to/sefirota) ~\n\n<https://example.org/angle>\n\n`https://example.org/code`\n\nftp://example.org/file user@example.org [плохая](https://user:password@example.org)';
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1180,height:900}}),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});
 await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.hostname!=='sefi.test')return route.abort();const file=path.join(__dirname,'../dist',url.pathname==='/'?'index.html':url.pathname);if(!fs.existsSync(file))return route.fulfill({status:404,body:''});await route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html'});});
 await page.addInitScript(source=>{
  window.opened=[];window.electronAPI=new Proxy({getAccounts:async()=>[],getSettings:async()=>({ramMax:4096}),getServerStatus:async()=>({online:false,players:0,maxPlayers:20}),getModpackStatus:async()=>({installed:false}),getLauncherConfig:async()=>({server:{title:'Sweet Home',name:'Sweet Home'},modpack:{name:'Sweet Home'},news:[{id:'md',title:'Осеннее обновление',body:'Текст для старого лаунчера',body_markdown:source,date:'2026-10-08',tag:'update',status:'published',likes:0,dislikes:0},{id:'legacy',title:'Старая запись',body:'Обычный текст без нового поля',date:'2026-10-07',status:'published'}]}),openExternal:async url=>window.opened.push(url)},{get:(o,k)=>k in o?o[k]:()=>()=>{}});
 },source);
 await page.goto('http://sefi.test/');await page.locator('aside').getByRole('button',{name:/Новости/}).click();await page.locator('.launcher-markdown strong').waitFor();
 const body=page.locator('.launcher-markdown').first();assert(await body.evaluate(el=>el.classList.contains('is-collapsed')));
 await page.getByRole('button',{name:'Читать полностью',exact:true}).first().click();assert.equal(await body.evaluate(el=>el.classList.contains('is-collapsed')),false);
 assert.equal(await body.locator('strong').textContent(),'Встречаем осень');assert.equal(await body.locator('em').textContent(),'новые приключения');assert.equal(await body.locator('ul li').count(),2);assert.equal(await body.locator('ol li').count(),2);assert.equal(await body.locator('blockquote').count(),1);assert.equal(await body.locator('pre code').textContent(),'console.log("<img>");\n');assert.equal(await body.locator('img,script').count(),0);assert.equal(await body.locator('a').count(),5);
 assert.equal(await body.locator('code a').count(),0);
 for (const href of ['https://mc.sotocoming.ru/','https://discord.gg/AZKGFPzpsa','https://dalink.to/sefirota','https://example.org/angle']) {
  const link=body.locator('a').filter({hasText:href});assert.equal(await link.getAttribute('href'),href);await link.click();
 }
 assert.deepEqual(await page.evaluate(()=>window.opened),['https://mc.sotocoming.ru/','https://discord.gg/AZKGFPzpsa','https://dalink.to/sefirota','https://example.org/angle']);
 await page.evaluate(()=>window.opened=[]);
 await body.getByRole('link',{name:'Правила сервера'}).click();assert.deepEqual(await page.evaluate(()=>window.opened),['https://example.org/rules']);assert.equal(page.url(),'http://sefi.test/');assert.equal(await page.evaluate(()=>window.pwned),undefined);
 assert(await page.getByText('Обычный текст без нового поля',{exact:true}).isVisible());assert.deepEqual(errors,[]);
 await page.screenshot({path:path.join(__dirname,'../design/news-markdown.png'),fullPage:true});
 await page.getByRole('button',{name:'Свернуть',exact:true}).first().click();assert(await body.evaluate(el=>el.classList.contains('is-collapsed')));
 console.log('Launcher built UI: Markdown source, legacy fallback, expand/collapse, lists/quotes/code, explicit and plain URL links, parentheses, code exclusion, no HTML execution PASS');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
