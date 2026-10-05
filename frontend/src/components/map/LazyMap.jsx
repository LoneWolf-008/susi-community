import { Component, lazy, Suspense } from 'react';

// MapLibre (± ratusan KB) + CSS-nya hanya dimuat saat peta pertama kali tampil (chunk terpisah).
const MapView = lazy(() => import('./MapView'));

function MapPlaceholder({ className, children }) {
  return (
    <div className={`relative bg-[#e9e5d8] ${className}`}>
      <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
        <p className="font-mono text-[10px] font-bold tracking-widest text-[#12283c]/50">{children}</p>
      </div>
    </div>
  );
}

/** Chunk peta gagal diunduh (mis. koneksi putus): tampilkan pesan, bukan layar kosong. */
class MapErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return <MapPlaceholder className={this.props.className}>PETA GAGAL DIMUAT. MUAT ULANG HALAMAN UNTUK MENCOBA LAGI.</MapPlaceholder>;
    }
    return this.props.children;
  }
}

/** Props sama dengan MapView (markers, renderPopup, selectedId, onSelect, pickPoint, onPick, …). */
export default function LazyMap({ className = '', ...props }) {
  return (
    <MapErrorBoundary className={className}>
      <Suspense fallback={<MapPlaceholder className={className}>MEMUAT PETA…</MapPlaceholder>}>
        <MapView className={className} {...props} />
      </Suspense>
    </MapErrorBoundary>
  );
}
