import { useId, useState } from 'react';

// Potongan tampilan rekomendasi (R2): persentase kecocokan, keahlian cocok vs bisa dipelajari,
// "Mengapa cocok?", dan label bahwa keputusan tetap di tangan manusia.

/** "87% COCOK" — hijau ≥ 70, kuning ≥ 40, abu-abu di bawahnya. */
export function MatchBadge({ score, className = '' }) {
  const tone = score >= 70 ? 'bg-[#c9ecd9] text-[#12283c]' : score >= 40 ? 'bg-[#fde68a] text-[#12283c]' : 'bg-[#12283c]/10 text-[#12283c]';
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 font-mono text-[10px] font-black tracking-wider whitespace-nowrap ${tone} ${className}`}>
      {score}% COCOK
    </span>
  );
}

/** Keahlian yang cocok (hijau) dan yang belum dimiliki (abu-abu, "bisa dipelajari"). */
export function SkillMatchChips({ matched = [], missing = [], limit = 6 }) {
  const shown = [...matched.map((s) => ({ s, ok: true })), ...missing.map((s) => ({ s, ok: false }))].slice(0, limit);
  if (shown.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Keahlian">
      {shown.map(({ s, ok }) => (
        <li
          key={`${ok}-${s}`}
          title={ok ? 'Keahlian Anda cocok' : 'Belum dimiliki — bisa dipelajari'}
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${ok ? 'bg-[#c9ecd9] text-[#12283c]' : 'border border-dashed border-[#12283c]/30 text-[#12283c]/55'}`}
        >
          {ok ? '✓ ' : ''}{s}{ok ? '' : ' · bisa dipelajari'}
        </li>
      ))}
    </ul>
  );
}

/** Tombol "Mengapa cocok?" yang membuka alasan skor dan keahlian yang cocok. */
export function WhyMatch({ reasons = [], matched = [], confidence }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        className="min-h-[44px] font-mono text-[10px] font-bold text-[#e62b2b] underline underline-offset-2"
      >
        {open ? 'TUTUP ALASAN ▴' : 'MENGAPA COCOK? ▾'}
      </button>
      {open && (
        <div id={id} className="mt-1 rounded-lg bg-[#12283c]/5 p-3 text-xs leading-relaxed">
          {reasons.length > 0
            ? <ul className="list-disc pl-4 space-y-1">{reasons.map((r) => <li key={r}>{r}</li>)}</ul>
            : <p>Belum ada alasan kuat selain kecocokan umum.</p>}
          {matched.length > 0 && <p className="mt-2"><strong>Keahlian cocok:</strong> {matched.join(', ')}</p>}
          {confidence === 'low' && (
            <p className="mt-2 opacity-70">Keyakinan rendah: kebutuhan ini belum mencantumkan keahlian, jadi dicocokkan dari kata di deskripsinya.</p>
          )}
        </div>
      )}
    </div>
  );
}

/** Label yang selalu tampil di setiap daftar rekomendasi. */
export function RecommendationNote({ dark = false }) {
  return (
    <p className={`font-mono text-[10px] font-bold tracking-wider ${dark ? 'text-[#f2efe6]/70' : 'text-[#12283c]/60'}`}>
      ⓘ REKOMENDASI SISTEM. KEPUTUSAN TETAP DI TANGAN ANDA.
    </p>
  );
}
