/** Blok placeholder berdenyut. Atur ukuran lewat className, mis. "h-6 w-40". */
export default function Skeleton({ className = 'h-4 w-full', dark = false }) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse rounded-md ${dark ? 'bg-white/10' : 'bg-[#12283c]/10'} ${className}`}
    />
  );
}

/** Beberapa baris skeleton untuk teks/daftar. */
export function SkeletonLines({ count = 3, dark = false }) {
  return (
    <div className="space-y-3" role="status" aria-label="Memuat">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} dark={dark} className={`h-4 ${i === count - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}

/** Kartu skeleton seukuran kartu daftar di dasbor. */
export function SkeletonCard({ dark = false }) {
  return (
    <div className={`${dark ? 'card-dark' : 'card-light'} p-6 space-y-4`} role="status" aria-label="Memuat">
      <Skeleton dark={dark} className="h-3 w-24" />
      <Skeleton dark={dark} className="h-6 w-3/4" />
      <Skeleton dark={dark} className="h-4 w-full" />
      <Skeleton dark={dark} className="h-4 w-1/2" />
    </div>
  );
}
