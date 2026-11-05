import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
const root = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const web = path.join(root, 'solana-desk/web');
const read = name => readFile(path.join(web, name), 'utf8');
let html = await read('index.html');
const csp = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src https://api.dexscreener.com; object-src 'none'; base-uri 'none'; form-action 'none'";
html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, `<meta http-equiv="Content-Security-Policy" content="${csp}">`);
html = html.replace(/\s*<link[^>]+(?:manifest|apple-touch-icon|rel="icon")[^>]*>/g, '');
html = html.replace('<link rel="stylesheet" href="./styles.css">', `<style>${await read('tokens.css')}${(await read('styles.css')).replace("@import url('./tokens.css');", '')}</style>`);
html = html.replace('  <script type="module" src="./app.js"></script>', '');
const icon = `data:image/svg+xml;base64,${Buffer.from(await read('icon.svg')).toString('base64')}`;
html = html.replaceAll('src="./icon.svg"', `src="${icon}"`);
const parts = [];
for (const name of ['engine.js', 'market.js', 'app.js']) {
  let js = await read(name);
  if (name === 'app.js') {
    js = js.replace(/^import .*?;\n/gms, '');
    js = js.slice(0, js.indexOf("if ('serviceWorker' in navigator"));
  }
  js = js.replace(/^export /gm, ''); parts.push(js);
}
const bundle = parts.join('\n');
new vm.Script(bundle); // Assert bundle syntax before making a user-facing file.
html = html.replace('</body>', `<script>\n${bundle.replaceAll('</script', '<\\/script')}\n</script>\n</body>`);
const destination = path.join(root, 'BUKA_DEMO.html');
await writeFile(destination, html);
console.log(`Standalone app written: ${destination}`);
