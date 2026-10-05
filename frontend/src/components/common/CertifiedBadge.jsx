import { BadgeCheck } from 'lucide-react';

/** Badge "Tersertifikasi SUSI" (U5): profil, kartu pelamar, kartu rekomendasi. */
export default function CertifiedBadge({ dark = false, className = '' }) {
  return (
    <span
      title="Talenta ini lolos sertifikasi SUSI: proyek selesai yang diverifikasi komunitas dan ditinjau tim SUSI"
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[9px] font-black whitespace-nowrap ${dark ? 'border-[#c9ecd9] text-[#c9ecd9]' : 'border-[#0f766e] text-[#0f766e]'} ${className}`}
    >
      <BadgeCheck className="w-3 h-3" aria-hidden="true" /> TERSERTIFIKASI SUSI
    </span>
  );
}
