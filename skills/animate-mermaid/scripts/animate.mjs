#!/usr/bin/env node
// animate-mermaid CLI: turn Mermaid source into animated SVG / GIF / PNG files.
// Runs the real library in headless Chrome (puppeteer), fully offline after `npm install`.
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join, normalize, resolve, sep } from 'node:path';

const HELP = `Usage: node animate.mjs <input.mmd | -> -o <out.svg|out.gif|out.png> [-o ...] [options]

Output format comes from the file extension:
  .svg  animated SVG (plays on its own: browsers, GitHub README <img>, docs)
  .gif  animated GIF (Slack, Teams, WhatsApp, slides, email)
  .png  still image (default: finished diagram)

Animation:
  --order <flow|position|together>   reveal order (default flow)
  --node-effect <pop|fade|slide|none>
  --edge-effect <draw|fade|none>
  --node-duration <ms>               default 450
  --edge-duration <ms>               default 500
  --stagger <ms>                     default 120 (position order)
  --loop                             replay forever (SVG loops, GIF cycle includes hold + fade)
  --loop-hold <ms>                   default 1500
  --edge-motion <dash|dot|none>      keep edges moving after they appear (default none)
  --edge-motion-duration <ms>        one motion cycle (default 1000 dash, 2000 dot)
  --edge-motion-color <color>        default: theme accent, else the edge color

Rendering:
  --theme <name>                     palette: zinc-light, zinc-dark, tokyo-night, tokyo-night-storm,
                                     tokyo-night-light, catppuccin-mocha, catppuccin-latte, nord,
                                     nord-light, dracula, github-light, github-dark, solarized-light,
                                     solarized-dark, one-dark; or a Mermaid theme: default, dark,
                                     forest, neutral, base
  --background <color|transparent>   default white for GIF/PNG, none for SVG
  --scale <n>                        GIF default 1, PNG default 2
  --fps <n>                          GIF frames per second (default 20)
  --max-width <px>                   GIF width cap (default 1200)
  --hold-end <ms>                    GIF pause on final frame (default 1500)
  --frame <end|ms>                   PNG frame (default end)
  --config <file.json>               extra mermaid.initialize() config

  -h, --help`;

// ---------- args
function parseArgs(argv) {
  const opts = { outputs: [], input: undefined };
  const num = (v, name) => {
    const n = Number(v);
    if (!Number.isFinite(n)) fail(`${name} expects a number, got "${v}"`);
    return n;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) fail(`${a} needs a value`);
      return argv[++i];
    };
    switch (a) {
      case '-h': case '--help': console.log(HELP); process.exit(0);
      case '-o': case '--out': opts.outputs.push(next()); break;
      case '--order': opts.order = next(); break;
      case '--node-effect': opts.nodeEffect = next(); break;
      case '--edge-effect': opts.edgeEffect = next(); break;
      case '--node-duration': opts.nodeDuration = num(next(), a); break;
      case '--edge-duration': opts.edgeDuration = num(next(), a); break;
      case '--stagger': opts.stagger = num(next(), a); break;
      case '--loop': opts.loop = true; break;
      case '--loop-hold': opts.loopHold = num(next(), a); break;
      case '--edge-motion': opts.edgeMotion = next(); break;
      case '--edge-motion-duration': opts.edgeMotionDuration = num(next(), a); break;
      case '--edge-motion-color': opts.edgeMotionColor = next(); break;
      case '--theme': opts.theme = next(); break;
      case '--background': opts.background = next(); break;
      case '--scale': opts.scale = num(next(), a); break;
      case '--fps': opts.fps = num(next(), a); break;
      case '--max-width': opts.maxWidth = num(next(), a); break;
      case '--hold-end': opts.holdEnd = num(next(), a); break;
      case '--frame': { const v = next(); opts.frame = v === 'end' ? 'end' : num(v, a); break; }
      case '--config': opts.config = next(); break;
      default:
        if (a.startsWith('-') && a !== '-') fail(`unknown option ${a}\n\n${HELP}`);
        if (opts.input !== undefined) fail(`unexpected argument ${a}`);
        opts.input = a;
    }
  }
  if (opts.input === undefined) fail(`missing input file\n\n${HELP}`);
  if (!opts.outputs.length) fail('missing -o <output file>');
  for (const o of opts.outputs) {
    if (!['.svg', '.gif', '.png'].includes(extname(o).toLowerCase())) fail(`unsupported output "${o}" (use .svg, .gif or .png)`);
  }
  return opts;
}

class CliError extends Error {}

function fail(msg) {
  console.error(`animate-mermaid: ${msg}`);
  process.exit(1);
}

