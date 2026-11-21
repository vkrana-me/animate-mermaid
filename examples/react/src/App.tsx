import { useRef, useState } from 'react';
import { AnimatedMermaid, useAnimatedMermaid, type AnimationController } from 'animate-mermaid/react';
import { toSvgString, toPng, toGif, shareFile, canShareFile, download, type NodeEffect, type Order } from 'animate-mermaid';
import { diagrams } from '../../shared/diagrams';

export function App() {
  const [name, setName] = useState('Flowchart');
  const [order, setOrder] = useState<Order>('flow');
  const [nodeEffect, setNodeEffect] = useState<NodeEffect>('pop');
  const [loop, setLoop] = useState(false);
  const ctrl = useRef<AnimationController | null>(null);
  const [gifProgress, setGifProgress] = useState<number | null>(null);
  const [gif, setGif] = useState<{ blob: Blob; url: string } | null>(null);
  const [shareMsg, setShareMsg] = useState('');

  // Step 1: build the GIF (takes a few seconds).
  async function makeGif() {
    if (!ctrl.current) return;
    setGifProgress(0);
    setShareMsg('');
    try {
      const blob = await toGif(ctrl.current, { fps: 20, onProgress: setGifProgress });
      setGif((old) => {
        if (old) URL.revokeObjectURL(old.url);
        return { blob, url: URL.createObjectURL(blob) };
      });
    } finally {
      setGifProgress(null);
    }
  }

  // Step 2: share on a fresh click (browsers require a recent user gesture).
  async function shareGif() {
    if (!gif) return;
    const result = await shareFile(gif.blob, { filename: 'diagram.gif', title: 'Diagram' });
    setShareMsg(result === 'downloaded' ? 'Sharing not supported here, so the GIF was downloaded. Drag it into Slack, Teams or WhatsApp.' : '');
  }

  return (
    <div className="app">
      <h1>animate-mermaid · React</h1>

      <h2>Component</h2>
      <div className="controls">
        <select value={name} onChange={(e) => setName(e.target.value)}>
          {Object.keys(diagrams).map((d) => <option key={d}>{d}</option>)}
        </select>
        <label>Order
          <select value={order} onChange={(e) => setOrder(e.target.value as Order)}>
            <option>flow</option><option>position</option><option>together</option>
          </select>
        </label>
        <label>Node effect
          <select value={nodeEffect} onChange={(e) => setNodeEffect(e.target.value as NodeEffect)}>
            <option>pop</option><option>fade</option><option>slide</option>
          </select>
        </label>
        <label><input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} /> Loop</label>
      </div>

      <AnimatedMermaid
        ref={ctrl}
        className="card"
        chart={diagrams[name]}
        order={order}
        nodeEffect={nodeEffect}
        loop={loop}
        onError={(e) => console.error(e)}
      />

      <div className="controls">
        <button onClick={() => ctrl.current?.play()}>Play</button>
        <button onClick={() => ctrl.current?.pause()}>Pause</button>
        <button onClick={() => ctrl.current?.restart()}>Restart</button>
        <button onClick={() => ctrl.current && download(toSvgString(ctrl.current.svg), 'diagram.svg')}>
          Download animated SVG
        </button>
        <button onClick={async () => ctrl.current && download(await toPng(ctrl.current.svg), 'diagram.png')}>
          Download PNG
        </button>
        <button onClick={makeGif} disabled={gifProgress !== null}>
          {gifProgress === null ? 'Make GIF' : `Making GIF ${Math.round(gifProgress * 100)}%`}
        </button>
      </div>

      {gif && (
        <div className="gif-panel">
          <img src={gif.url} alt="Animated diagram preview" />
          <div className="actions">
            <button className="primary" onClick={shareGif}>
              {canShareFile(gif.blob, 'diagram.gif') ? 'Share… (WhatsApp, Slack, Teams)' : 'Share (downloads file)'}
            </button>
            <button onClick={() => download(gif.blob, 'diagram.gif')}>Download GIF</button>
            <span className="meta">{(gif.blob.size / 1024).toFixed(0)} KB</span>
            {shareMsg && <span className="meta">{shareMsg}</span>}
          </div>
        </div>
      )}

      <h2>Hook, plays when scrolled into view</h2>
      <HookExample />
    </div>
  );
}

function HookExample() {
  const { ref, controller, error } = useAnimatedMermaid(diagrams['Sequence'], { autoplay: 'visible' });
  return (
    <>
      <div ref={ref} className="card" />
      {error && <p className="error">{error.message}</p>}
      <p>Duration: {controller ? `${controller.duration} ms` : 'rendering…'}</p>
    </>
  );
}
