// Render the actual demo to shareable SVGs. No live project data is captured.
import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const ansi = ['#202124', '#b42318', '#16713c', '#806000', '#245ac7', '#903db1', '#087e8b', '#eceff4'];
for (const [name, background, foreground] of [
  ['terminal', '#ffffff', '#202124'], ['ocean', '#101c2c', '#e2ecf6'], ['orchid', '#241b30', '#f2e7f8'],
]) {
  const env = {...process.env, FORCE_COLOR: '3'};
  delete env.NO_COLOR;
  const rendered = spawnSync(process.execPath, ['dist/cli.js', '--snapshot', `--theme=${name}`], {
    cwd: root, env, encoding: 'utf8',
  });
  if (rendered.status !== 0) throw new Error(rendered.stderr);
  const elements = [];
  let color = foreground, bold = false, dim = false;
  const lines = rendered.stdout.trimEnd().split('\n');
  for (const [row, line] of lines.entries()) {
    let column = 0;
    for (const token of line.split(/(\x1b\[[0-9;]*m)/)) {
      if (token.startsWith('\x1b[')) {
        const codes = token.slice(2, -1).split(';').map(Number);
        for (let i = 0; i < codes.length; i++) {
          const code = codes[i];
          if (code === 0) {color = foreground; bold = false; dim = false;}
          else if (code === 1) bold = true;
          else if (code === 2) dim = true;
          else if (code === 22) {bold = false; dim = false;}
          else if (code === 39) color = foreground;
          else if (code >= 30 && code <= 37) color = ansi[code - 30];
          else if (code === 90) color = '#68717e';
          else if ((code === 38 || code === 48) && codes[i + 1] === 2) {
            if (code === 38) color = `rgb(${codes.slice(i + 2, i + 5).join(',')})`;
            i += 4;
          }
        }
      } else if (token) {
        const width = Array.from(token).length * 8.4;
        elements.push(`<text x="${20 + column * 8.4}" y="${36 + row * 20}" fill="${color}" font-weight="${bold ? 700 : 400}" opacity="${dim ? 0.7 : 1}" textLength="${width}" lengthAdjust="spacingAndGlyphs">${escape(token)}</text>`);
        column += Array.from(token).length;
      }
    }
  }
  const height = lines.length * 20 + 40;
  writeFileSync(path.join(root, 'previews', `${name}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" width="880" height="${height}" viewBox="0 0 880 ${height}" role="img" aria-label="Relay demo in the ${name} theme"><rect width="880" height="${height}" rx="12" fill="${background}"/><g font-family="Menlo, Consolas, monospace" font-size="14" xml:space="preserve">${elements.join('')}</g></svg>\n`);
}
console.log('Generated three theme previews from the demo renderer.');
