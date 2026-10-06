import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  MapLibreMap, Marker, Popup, NavigationControl, LngLatBounds, setWorkerUrl,
} from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import './MapView.css';
import { MAP_STYLE_URL, roundPoint } from '../../lib/map';
import { BANDUNG_CENTER } from '../../lib/geocode';

// Peta MapLibre (U2). Selalu dimuat lewat LazyMap (chunk terpisah bersama CSS-nya).
//  - markers: [{ id, lat, lng, variant: community|own|need|hq, label }] + renderPopup(marker) → isi popup
//    (React, lewat portal) untuk marker terpilih (selectedId / onSelect).
//  - Mode pilih lokasi (onPick): pin merah yang bisa digeser di `pickPoint`; ketuk peta juga memindahkannya.
// Worker MapLibre dibundel Vite dari paket sendiri (tanpa CDN pihak ketiga).
setWorkerUrl(workerUrl);

const LOCALE = {
  'CooperativeGesturesHandler.WindowsHelpText': 'Tekan Ctrl sambil menggulir untuk memperbesar peta',
  'CooperativeGesturesHandler.MacHelpText': 'Tekan ⌘ sambil menggulir untuk memperbesar peta',
  'CooperativeGesturesHandler.MobileHelpText': 'Gunakan dua jari untuk menggeser peta',
  'NavigationControl.ZoomIn': 'Perbesar',
  'NavigationControl.ZoomOut': 'Perkecil',
};
const same = (a, b) => Boolean(a && b) && Math.abs(a.lat - b.lat) < 1e-7 && Math.abs(a.lng - b.lng) < 1e-7;

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Marker di titik yang sama (mis. kebutuhan di lokasi komunitasnya) disebar beberapa piksel. */
function spreadOffsets(markers) {
  const seen = new Map();
  const offsets = new Map();
  for (const m of markers) {
    // Sel ±100 m (3 desimal): titik publik dibulatkan 3 desimal, titik milik sendiri tidak, tetapi keduanya
    // bisa jatuh di posisi layar yang hampir sama.
    const key = `${m.lat.toFixed(3)},${m.lng.toFixed(3)}`;
    const index = seen.get(key) ?? 0;
    seen.set(key, index + 1);
    const angle = (index * 2 * Math.PI) / 6 - Math.PI / 2;
    // 30 px: lebih dari setengah area sentuh (44 px), jadi pusat marker di bawahnya tetap bisa diketuk.
    offsets.set(m.id, index === 0 ? [0, 0] : [Math.round(Math.cos(angle) * 30), Math.round(Math.sin(angle) * 30)]);
  }
  return offsets;
}

function markerElement(m, onClick) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `susi-marker susi-marker--${m.variant}`;
  el.setAttribute('aria-label', m.label);
  el.setAttribute('aria-pressed', 'false');
  el.title = m.label;
  const dot = document.createElement('span');
  dot.className = 'susi-marker__dot';
  el.appendChild(dot);
  el.addEventListener('click', (e) => {
    e.stopPropagation(); // jangan dianggap ketukan peta (mode pilih lokasi)
    onClick();
  });
  return el;
}

/**
 * @param {{ markers?: object[], renderPopup?: (m: object) => import('react').ReactNode, selectedId?: string|null,
 *   onSelect?: (id: string|null) => void, pickPoint?: {lat:number,lng:number}|null, onPick?: (p: {lat:number,lng:number}) => void,
 *   center?: {lat:number,lng:number}, zoom?: number, fit?: boolean, ariaLabel: string, className?: string }} props
 */
