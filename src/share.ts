import { download } from './export';

export interface ShareOptions {
  /** File name the receiving app sees. Default from the blob type, e.g. `diagram.gif`. */
  filename?: string;
  title?: string;
  text?: string;
  /** Download the file when the system share sheet isn't available. Default true. */
  fallbackToDownload?: boolean;
}

/** `shared`: handed to the share sheet. `downloaded`: fallback used. `cancelled`: user closed the sheet. `unsupported`: nothing happened. */
export type ShareResult = 'shared' | 'downloaded' | 'cancelled' | 'unsupported';

const EXT: Record<string, string> = { 'image/gif': 'gif', 'image/png': 'png', 'image/svg+xml': 'svg' };

function toFile(blob: Blob, filename?: string): File {
  const name = filename ?? `diagram.${EXT[blob.type] ?? 'bin'}`;
  return new File([blob], name, { type: blob.type });
}

/**
 * True when this browser can open the system share sheet for this file.
 * Chrome shares GIF and PNG but not SVG.
 */
export function canShareFile(blob: Blob, filename?: string): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [toFile(blob, filename)] });
  } catch {
    return false;
  }
}

/**
 * Open the OS share sheet (WhatsApp, Slack, Teams, Messages, Mail, AirDrop…:
 * whatever the user has installed) with the file attached. Falls back to a download.
 *
 * Call it directly inside a click handler. Browsers only allow sharing for a
 * few seconds after a click, so create the GIF first and share it on a second click.
 */
export async function shareFile(blob: Blob, options: ShareOptions = {}): Promise<ShareResult> {
  const file = toFile(blob, options.filename);
  const fallback = (): ShareResult => {
    if (options.fallbackToDownload === false) return 'unsupported';
    download(blob, file.name);
    return 'downloaded';
  };

  if (!canShareFile(blob, file.name)) return fallback();
  try {
    await navigator.share({ files: [file], title: options.title, text: options.text });
    return 'shared';
  } catch (e) {
    const name = e instanceof Error ? e.name : '';
    if (name === 'AbortError') return 'cancelled';
    // NotAllowedError: the click was too long ago, or a permissions policy blocks sharing (e.g. some iframes).
    return fallback();
  }
}
