// Generate offline NSIS notices from the reviewed Markdown policies.
// RTF preserves paragraphs/headings and wraps text to the native installer window.
const fs = require('node:fs');
const path = require('node:path');

function inline(text) {
  return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    (_match, label, target) => /^https?:/.test(target) ? label + ' (' + target + ')' : label);
}
function escapeRtf(text) {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], code = text.charCodeAt(i);
    if (ch === '\\' || ch === '{' || ch === '}') result += '\\' + ch;
    else if (code > 127) result += '\\u' + (code > 32767 ? code - 65536 : code) + '?';
    else result += ch;
  }
  return result;
}
function notice(markdown, language) {
  const labels = language === 'ru' ? ['Данные и получатели', 'Когда'] : ['Data and recipients', 'When'];
  const output = [];
  let pending = [], tableHeader = false;
  const paragraph = (text, style = '') => output.push('\\pard\\plain\\li0\\fi0\\sa100\\sl240\\slmult1\\cf1\\f0\\fs18 ' + style + escapeRtf(inline(text)) + '\\par');
  const flush = () => { if (pending.length) paragraph(pending.join(' ')); pending = []; };
  for (const raw of markdown.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    if (/^\[(Русская версия|English version)\]\(PRIVACY(?:\.ru)?\.md\)\.$/.test(line)) continue;
    if (!line) { flush(); tableHeader = false; continue; }
    if (line.startsWith('|')) {
      flush();
      const cells = line.split('|').slice(1, -1).map(cell => cell.trim());
      if (!tableHeader) { tableHeader = true; continue; }
      if (cells.every(cell => /^:?-+:?$/.test(cell))) continue;
      if (cells.length !== 3) throw new Error('Expected three privacy table columns');
      paragraph(cells[0], '\\b ');
      paragraph(labels[0] + ': ' + cells[1]);
      paragraph(labels[1] + ': ' + cells[2]);
      continue;
    }
    tableHeader = false;
    if (/^#{1,6} /.test(line)) {
      flush(); paragraph(line.replace(/^#{1,6} /, ''), line.startsWith('# ') ? '\\b\\fs22 ' : '\\b\\fs20 ');
    } else if (line.startsWith('- ')) {
      flush(); paragraph('• ' + line.slice(2));
    } else pending.push(line);
  }
  flush();
  if (!output.length) throw new Error('Privacy document is empty');
  return '{\\rtf1\\ansi\\ansicpg1251\\deff0\\uc1{\\fonttbl{\\f0 Segoe UI;}}{\\colortbl;\\red28\\green28\\blue32;}' + output.join('\n') + '}\n';
}
function prepare(projectDir, check = false) {
  for (const [language, source] of [['en', 'PRIVACY.md'], ['ru', 'PRIVACY.ru.md']]) {
    const content = notice(fs.readFileSync(path.join(projectDir, source), 'utf8'), language);
    const target = path.join(projectDir, 'build', 'license_' + language + '.rtf');
    if (check) {
      // electron-builder can add a UTF-8 BOM when loading localized files.
      if (fs.readFileSync(target, 'utf8').replace(/^\ufeff/, '') !== content) throw new Error('Stale installer notice: ' + target);
    } else {
      fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, content);
    }
  }
}
module.exports = async context => prepare(context.packager.projectDir);
module.exports.prepare = prepare;
module.exports.notice = notice;
if (require.main === module) prepare(path.resolve(__dirname, '..'), process.argv.includes('--check'));