export default function MapView({
  markers = [], renderPopup, selectedId = null, onSelect = () => {}, pickPoint = null, onPick,
  center = BANDUNG_CENTER, zoom = 12, fit = false, ariaLabel, className = '',
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(new Map()); // id → Marker
  const popupRef = useRef(null);
  const pinRef = useRef(null);
  const lastPickRef = useRef(null);
  const fittedRef = useRef(false);
  const [popupNode] = useState(() => document.createElement('div'));
  const [webgl] = useState(supportsWebGL);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(webgl ? null : 'webgl'); // 'webgl' | 'style'
  const pickable = Boolean(onPick);

  const select = useEffectEvent((id) => onSelect(id));
  const isPickable = useEffectEvent(() => Boolean(onPick));
  const pick = useEffectEvent((point) => {
    const rounded = roundPoint(point);
    lastPickRef.current = rounded;
    onPick?.(rounded);
  });

  // Buat peta sekali.
  useEffect(() => {
    if (!webgl) return undefined;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: [center.lng, center.lat],
      zoom,
      attributionControl: { compact: true },
      cooperativeGestures: true,
      locale: LOCALE,
      maxZoom: 18,
    });
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    map.on('load', () => setReady(true));
    map.on('error', () => { if (!map.loaded()) setFailed((f) => f ?? 'style'); });
    map.on('click', (e) => { if (isPickable()) pick({ lat: e.lngLat.lat, lng: e.lngLat.lng }); });
    const popup = new Popup({ closeButton: true, closeOnClick: false, maxWidth: 'min(260px, 78vw)', offset: 18, focusAfterOpen: false });
    popup.on('close', () => select(null));
    popupRef.current = popup;
    mapRef.current = map;
    const markerMap = markersRef.current;
    return () => {
      popup.remove();
      markerMap.forEach((m) => m.remove());
      markerMap.clear();
      pinRef.current?.remove();
      pinRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // Peta dibuat sekali; perubahan pusat/zoom berikutnya lewat marker terpilih/pickPoint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sinkronkan marker.
  const markerKey = markers.map((m) => `${m.id}:${m.lat}:${m.lng}:${m.variant}:${m.label}`).join('|');
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const current = markersRef.current;
    const wanted = new Set(markers.map((m) => m.id));
    for (const [id, marker] of current) {
      if (!wanted.has(id)) {
        marker.remove();
        current.delete(id);
      }
    }
    const offsets = spreadOffsets(markers);
    for (const m of markers) {
      let marker = current.get(m.id);
      if (marker) {
        marker.remove();
        current.delete(m.id);
      }
      marker = new Marker({ element: markerElement(m, () => select(m.id)), offset: offsets.get(m.id) })
        .setLngLat([m.lng, m.lat])
        .addTo(map);
      current.set(m.id, marker);
    }
    if (fit && !fittedRef.current && markers.length > 0) {
      fittedRef.current = true;
      if (markers.length === 1) {
        map.jumpTo({ center: [markers[0].lng, markers[0].lat], zoom: Math.max(zoom, 14) });
      } else {
        const bounds = new LngLatBounds();
        markers.forEach((m) => bounds.extend([m.lng, m.lat]));
        map.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 0 });
      }
    }
    // markerKey mewakili isi markers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markerKey, ready, fit, zoom]);

  // Popup untuk marker terpilih (isi React lewat portal ke popupNode).
  const selected = markers.find((m) => m.id === selectedId) ?? null;
  const selectedKey = selected ? `${selected.id}:${selected.lat}:${selected.lng}` : '';
  useEffect(() => {
    const map = mapRef.current;
    const popup = popupRef.current;
    if (!map || !popup) return;
    markersRef.current.forEach((marker, id) => marker.getElement().setAttribute('aria-pressed', String(id === selectedId)));
    if (!selected || !renderPopup) {
      popup.remove();
      return;
    }
    // getOffset() mengembalikan Point { x, y } (tanpa toArray di MapLibre v6).
    const offset = markersRef.current.get(selected.id)?.getOffset();
    const [dx, dy] = offset ? [offset.x, offset.y] : [0, 0];
    popup.setOffset([dx, dy - 18]).setLngLat([selected.lng, selected.lat]);
    // addTo() pada popup yang terbuka menutupnya dulu (event close → pilihan terhapus), jadi hanya
    // dipasang bila belum terbuka; isinya tetap node portal yang sama.
    if (!popup.isOpen()) popup.setDOMContent(popupNode).addTo(map);
    map.easeTo({ center: [selected.lng, selected.lat], zoom: Math.max(map.getZoom(), 13), duration: 400 });
    // selectedKey mewakili marker terpilih.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, ready]);

  // Pin yang bisa digeser (mode pilih lokasi).
  const pickKey = pickPoint ? `${pickPoint.lat}:${pickPoint.lng}` : '';
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pickable) return;
    if (!pickPoint) {
      pinRef.current?.remove();
      pinRef.current = null;
      return;
    }
    if (!pinRef.current) {
      const el = document.createElement('div');
      el.className = 'susi-pin';
      el.setAttribute('aria-label', 'Penanda lokasi, bisa digeser');
      const head = document.createElement('span');
      head.className = 'susi-pin__head';
      el.appendChild(head);
      const pin = new Marker({ element: el, draggable: true, anchor: 'bottom' }).setLngLat([pickPoint.lng, pickPoint.lat]).addTo(map);
      pin.on('dragend', () => {
        const p = pin.getLngLat();
        pick({ lat: p.lat, lng: p.lng });
      });
      pinRef.current = pin;
    } else {
      pinRef.current.setLngLat([pickPoint.lng, pickPoint.lat]);
    }
    // Titik berubah dari luar (cari alamat / GPS): arahkan peta ke sana. Hasil geser sendiri tidak.
    if (!same(pickPoint, lastPickRef.current)) map.easeTo({ center: [pickPoint.lng, pickPoint.lat], zoom: Math.max(map.getZoom(), 16), duration: 500 });
    // pickKey mewakili pickPoint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickKey, ready, pickable]);

  return (
    <div className={`susi-map relative ${className}`}>
      {/* Posisi inline: maplibre-gl.css (dimuat setelah Tailwind) memberi .maplibregl-map position: relative,
          yang menimpa kelas absolute/inset-0 sehingga tinggi peta menjadi 0 (ditemukan smoke browser T16). */}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} role="region" aria-label={ariaLabel} />
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#f2efe6] p-6 text-center" role="alert">
          <p className="text-sm text-[#12283c]/70 max-w-xs">
            {failed === 'webgl'
              ? 'Peta tidak bisa ditampilkan di perangkat ini (WebGL tidak tersedia).'
              : 'Peta gagal dimuat. Periksa koneksi internet lalu muat ulang halaman.'}
          </p>
        </div>
      )}
      {selected && renderPopup && createPortal(renderPopup(selected), popupNode)}
    </div>
  );
}
