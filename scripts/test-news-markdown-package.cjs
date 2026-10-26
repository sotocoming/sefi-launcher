const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),asar=require('@electron/asar');
const root=path.resolve(__dirname,'..'),output=process.argv[2]?path.resolve(process.argv[2]):path.join(root,'release'),archive=path.join(output,'win-unpacked/resources/app.asar');
const pkg=JSON.parse(asar.extractFile(archive,'package.json').toString());assert.equal(pkg.version,JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version);assert.equal(pkg.dependencies['markdown-it'],'14.3.3');
const index=fs.readFileSync(path.join(root,'dist/index.html'),'utf8');const asset=index.match(/src="\.\/(assets\/[^\"]+\.js)"/)[1];const built=fs.readFileSync(path.join(root,'dist',asset));
assert.deepEqual(asar.extractFile(archive,path.join('dist',asset)),built);assert(built.includes(Buffer.from('launcher-markdown')));assert(built.includes(Buffer.from('body_markdown')));
assert(fs.statSync(path.join(output,process.argv[2]?'win-unpacked/SEFI Launcher.exe':'SEFI-Launcher-Setup.exe')).size>1000000);
console.log('Packaged launcher: version, fixed Markdown dependency, renderer identical to browser-tested build, '+(process.argv[2]?'unpacked executable':'installer')+' exists PASS');
