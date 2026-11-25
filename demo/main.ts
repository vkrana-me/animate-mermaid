import { renderAnimated, toSvgString, toPng, toGif, download, THEMES, resolveTheme, type AnimationController, type ThemeName } from '../src';

const samples: Record<string, string> = {
  flowchart: `flowchart TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Ship it]
    B -->|No| D[Debug]
    D --> E[Fix bug]
    E --> B
    C --> F((Done))
    subgraph Release
      C
      F
    end`,
  'flowchart LR': `flowchart LR
    client[Client] -->|HTTP| api[API Gateway]
    api --> auth[Auth Service]
    api --> orders[Orders]
    orders --> db[(Postgres)]
    orders -.-> queue[[Queue]]
    queue --> worker[Worker]
    worker --> db`,
  sequence: `sequenceDiagram
    participant U as User
    participant A as App
    participant S as Server
    U->>A: Click login
    A->>S: POST /login
    S-->>A: 200 OK + token
    A-->>U: Show dashboard`,
  state: `stateDiagram-v2
    [*] --> Idle
    Idle --> Loading: fetch
    Loading --> Success: ok
    Loading --> Error: fail
    Error --> Loading: retry
    Success --> [*]`,
  class: `classDiagram
    Animal <|-- Dog
    Animal <|-- Cat
    Animal : +String name
    Animal : +eat()
    Dog : +bark()
    Cat : +meow()`,
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = $('stage');
const src = $<HTMLTextAreaElement>('src');
const sample = $<HTMLSelectElement>('sample');
const seek = $<HTMLInputElement>('seek');
let ctrl: AnimationController | null = null;

for (const name of Object.keys(samples)) sample.add(new Option(name, name));
for (const name of Object.keys(THEMES)) $<HTMLSelectElement>('theme').add(new Option(name, name));
src.value = samples.flowchart;

async function render() {
  $('err').textContent = '';
  try {
    ctrl?.destroy();
    const theme = ($<HTMLSelectElement>('theme').value || undefined) as ThemeName | undefined;
    stage.style.background = theme ? resolveTheme(theme).bg : '';
    ctrl = await renderAnimated(stage, src.value, {
      theme,
      edgeMotion: $<HTMLSelectElement>('edgeMotion').value as never,
      order: $<HTMLSelectElement>('order').value as never,
      nodeEffect: $<HTMLSelectElement>('nodeEffect').value as never,
      edgeEffect: $<HTMLSelectElement>('edgeEffect').value as never,
      nodeDuration: Number($<HTMLInputElement>('nodeDuration').value),
      edgeDuration: Number($<HTMLInputElement>('edgeDuration').value),
      loop: $<HTMLInputElement>('loop').checked,
    });
    (window as unknown as { ctrl: AnimationController }).ctrl = ctrl;
  } catch (e) {
    $('err').textContent = String(e);
  }
}

sample.onchange = () => { src.value = samples[sample.value]; render(); };
let t: number | undefined;
src.oninput = () => { clearTimeout(t); t = window.setTimeout(render, 400); };
for (const id of ['theme', 'edgeMotion', 'order', 'nodeEffect', 'edgeEffect', 'nodeDuration', 'edgeDuration', 'loop']) $(id).onchange = render;
$('play').onclick = () => ctrl?.play();
$('pause').onclick = () => ctrl?.pause();
$('restart').onclick = () => ctrl?.restart();
seek.oninput = () => { if (ctrl) { ctrl.pause(); ctrl.seek((Number(seek.value) / 1000) * ctrl.period); } };
$('svg').onclick = () => ctrl && download(toSvgString(ctrl.svg), 'diagram.svg');
$('png').onclick = async () => ctrl && download(await toPng(ctrl.svg), 'diagram.png');

$('gif').onclick = async () => {
  if (!ctrl) return;
  const btn = $<HTMLButtonElement>('gif');
  btn.disabled = true;
  try {
    download(await toGif(ctrl, { onProgress: (p) => (btn.textContent = `GIF ${Math.round(p * 100)}%`) }), 'diagram.gif');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Export GIF';
  }
};

render();
