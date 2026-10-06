import logoSusi from '../../assets/logo-susi.svg';

/** Layar tunggu saat sesi sedang dipulihkan (mis. setelah reload). */
export default function FullPageLoader({ label = 'MEMUAT SESI…' }) {
  return (
    <div className="min-h-dvh bg-[#0e2233] text-[#f2efe6] flex flex-col items-center justify-center gap-6" role="status">
      <img src={logoSusi} alt="" className="w-20 h-auto brightness-0 invert animate-pulse" />
      <p className="font-mono text-[10px] font-bold tracking-[0.35em] opacity-60">{label}</p>
    </div>
  );
}
