<script lang="ts">
  import { animatedMermaid, type AnimationController } from 'animate-mermaid/svelte';
  import { toSvgString, toPng, toGif, shareFile, canShareFile, download, type NodeEffect, type Order } from 'animate-mermaid';
  import { diagrams } from '../../shared/diagrams';

  let name = $state('Flowchart');
  let order = $state<Order>('flow');
  let nodeEffect = $state<NodeEffect>('pop');
  let loop = $state(false);
  let error = $state('');
  let ctrl: AnimationController | undefined;

  let gifProgress = $state<number | null>(null);
  let gif = $state<{ blob: Blob; url: string } | null>(null);
  let shareMsg = $state('');

  // Step 1: build the GIF (takes a few seconds).
  async function makeGif() {
    if (!ctrl) return;
    gifProgress = 0;
    shareMsg = '';
    try {
      const blob = await toGif(ctrl, { fps: 20, onProgress: (p) => (gifProgress = p) });
      if (gif) URL.revokeObjectURL(gif.url);
      gif = { blob, url: URL.createObjectURL(blob) };
    } finally {
      gifProgress = null;
    }
  }

  // Step 2: share on a fresh click (browsers require a recent user gesture).
  async function shareGif() {
    if (!gif) return;
    const result = await shareFile(gif.blob, { filename: 'diagram.gif', title: 'Diagram' });
    shareMsg = result === 'downloaded' ? 'Sharing not supported here, so the GIF was downloaded. Drag it into Slack, Teams or WhatsApp.' : '';
  }

  async function savePng() {
    if (ctrl) download(await toPng(ctrl.svg), 'diagram.png');
  }
</script>

<div class="app">
  <h1>animate-mermaid · Svelte</h1>

  <div class="controls">
    <select bind:value={name}>
      {#each Object.keys(diagrams) as d}<option>{d}</option>{/each}
    </select>
    <label>Order
      <select bind:value={order}>
        <option>flow</option><option>position</option><option>together</option>
      </select>
    </label>
    <label>Node effect
      <select bind:value={nodeEffect}>
        <option>pop</option><option>fade</option><option>slide</option>
      </select>
    </label>
    <label><input type="checkbox" bind:checked={loop} /> Loop</label>
  </div>

  <!-- The action re-renders whenever its parameter object changes. -->
  <div
    class="card"
    use:animatedMermaid={{
      chart: diagrams[name],
      order,
      nodeEffect,
      loop,
      onReady: (c) => { ctrl = c; error = ''; },
      onError: (e) => (error = e.message),
    }}
  ></div>
  {#if error}<p class="error">{error}</p>{/if}

  <div class="controls">
    <button onclick={() => ctrl?.play()}>Play</button>
    <button onclick={() => ctrl?.pause()}>Pause</button>
    <button onclick={() => ctrl?.restart()}>Restart</button>
    <button onclick={() => ctrl && download(toSvgString(ctrl.svg), 'diagram.svg')}>Download animated SVG</button>
    <button onclick={savePng}>Download PNG</button>
    <button onclick={makeGif} disabled={gifProgress !== null}>
      {gifProgress === null ? 'Make GIF' : `Making GIF ${Math.round(gifProgress * 100)}%`}
    </button>
  </div>

  {#if gif}
    <div class="gif-panel">
      <img src={gif.url} alt="Animated diagram preview" />
      <div class="actions">
        <button class="primary" onclick={shareGif}>
          {canShareFile(gif.blob, 'diagram.gif') ? 'Share… (WhatsApp, Slack, Teams)' : 'Share (downloads file)'}
        </button>
        <button onclick={() => gif && download(gif.blob, 'diagram.gif')}>Download GIF</button>
        <span class="meta">{(gif.blob.size / 1024).toFixed(0)} KB</span>
        {#if shareMsg}<span class="meta">{shareMsg}</span>{/if}
      </div>
    </div>
  {/if}
</div>
