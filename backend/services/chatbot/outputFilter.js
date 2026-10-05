// Filter keluaran LLM (T12.4):
//  - tautan di luar allowlist (domain SUSI dan wa.me) dihapus, termasuk domain tanpa "http";
//  - penanda kebocoran prompt sistem (kanari, kalimat khas, tag pembungkus) memblokir jawaban.
// Versi streaming menahan ekor teks agar penanda/tautan terdeteksi sebelum sempat terkirim.

export const URL_REMOVED = '[tautan dihapus]';

const TLDS = 'com|net|org|id|co|io|me|app|dev|xyz|info|biz|ly|gg|site|online|store|tech|ai|link|click|top|shop|live';
// Skema/www, atau domain telanjang (contoh.com/x). Tidak cocok di tengah email (didahului "@").
const URL_RE = new RegExp(
  String.raw`(?:https?:\/\/|www\.)[^\s<>"'\x60]+|(?<![@\p{L}\p{N}._-])(?:[\p{L}\p{N}-]+\.)+(?:${TLDS})\b(?:\/[^\s<>"'\x60]*)?`,
  'giu',
);
const MD_LINK_RE = /\[([^\]\n]{1,200})\]\(([^)\s]+)\)/g;
const TRAILING_PUNCT_RE = /[.,!?;:)\]]+$/;

/** Hostname dari URL (dengan/tanpa skema), atau null. */
export function hostOf(raw) {
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withScheme).hostname.toLowerCase();
  } catch {
    return null;
  }
}

const squash = (text) => String(text ?? '').toLowerCase().replace(/\s+/g, ' ');

/**
 * @param {{ allowedHosts: string[], leakMarkers: string[] }} options
 *   allowedHosts: host yang boleh muncul (subdomainnya juga boleh); leakMarkers: potongan teks prompt.
 */
export function createOutputFilter({ allowedHosts = [], leakMarkers = [] }) {
  const hosts = allowedHosts.map((h) => String(h).toLowerCase()).filter(Boolean);
  const markers = leakMarkers.map(squash).filter(Boolean);

  const isAllowedUrl = (raw) => {
    const host = hostOf(raw);
    return Boolean(host) && hosts.some((h) => host === h || host.endsWith(`.${h}`));
  };

  /** Hapus tautan yang tidak diizinkan. Tautan markdown terlarang disisakan labelnya. */
  const filterText = (text) => {
    let removed = 0;
    const withoutLinks = String(text ?? '').replace(MD_LINK_RE, (match, label, url) => {
      if (isAllowedUrl(url)) return match;
      removed += 1;
      return label;
    });
    const out = withoutLinks.replace(URL_RE, (match) => {
      const url = match.replace(TRAILING_PUNCT_RE, '');
      if (isAllowedUrl(url)) return match;
      removed += 1;
      return `${URL_REMOVED}${match.slice(url.length)}`;
    });
    return { text: out, removed };
  };

  const detectLeak = (text) => {
    const lower = squash(text);
    return markers.some((m) => lower.includes(m));
  };

  return { isAllowedUrl, filterText, detectLeak, maxMarkerLength: Math.max(0, ...markers.map((m) => m.length)) };
}

const MIN_HOLDBACK = 48;
const MAX_LINK_LABEL = 300;

/**
 * Filter bertahap untuk stream. `push(delta)` mengembalikan teks yang aman dikirim sekarang;
 * ekor sepanjang penanda terpanjang ditahan dan pemotongan hanya di spasi, sehingga tautan &
 * penanda selalu diperiksa utuh. Begitu penanda kebocoran terlihat, `blocked` = true dan tidak
 * ada teks lagi yang dilepas.
 */
export function createStreamFilter(filter) {
  const holdback = Math.max(MIN_HOLDBACK, filter.maxMarkerLength);
  let pending = '';
  let seen = '';
  let blocked = false;

  return {
    push(delta) {
      if (blocked) return { emit: '', blocked };
      seen += delta;
      pending += delta;
      if (filter.detectLeak(seen)) {
        blocked = true;
        pending = '';
        return { emit: '', blocked };
      }
      const limit = pending.length - holdback;
      if (limit <= 0) return { emit: '', blocked };
      let cut = -1;
      for (let i = limit; i >= 0; i -= 1) {
        if (/\s/.test(pending[i])) {
          cut = i;
          break;
        }
      }
      if (cut < 0) return { emit: '', blocked };
      let ready = pending.slice(0, cut + 1);
      // Jangan memotong [label](url) yang belum lengkap: labelnya bisa memuat spasi.
      const open = ready.lastIndexOf('[');
      if (open >= 0 && ready.length - open < MAX_LINK_LABEL && !/\]\([^)]*\)/.test(ready.slice(open))) {
        ready = ready.slice(0, open);
      }
      pending = pending.slice(ready.length);
      return { emit: ready ? filter.filterText(ready).text : '', blocked };
    },
    end() {
      if (blocked) return { emit: '', blocked };
      const rest = pending;
      pending = '';
      return { emit: filter.filterText(rest).text, blocked };
    },
  };
}
