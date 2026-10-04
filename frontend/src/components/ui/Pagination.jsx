/** Navigasi halaman untuk respons daftar `{ total, page, limit }`. Tidak tampil bila hanya satu halaman. */
export default function Pagination({ page, limit, total, onPage, dark = false }) {
  const pages = Math.max(1, Math.ceil((Number(total) || 0) / (Number(limit) || 1)));
  if (pages <= 1) return null;
  const btn = `chip-mono transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${dark ? 'text-[#f2efe6] hover:border-[#e62b2b]' : 'text-[#12283c] hover:border-[#e62b2b]'}`;
  return (
    <nav aria-label="Halaman" className="flex items-center justify-center gap-3 mt-6">
      <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} className={btn}>← SEBELUMNYA</button>
      <span className="font-mono text-[10px] font-bold">HALAMAN {page} / {pages}</span>
      <button type="button" onClick={() => onPage(page + 1)} disabled={page >= pages} className={btn}>BERIKUTNYA →</button>
    </nav>
  );
}