async function readInput(input) {
  if (input !== '-') return readFile(input, 'utf8');
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

// ---------- local static server for the browser bundles
const require = createRequire(import.meta.url);

function pkgDir(name) {
  let entry;
  try {
    entry = require.resolve(name);
  } catch {
    fail(`cannot find "${name}". Run \`npm install\` in ${new URL('.', import.meta.url).pathname}`);
  }
  const marker = `${sep}node_modules${sep}${name}${sep}`;
  const at = entry.lastIndexOf(marker);
  return entry.slice(0, at + marker.length - 1);
}

const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.map': 'application/json' };

function startServer() {
  const roots = {
    mermaid: pkgDir('mermaid'),
    gifenc: pkgDir('gifenc'),
    'animate-mermaid': pkgDir('animate-mermaid'),
  };
  const page = `<!doctype html><html><head><meta charset="utf-8">
<script type="importmap">${JSON.stringify({
    imports: {
      mermaid: '/pkg/mermaid/dist/mermaid.esm.min.mjs',
      gifenc: '/pkg/gifenc/dist/gifenc.esm.js',
      'animate-mermaid': '/pkg/animate-mermaid/dist/index.js',
    },
  })}</script>
<style>body{margin:0;background:#fff}#stage{display:inline-block;padding:0}</style>
</head><body><div id="stage"></div>
<script type="module">
  window.am = await import('animate-mermaid');
  window.mermaidLib = (await import('mermaid')).default;
  window.ready = true;
</script></body></html>`;

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html' }).end(page);
      return;
    }
    const m = /^\/pkg\/(mermaid|gifenc|animate-mermaid)\/(.*)$/.exec(url.pathname);
    if (!m) { res.writeHead(404).end(); return; }
    const root = roots[m[1]];
    const file = normalize(join(root, decodeURIComponent(m[2])));
    if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

// ---------- main
const opts = parseArgs(process.argv.slice(2));
const source = (await readInput(opts.input)).trim();
if (!source) fail('input is empty');

let mermaidConfig = { startOnLoad: false };
const MERMAID_THEMES = ['default', 'dark', 'forest', 'neutral', 'base'];
// Mermaid's own themes go to mermaid; anything else is an animate-mermaid palette.
if (opts.theme && MERMAID_THEMES.includes(opts.theme)) mermaidConfig.theme = opts.theme;
const palette = opts.theme && !MERMAID_THEMES.includes(opts.theme) ? opts.theme : undefined;
if (opts.config) mermaidConfig = { ...mermaidConfig, ...JSON.parse(await readFile(opts.config, 'utf8')) };

let puppeteer;
try {
  puppeteer = (await import('puppeteer')).default;
} catch {
  fail(`cannot find "puppeteer". Run \`npm install\` in ${new URL('.', import.meta.url).pathname}`);
}

const server = await startServer();
const { port } = server.address();
let browser;
try {
  browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
} catch (e) {
  server.close();
  fail(`could not start headless Chrome (${e.message.split('\n')[0]}).\nInstall it with: npx puppeteer browsers install chrome   (run in ${new URL('.', import.meta.url).pathname})`);
}
let exitCode = 0;

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1200, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForFunction('window.ready === true', { timeout: 30000 });

  const anim = {
    order: opts.order, nodeEffect: opts.nodeEffect, edgeEffect: opts.edgeEffect,
    nodeDuration: opts.nodeDuration, edgeDuration: opts.edgeDuration, stagger: opts.stagger,
    loop: opts.loop, loopHold: opts.loopHold, autoplay: false, respectReducedMotion: false,
    edgeMotion: opts.edgeMotion, edgeMotionDuration: opts.edgeMotionDuration, edgeMotionColor: opts.edgeMotionColor,
    theme: palette,
  };
  const info = await page.evaluate(async (src, anim, cfg) => {
    const { renderAnimated } = window.am;
    try {
      window.ctrl = await renderAnimated(document.getElementById('stage'), src, { ...anim, mermaid: window.mermaidLib, mermaidConfig: cfg });
    } catch (e) {
      return { error: String(e && e.message ? e.message : e) };
    }
    return { duration: window.ctrl.duration, period: window.ctrl.period };
  }, source, anim, mermaidConfig);
  if (info.error) throw new CliError(`Mermaid could not render the diagram:\n${info.error}`);

  for (const out of opts.outputs) {
    const ext = extname(out).toLowerCase();
    const outPath = resolve(out);
    let bytes;
    let note = '';
    if (ext === '.svg') {
      const svg = await page.evaluate((bg) => window.am.toSvgString(window.ctrl.svg, { background: bg }), opts.background);
      bytes = Buffer.from(svg, 'utf8');
      note = `${(info.duration / 1000).toFixed(1)} s animation${opts.loop ? ', loops' : ''}`;
    } else {
      const res = await page.evaluate(async (ext, o) => {
        const { toGif, toPng } = window.am;
        let blob;
        let frames = 0;
        if (ext === '.gif') {
          blob = await toGif(window.ctrl, {
            fps: o.fps, scale: o.scale, maxWidth: o.maxWidth, background: o.background, holdEnd: o.holdEnd,
            onProgress: () => frames++,
          });
        } else {
          blob = await toPng(window.ctrl.svg, { frame: o.frame ?? 'end', scale: o.scale ?? 2, background: o.background });
        }
        const buf = new Uint8Array(await blob.arrayBuffer());
        let bin = '';
        for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        return { b64: btoa(bin), frames };
      }, ext, opts);
      bytes = Buffer.from(res.b64, 'base64');
      note = ext === '.gif' ? `${res.frames} frames, ${(info.duration / 1000).toFixed(1)} s animation` : `frame ${opts.frame ?? 'end'}`;
    }
    await writeFile(outPath, bytes);
    console.log(`wrote ${out} (${note}, ${(bytes.length / 1024).toFixed(0)} KB)`);
  }
} catch (e) {
  console.error(`animate-mermaid: ${e instanceof CliError ? e.message : e && e.stack ? e.stack : e}`);
  exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
process.exit(exitCode);
