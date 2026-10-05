import LazyMap from './LazyMap';
import { BANDUNG_CENTER } from '../../lib/geocode';

/**
 * Pilih/perbaiki titik lokasi di formulir (U2): pin merah bisa digeser, atau ketuk peta. Melengkapi
 * pencarian alamat & GPS yang sudah ada; `onChange` menerima { lat, lng } (6 desimal, sama dengan DB).
 * @param {{ point: {lat:number,lng:number}|null, onChange: (p: {lat:number,lng:number}) => void,
 *   label?: string, className?: string, dark?: boolean }} props
 */
export default function LocationPicker({ point, onChange, label = 'Peta lokasi', className = 'h-[260px] sm:h-[320px]', dark = false }) {
  return (
    <div>
      <LazyMap
        className={`${className} rounded-xl overflow-hidden border ${dark ? 'border-white/15' : 'border-[#12283c]/15'}`}
        ariaLabel={`${label}. Ketuk peta atau geser penanda untuk memilih titik.`}
        pickPoint={point}
        onPick={onChange}
        center={point ?? BANDUNG_CENTER}
        zoom={point ? 16 : 12}
      />
      <p className={`font-mono text-[10px] mt-2 ${dark ? 'text-[#f2efe6]/60' : 'opacity-60'}`}>
        {point ? 'GESER PENANDA ATAU KETUK PETA UNTUK MEMPERBAIKI TITIK.' : 'KETUK PETA UNTUK MENANDAI LOKASI, ATAU CARI ALAMAT/GPS DI ATAS.'}
      </p>
    </div>
  );
}
