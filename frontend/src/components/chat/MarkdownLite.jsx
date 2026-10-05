// Renderer markdown-lite yang aman untuk jawaban Tanya SUSI: paragraf, **tebal**, daftar berbutir
// (•, -, *) dan bernomor, serta tautan http(s). Semua teks dirender lewat React (otomatis di-escape),
// tanpa dangerouslySetInnerHTML. Hanya http/https yang menjadi tautan (bukan javascript:/data:).

const URL_RE = /(https?:\/\/[^\s<>"'`]+[^\s<>"'`.,!?;:)\]])/g;
const BOLD_RE = /(\*\*[^*\n]+\*\*)/g;
const BULLET_RE = /^\s*[•\-*]\s+(.*)$/;
const NUMBER_RE = /^\s*(\d+)[.)]\s+(.*)$/;

function inline(text, keyPrefix, linkClass) {
  return String(text).split(BOLD_RE).flatMap((part, i) => {
    if (/^\*\*[^*\n]+\*\*$/.test(part)) return [<strong key={`${keyPrefix}b${i}`} className="font-bold">{part.slice(2, -2)}</strong>];
    return part.split(URL_RE).map((segment, j) => (j % 2 === 1
      ? <a key={`${keyPrefix}a${i}-${j}`} href={segment} target="_blank" rel="noopener noreferrer" className={linkClass}>{segment}</a>
      : segment));
  });
}

/** Kelompokkan baris menjadi paragraf dan daftar. */
function toBlocks(text) {
  const blocks = [];
  for (const line of String(text ?? '').split('\n')) {
    const bullet = BULLET_RE.exec(line);
    const number = bullet ? null : NUMBER_RE.exec(line);
    if (bullet || number) {
      const type = bullet ? 'ul' : 'ol';
      const item = bullet ? bullet[1] : number[2];
      const last = blocks.at(-1);
      if (last?.type === type) last.items.push(item);
      else blocks.push({ type, items: [item], start: number ? Number(number[1]) : undefined });
    } else if (line.trim()) {
      blocks.push({ type: 'p', text: line.trim() });
    }
  }
  return blocks;
}

export default function MarkdownLite({ text, className = '', linkClass = 'underline underline-offset-2 break-all' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {toBlocks(text).map((block, i) => {
        if (block.type === 'p') return <p key={i} className="leading-relaxed">{inline(block.text, `${i}-`, linkClass)}</p>;
        const List = block.type === 'ul' ? 'ul' : 'ol';
        return (
          <List key={i} start={block.start} className={`${block.type === 'ul' ? 'list-disc' : 'list-decimal'} pl-5 space-y-1 leading-relaxed`}>
            {block.items.map((item, j) => <li key={j}>{inline(item, `${i}-${j}-`, linkClass)}</li>)}
          </List>
        );
      })}
    </div>
  );
}
