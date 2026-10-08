const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),asar=require('@electron/asar');
const root=path.resolve(__dirname,'..'),archive=path.join(root,'release/win-unpacked/resources/app.asar');
const pkg=JSON.parse(asar.extractFile(archive,'package.json').toString());assert.equal(pkg.version,'1.0.11');assert.equal(pkg.dependencies['markdown-it'],'14.3.2');
const index=fs.readFileSync(path.join(root,'dist/index.html'),'utf8');const asset=index.match(/src="\.\/(assets\/[^\"]+\.js)"/)[1];const built=fs.readFileSync(path.join(root,'dist',asset));
assert.deepEqual(asar.extractFile(archive,path.join('dist',asset)),built);assert(built.includes(Buffer.from('launcher-markdown')));assert(built.includes(Buffer.from('body_markdown')));
assert(fs.statSync(path.join(root,'release/SEFI-Launcher-Setup.exe')).size>1000000);
console.log('Packaged 1.0.11: version, fixed Markdown dependency, renderer identical to browser-tested build, installer exists PASS');
