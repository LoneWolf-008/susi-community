import { api } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { NEED_CATEGORY } from '../../lib/statusMap';
import { communityMarkerId, directionsUrl, toPoint } from '../../lib/map';
import LazyMap from './LazyMap';
import MapLegend from './MapLegend';

// Peta komunitas (U2) untuk tab "Komunitas & Peta" (komunitas & AgenSUSI).
//  - Komunitas lain: titik dari GET /public/communities (dibulatkan ±100 m; tanpa titik bila pembuatnya
//    mematikan show_location).
//  - Komunitas sendiri (anggota/pembuat): titik milik sendiri dari GET /communities.
//  - Kebutuhan terbuka: GET /needs/catalog, dibulatkan seperti titik publik, dan tidak ditampilkan bila
//    komunitasnya menyembunyikan lokasi (titik kebutuhan sering sama dengan titik komunitas).

const round3 = (p) => ({ lat: Math.round(p.lat * 1000) / 1000, lng: Math.round(p.lng * 1000) / 1000 });

function RouteLink({ point }) {
  return (
    <a href={directionsUrl(point)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center min-h-[36px] font-mono text-[10px] font-bold text-[#e62b2b] underline">
      RUTE DI GOOGLE MAPS ↗
    </a>
  );
}

/**
 * @param {{ communities: object[], ownIds: Set<number>, selectedId: string|null, onSelect: (id: string|null) => void,
 *   onOpenMading?: () => void, className?: string }} props
 *   communities = baris GET /communities (nama, deskripsi, titik milik sendiri); ownIds = komunitas "milik" pengguna.
 */
export default function CommunityMap({ communities, ownIds, selectedId, onSelect, onOpenMading, className = 'h-[360px] sm:h-[480px] md:h-[600px]' }) {
  const publicQ = useApi((signal) => api.get('/public/communities', { signal, query: { limit: 50 } }), []);
  const needsQ = useApi((signal) => api.get('/needs/catalog', { signal, query: { limit: 50 } }), []);
  const byId = new Map(communities.map((c) => [c.id, c]));
  const publicItems = publicQ.data?.items ?? [];
  const visible = new Set(publicItems.filter((c) => c.lat != null).map((c) => c.id));

  const markers = [];
  const details = new Map();
  for (const pub of publicItems) {
    const own = ownIds.has(pub.id);
    const point = own ? (toPoint(byId.get(pub.id)) ?? toPoint(pub)) : toPoint(pub);
    if (!point) continue;
    const id = communityMarkerId(pub.id);
    markers.push({ id, ...point, variant: own ? 'own' : 'community', label: `Komunitas ${pub.name}` });
    details.set(id, { kind: 'community', own, point, pub, row: byId.get(pub.id) });
  }
  for (const need of needsQ.data?.items ?? []) {
    const point = toPoint(need);
    const allowed = need.community_id == null || visible.has(need.community_id) || ownIds.has(need.community_id);
    if (!point || !allowed) continue;
    const id = `n-${need.id}`;
    const shown = round3(point);
    markers.push({ id, ...shown, variant: 'need', label: `Kebutuhan terbuka: ${need.title}` });
    details.set(id, { kind: 'need', point: shown, need });
  }
  const hidden = publicItems.filter((c) => c.lat == null && !ownIds.has(c.id)).length;

  const renderPopup = (m) => {
    const d = details.get(m.id);
    if (!d) return null;
    if (d.kind === 'need') {
      return (
        <div className="text-[13px] leading-snug">
          <p className="font-mono text-[9px] font-black tracking-wider text-[#b45309]">KEBUTUHAN TERBUKA · {(NEED_CATEGORY[d.need.category] || d.need.category).toUpperCase()}</p>
          <p className="font-black mt-1 break-words">{d.need.title}</p>
          {d.need.community_name && <p className="text-[12px] opacity-70 mt-0.5">{d.need.community_name}</p>}
          <RouteLink point={d.point} />
        </div>
      );
    }
    const { pub, row, own } = d;
    return (
      <div className="text-[13px] leading-snug">
        <p className={`font-mono text-[9px] font-black tracking-wider ${own ? 'text-[#0f766e]' : 'text-[#e62b2b]'}`}>{own ? 'KOMUNITAS ANDA' : 'KOMUNITAS'} · {pub.type}</p>
        <p className="font-black mt-1 break-words">{pub.name}</p>
        {row?.description && <p className="text-[12px] opacity-75 mt-1 line-clamp-3">{row.description}</p>}
        <p className="font-mono text-[10px] mt-2">{pub.members_count} ANGGOTA · {pub.needs_open} KEBUTUHAN TERBUKA · {pub.projects_completed} PROYEK SELESAI</p>
        {!own && <p className="font-mono text-[9px] opacity-60 mt-1">TITIK DIBULATKAN ±100 M</p>}
        <div className="flex flex-wrap items-center gap-x-3">
          <RouteLink point={d.point} />
          {own && onOpenMading && (
            <button type="button" onClick={onOpenMading} className="min-h-[36px] font-mono text-[10px] font-bold text-[#12283c] underline">KE MADING →</button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <MapLegend variants={['community', 'own', 'need']} />
        {hidden > 0 && <p className="font-mono text-[10px] opacity-60">{hidden} KOMUNITAS MENYEMBUNYIKAN LOKASI</p>}
      </div>
      <LazyMap
        className={`${className} rounded-xl border border-[#12283c]/15 overflow-hidden`}
        ariaLabel="Peta komunitas dan kebutuhan terbuka di Bandung"
        markers={markers}
        renderPopup={renderPopup}
        selectedId={selectedId}
        onSelect={onSelect}
        fit
      />
      {(publicQ.error || needsQ.error) && <p role="alert" className="font-mono text-[10px] text-[#e62b2b] mt-2">SEBAGIAN DATA PETA GAGAL DIMUAT.</p>}
    </div>
  );
}
