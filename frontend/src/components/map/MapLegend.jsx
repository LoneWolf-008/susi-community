import { MARKER_VARIANTS } from '../../lib/map';

/** Keterangan warna marker. `variants` = kunci MARKER_VARIANTS yang tampil di peta ini. */
export default function MapLegend({ variants, className = '' }) {
  return (
    <ul className={`flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] font-bold ${className}`} aria-label="Keterangan warna peta">
      {variants.map((v) => (
        <li key={v} className="inline-flex items-center gap-1.5">
          <span
            className={`inline-block w-3 h-3 border-2 ${v === 'need' ? 'rotate-45 rounded-[2px] border-white' : 'rounded-full'} ${v === 'own' ? 'border-[#12283c]' : 'border-white'} shadow`}
            style={{ background: MARKER_VARIANTS[v].color }}
            aria-hidden="true"
          />
          {MARKER_VARIANTS[v].label.toUpperCase()}
        </li>
      ))}
    </ul>
  );
}
