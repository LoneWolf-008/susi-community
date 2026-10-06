import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import LocationPicker from '../components/map/LocationPicker';
import { geocode, sectorOf } from '../lib/geocode';
import { api } from '../lib/api';
import { useApi } from '../hooks/useApi';
import { NEED_CATEGORY } from '../lib/statusMap';
import { firstName, initialOf } from '../lib/format';

// Form kebutuhan (PRD P0-2): bahasa sehari-hari, tanpa istilah teknis, ada contoh pengisian.
const EXAMPLE = {
  title: 'Catatan iuran warga masih di buku tulis',
  summary: 'Iuran 48 kepala keluarga sering selisih saat direkap',
  description: 'Setiap bulan bendahara mencatat iuran di buku tulis. Kalau ada yang bayar telat, catatannya sering terlewat dan rekap akhir bulan jadi selisih. Kami ingin warga bisa mengecek sendiri siapa yang sudah bayar lewat HP.',
  category: 'PENCATATAN',
};
const MAX_SKILLS = 10;

export default function RequestPage({ user, navigateTo }) {
  const rootRef = useRef(null);
  const [form, setForm] = useState({ title: '', summary: '', description: '', category: 'PENCATATAN', community_id: '' });
  const [skillIds, setSkillIds] = useState([]);
  const [addr, setAddr] = useState('');
  const [coords, setCoords] = useState(null);
  const [searching, setSearching] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(null);

  const skillsQ = useApi((signal) => api.get('/skills', { signal }), []);
  const commQ = useApi((signal) => api.get('/communities', { signal, query: { mine: 'true', limit: 50 } }), []);
  const communities = commQ.data?.items || [];
  const community = communities.find((c) => String(c.id) === String(form.community_id));
  // Bila alamat tidak dicari, titik komunitas dipakai sebagai lokasi kebutuhan.
  const communityPoint = community?.lat != null ? { lat: Number(community.lat), lng: Number(community.lng) } : null;
  const point = coords || communityPoint;

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.req-item', { y: 25, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.07, ease: 'power2.out' });
    }, rootRef);
    return () => ctx.revert();
  }, [created]);

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((x) => ({ ...x, [key]: undefined, form: undefined }));
  };

  const toggleSkill = (id) => setSkillIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : ids.length < MAX_SKILLS ? [...ids, id] : ids));

  const searchAddress = async () => {
    if (!addr.trim() || searching) return;
    setSearching(true);
    setLocationMessage('');
    try {
      const found = await geocode(addr);
      if (found) {
        setCoords({ lat: found.lat, lng: found.lng });
        setLocationMessage('Lokasi ditemukan. Periksa titik pada peta sebelum mengirim.');
      } else {
        setLocationMessage('Alamat tidak ditemukan. Coba tambahkan nama jalan atau kelurahan.');
      }
    } catch (error) {
      setLocationMessage(error instanceof Error ? error.message : 'Pencarian alamat gagal. Coba lagi.');
    } finally {
      setSearching(false);
    }
  };

  const useExample = () => setForm((f) => ({ ...f, ...EXAMPLE }));

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.title.trim()) errs.title = 'Tuliskan judul masalahnya';
    if (!form.description.trim()) errs.description = 'Ceritakan masalahnya';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSubmitting(true);
    try {
      const need = await api.post('/needs', {
        title: form.title.trim(),
        summary: form.summary.trim() || null,
        description: form.description.trim(),
        category: form.category,
        community_id: form.community_id || null,
        skill_ids: skillIds,
        address: (coords ? addr.trim() : community?.address) || null,
        lat: point?.lat ?? null,
        lng: point?.lng ?? null,
      });
      setCreated(need);
    } catch (err) {
      setErrors({ form: err.message, ...Object.fromEntries((err.details || []).map((d) => [d.field, d.message])) });
      setSubmitting(false);
    }
  };

  const fieldError = (key) => errors[key] && <p className="mt-2 font-mono text-[10px] font-bold text-[#e62b2b]">{errors[key]}</p>;

  if (created) {
    return (
      <div ref={rootRef} className="min-h-dvh bg-[#f2efe6] text-[#12283c] flex items-center justify-center px-6">
        <div className="text-center max-w-xl">
          <div className="req-item inline-flex w-24 h-24 rounded-full bg-[#c9ecd9] items-center justify-center text-5xl font-black mb-8">✓</div>
          <h1 className="req-item text-5xl md:text-6xl font-black tracking-tight mb-4">Kebutuhan tercatat!</h1>
          <p className="req-item text-sm text-[#12283c]/60 leading-relaxed mb-10">
            “{created.title}” sedang diperiksa admin SUSI. Setelah disetujui, kebutuhan tampil di katalog dan talenta bisa melamar.
            Anda akan mendapat notifikasi di dasbor.
          </p>
          <div className="req-item flex flex-wrap gap-3 justify-center">
            <button type="button" onClick={() => navigateTo('dashboard')} className="btn-pill btn-navy">Kembali ke Dasbor →</button>
            <button type="button" onClick={() => { setCreated(null); setSubmitting(false); setForm((f) => ({ ...f, title: '', summary: '', description: '' })); setSkillIds([]); }} className="btn-pill btn-ghost-dark">Ajukan lagi</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="min-h-dvh bg-[#f2efe6] text-[#12283c]">
      <div className="fixed top-0 left-0 right-0 h-16 bg-[#f2efe6]/90 backdrop-blur-md border-b border-[#12283c]/10 z-50">
        <div className="h-full px-5 lg:px-8 flex items-center gap-4">
          <button type="button" onClick={() => navigateTo('dashboard')} className="chip-mono hover:text-[#e62b2b] transition-colors">← DASBOR</button>
          <span className="font-black tracking-tight text-lg">SUSI <span className="text-[#e62b2b]">Community.</span></span>
          <div className="flex-1" />
          <div className="flex items-center gap-2 rounded-full bg-white/70 border border-[#12283c]/15 pl-1 pr-4 py-1">
            <span className="w-7 h-7 rounded-full bg-[#e62b2b] text-white text-[10px] font-black flex items-center justify-center">{initialOf(user?.name)}</span>
            <span className="text-xs font-bold hidden sm:block">{firstName(user?.name)}</span>
          </div>
        </div>
      </div>
      <main className="pt-28 pb-20 px-5 lg:px-10">
        <div className="max-w-[1200px] mx-auto">
          <div className="req-item mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="label-mono mb-2">Formulir</p>
              <h1 className="text-4xl md:text-6xl font-black tracking-tight">Ceritakan Masalahmu<span className="text-[#e62b2b]">.</span></h1>
              <p className="text-sm text-[#12283c]/60 mt-3 max-w-xl">Tidak perlu istilah teknis. Tulis saja seperti bercerita ke tetangga — tim SUSI dan talenta yang akan menerjemahkannya.</p>
            </div>
            <button type="button" onClick={useExample} className="btn-pill btn-ghost-dark !py-3 text-[10px]">Pakai contoh pengisian</button>
          </div>
          <form onSubmit={submit} className="grid grid-cols-12 gap-6" noValidate>
            <div className="col-span-12 lg:col-span-5 space-y-6">
              <div className="req-item card-light p-7">
                <label className="field-label" htmlFor="need-title">Judul masalah</label>
                <input id="need-title" value={form.title} onChange={set('title')} maxLength={200} className="input-line" placeholder={`Mis. ${EXAMPLE.title}`} />
                {fieldError('title')}
                <label className="field-label mt-6" htmlFor="need-summary">Ringkasan satu kalimat (opsional)</label>
                <input id="need-summary" value={form.summary} onChange={set('summary')} maxLength={300} className="input-line" placeholder={`Mis. ${EXAMPLE.summary}`} />
              </div>
              <div className="req-item card-light p-7">
                <p className="field-label">Kategori</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(NEED_CATEGORY).map(([value, label]) => (
                    <button type="button" key={value} onClick={() => setForm((f) => ({ ...f, category: value }))} className={`rounded-full px-4 py-2 font-mono text-[10px] font-bold border transition-colors ${form.category === value ? 'bg-[#e62b2b] text-white border-[#e62b2b]' : 'border-[#12283c]/25 hover:border-[#12283c]'}`}>{label.toUpperCase()}</button>
                  ))}
                </div>
                <p className="font-mono text-[9px] opacity-50 mt-3">BINGUNG? PILIH “LAINNYA”, ADMIN AKAN MEMBANTU MENGELOMPOKKAN.</p>
              </div>
              <div className="req-item card-light p-7">
                <label className="field-label" htmlFor="need-desc">Ceritakan masalahmu</label>
                <textarea id="need-desc" value={form.description} onChange={set('description')} maxLength={5000} className="input-line h-40 resize-none" placeholder={`Contoh: ${EXAMPLE.description}`} />
                {fieldError('description')}
              </div>
              <div className="req-item card-light p-7">
                <label className="field-label" htmlFor="need-comm">Atas nama komunitas</label>
                {commQ.loading && !commQ.data ? <p className="font-mono text-[10px] opacity-50">MEMUAT…</p> : communities.length === 0 ? (
                  <p className="text-xs text-[#12283c]/60">Anda belum terdaftar di komunitas. Kebutuhan tetap bisa dikirim; daftarkan komunitas di menu “Komunitas & Peta” agar tercatat atas namanya.</p>
                ) : (
                  <select id="need-comm" value={form.community_id} onChange={set('community_id')} className="input-line">
                    <option value="">— Tanpa komunitas —</option>
                    {communities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
                {fieldError('community_id')}
              </div>
              <div className="req-item card-light p-7">
                <p className="field-label">Keahlian yang mungkin dibutuhkan (opsional)</p>
                <p className="font-mono text-[9px] opacity-50 mb-3">TIDAK TAHU? LEWATI SAJA. MAKS {MAX_SKILLS}.</p>
                <div className="flex flex-wrap gap-2">
                  {(skillsQ.data || []).map((s) => (
                    <button type="button" key={s.id} onClick={() => toggleSkill(s.id)} aria-pressed={skillIds.includes(s.id)} className={`chip-mono transition-colors ${skillIds.includes(s.id) ? 'border-0 bg-[#12283c] text-[#f2efe6]' : 'text-[#12283c] hover:border-[#e62b2b]'}`}>{s.name}</button>
                  ))}
                  {skillsQ.error && <p className="text-xs text-[#e62b2b]">Daftar keahlian gagal dimuat.</p>}
                </div>
              </div>
            </div>
            <div className="col-span-12 lg:col-span-7">
              <div className="req-item card-light p-7">
                <div className="flex justify-between items-center flex-wrap gap-3 mb-5">
                  <label className="field-label !mb-0" htmlFor="need-addr">Lokasi (opsional)</label>
                  <span className="chip-mono border-0 bg-[#12283c] text-[#f2efe6]">{point ? `${point.lat.toFixed(3)}, ${point.lng.toFixed(3)} · ${sectorOf(point)}` : 'BELUM ADA TITIK'}</span>
                </div>
                <div className="flex gap-2 mb-4">
                  <input id="need-addr" value={addr} onChange={(e) => { setAddr(e.target.value); setCoords(null); setLocationMessage(''); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchAddress(); } }} className="input-line" placeholder="Ketik alamat: Mis. Jl. Ambon No.11, Bandung" />
                  <button type="button" onClick={searchAddress} disabled={searching || !addr.trim()} className="btn-pill btn-navy !px-6 !py-3 text-[10px] shrink-0">{searching ? 'MENCARI...' : 'Cari →'}</button>
                </div>
                <LocationPicker point={point} onChange={setCoords} label="Peta lokasi kebutuhan" className="h-[300px] md:h-[440px]" />
                <p className="font-mono text-[10px] opacity-50 mt-2 leading-relaxed">
                  {coords ? 'TITIK DARI ALAMAT ATAU PETA.' : communityPoint ? 'TITIK MENGIKUTI LOKASI KOMUNITAS. CARI ALAMAT ATAU GESER PENANDA UNTUK MENGGANTINYA.' : 'LOKASI MEMBANTU TALENTA DI SEKITAR ANDA MENEMUKAN KEBUTUHAN INI.'}
                </p>
                {locationMessage && <p role="status" className="font-mono text-[10px] mt-2">{locationMessage}</p>}
              </div>
              {errors.form && <p role="alert" className="req-item mt-6 rounded-xl bg-[#e62b2b] text-white p-4 text-sm font-bold">⚠ {errors.form}</p>}
              <div className="req-item flex gap-3 mt-6">
                <button type="button" onClick={() => navigateTo('dashboard')} className="flex-1 btn-pill btn-ghost-dark">Batal</button>
                <button type="submit" disabled={submitting} className="flex-1 btn-pill btn-red disabled:opacity-60">{submitting ? 'Mengirim…' : 'Kirim Kebutuhan →'}</button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
