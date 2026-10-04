import { useNavigateTo } from '../context/transitionContext';

export default function NotFoundPage() {
  const navigateTo = useNavigateTo();
  return (
    <main className="min-h-screen flex items-center justify-center px-6 text-center">
      <div>
        <p className="font-mono text-[10px] font-bold tracking-[0.35em] text-[#f2efe6]/50">ERROR 404</p>
        <h1 className="mt-4 text-6xl md:text-8xl font-black tracking-tighter">
          Halaman tidak ada<span className="text-[#e62b2b]">.</span>
        </h1>
        <p className="mt-5 text-sm text-[#f2efe6]/60 max-w-md mx-auto">
          Tautan yang Anda buka mungkin sudah berubah. Kembali ke beranda untuk melanjutkan.
        </p>
        <button type="button" onClick={() => navigateTo('home')} className="btn-pill btn-red mt-8">
          Ke Beranda →
        </button>
      </div>
    </main>
  );
}
