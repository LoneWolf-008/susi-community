import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { api } from '../lib/api';
import { useApi } from '../hooks/useApi';
import Skeleton from '../components/ui/Skeleton';

// Angka nyata dari GET /api/public/stats (tanpa login). Bila API tidak terjangkau,
// angka diganti tanda "—" dengan keterangan, bukan angka karangan.
const STATS = [
  { key: 'projects_completed', label: 'Proyek Selesai' },
  { key: 'talents_total', label: 'Talenta Terdaftar' },
  { key: 'communities_helped', label: 'Komunitas Terbantu' },
];

export default function StatsSection() {
  const rootRef = useRef(null);
  const { data, loading, error, refetch } = useApi((signal) => api.get('/public/stats', { signal }), []);

  // Hitung naik setelah data tiba dan section terlihat.
  useEffect(() => {
    if (!data) return undefined;
    const ctx = gsap.context(() => {
      gsap.utils.toArray('.counter').forEach((el) => {
        const target = Number(el.dataset.target) || 0;
        const obj = { val: 0 };
        gsap.to(obj, {
          val: target, duration: 2.2, ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 85%' },
          onUpdate: () => { el.textContent = Math.round(obj.val); },
        });
      });
    }, rootRef);
    return () => ctx.revert();
  }, [data]);

  return (
    <section ref={rootRef} className="relative bg-[#0e2233] py-20 md:py-28 px-6 lg:px-12">
      <div className="max-w-[1200px] mx-auto">
        <div className="sec-reveal mb-14 flex items-end justify-between flex-wrap gap-6">
          <div>
            <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-[0.95]">Angka yang<br />kami <span className="text-[#e62b2b]">banggakan</span>.</h2>
          </div>
          {error && (
            <button type="button" onClick={refetch} className="font-mono text-[10px] font-bold tracking-[0.25em] text-[#f2efe6]/50 hover:text-[#e62b2b]">
              DATA BELUM TERSEDIA · COBA LAGI ↻
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/10 rounded-2xl overflow-hidden border border-white/10" aria-busy={loading}>
          {STATS.map((s) => (
            <div key={s.key} className="sec-reveal bg-[#0e2233] p-10 md:p-14 text-center hover:bg-[#e62b2b] transition-colors duration-500 group">
              <div className="text-6xl md:text-8xl font-black tabular-nums text-[#f2efe6] min-h-[1em] flex items-center justify-center">
                {loading && !data ? (
                  <Skeleton dark className="h-16 md:h-24 w-28 md:w-40" />
                ) : data ? (
                  <span className="counter" data-target={data[s.key] ?? 0}>0</span>
                ) : (
                  <span aria-label="tidak tersedia">—</span>
                )}
              </div>
              <p className="mt-4 font-mono text-[10px] font-bold tracking-[0.3em] text-[#f2efe6]/50 group-hover:text-white">{s.label.toUpperCase()}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
