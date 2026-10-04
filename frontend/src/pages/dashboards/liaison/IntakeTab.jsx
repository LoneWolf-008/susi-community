import { useState } from 'react';
import { api } from '../../../lib/api';
import { useApi } from '../../../hooks/useApi';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { geocode, sectorOf } from '../../../lib/geocode';
import { NEED_CATEGORY } from '../../../lib/statusMap';
import GoogleMapsEmbed from '../../../components/common/GoogleMapsEmbed';
import { visitName, visitPoint } from './visits';

const TYPES = ['PKK', 'RT/RW', 'KARANG TARUNA', 'UMKM', 'PEMUDA', 'HOBI', 'KELUARGA', 'LAINNYA'];
const MAX_SKILLS = 10;

/**
 * Intake atas nama komunitas (jalur Assisted): POST /needs dengan community_id → sumber AGENSUSI,
 * liaison menjadi pemilik proksi. Bila dibuka dari kunjungan, kunjungan ditandai TERDATA sesudahnya.
 */
export default function IntakeTab({ visit, onSaved, onAgain, onOpenNeeds }) {
  const [mode, setMode] = useState(visit && !visit.community_id ? 'new' : 'existing');
  // Objek komunitas terpilih disimpan utuh agar tidak hilang saat hasil pencarian berubah.
  const [picked, setPicked] = useState(() => (visit?.community_id
    ? { id: visit.community_id, name: visitName(visit), address: visit.address, lat: visit.lat, lng: visit.lng }
    : null));
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim(), 350);
  const [newComm, setNewComm] = useState({ name: visit && !visit.community_id ? visit.community_name : '', type: 'PKK', leader_name: visit?.contact_person || '', whatsapp: '' });
  const [need, setNeed] = useState({ title: '', description: '', category: 'PENCATATAN' });
  const [skillIds, setSkillIds] = useState([]);
  const [address, setAddress] = useState(visit?.address || '');
  const [coords, setCoords] = useState(visitPoint(visit));
  const [locMsg, setLocMsg] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null); // kebutuhan yang sudah tersimpan
  const [visitPending, setVisitPending] = useState(false); // kunjungan gagal ditandai selesai

  const commQ = useApi((signal) => api.get('/communities', { signal, query: { limit: 50, search: q } }), [q]);
  const skillsQ = useApi((signal) => api.get('/skills', { signal }), []);
  const communities = commQ.data?.items || [];
  const communityId = picked ? String(picked.id) : '';
  const chosenPoint = picked?.lat != null ? { lat: Number(picked.lat), lng: Number(picked.lng) } : null;
  const point = coords || (mode === 'existing' ? chosenPoint : null);
  const pick = (e) => {
    setPicked(communities.find((c) => String(c.id) === e.target.value) || null);
    setErrors((x) => ({ ...x, community: undefined }));
  };

  const setN = (key) => (e) => { setNeed((n) => ({ ...n, [key]: e.target.value })); setErrors((x) => ({ ...x, [key]: undefined, form: undefined })); };
  const setC = (key) => (e) => { setNewComm((c) => ({ ...c, [key]: e.target.value })); setErrors((x) => ({ ...x, name: undefined, form: undefined })); };
  const toggleSkill = (id) => setSkillIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : ids.length < MAX_SKILLS ? [...ids, id] : ids));

  const searchAddress = async () => {
    if (!address.trim()) return;
    setLocMsg('Mencari…');
    try {
      const found = await geocode(address);
      setCoords(found ? { lat: found.lat, lng: found.lng } : null);
      setLocMsg(found ? 'Alamat ditemukan ✓' : 'Alamat tidak ditemukan — tambahkan kelurahan.');
    } catch (err) {
      setLocMsg(err.message);
    }
  };
  const grabGps = () => {
    if (!navigator.geolocation) { setLocMsg('GPS tidak didukung — cari alamat.'); return; }
    setLocMsg('Mencari GPS…');
    navigator.geolocation.getCurrentPosition(
      (p) => { setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocMsg('GPS tertangkap ✓'); },
      () => setLocMsg('GPS gagal — periksa izin lokasi atau cari alamat.'),
    );
  };

  const finishVisit = async (needId) => {
    if (!visit) return;
    try {
      await api.post(`/liaison/visits/${visit.id}/finish`, { need_id: needId, address: address.trim() || null, lat: point?.lat ?? null, lng: point?.lng ?? null });
      setVisitPending(false);
    } catch (err) {
      setVisitPending(true);
      setErrors({ form: `Kebutuhan tersimpan, tetapi kunjungan belum ditandai selesai: ${err.message}` });
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (mode === 'existing' && !communityId) errs.community = 'Pilih komunitas, atau isi data komunitas baru';
    if (mode === 'new' && !newComm.name.trim()) errs.name = 'Nama komunitas wajib diisi';
    if (!need.title.trim()) errs.title = 'Tuliskan judul masalah';
    if (!need.description.trim()) errs.description = 'Ceritakan masalahnya';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      let id = communityId;
      if (mode === 'new') {
        const community = await api.post('/communities', {
          name: newComm.name.trim(), type: newComm.type, leader_name: newComm.leader_name.trim() || null,
          whatsapp: newComm.whatsapp.trim() || null, address: address.trim() || null, lat: point?.lat ?? null, lng: point?.lng ?? null,
        });
        // Bila langkah berikutnya gagal, kirim ulang tidak membuat komunitas ganda.
        id = String(community.id);
        setPicked(community);
        setMode('existing');
      }
      const saved = await api.post('/needs', {
        community_id: id, title: need.title.trim(), description: need.description.trim(), category: need.category,
        skill_ids: skillIds, address: (address.trim() || picked?.address) || null, lat: point?.lat ?? null, lng: point?.lng ?? null,
      });
      setCreated(saved);
      await finishVisit(saved.id);
      onSaved?.(saved);
    } catch (err) {
      setErrors({ form: err.message, ...Object.fromEntries((err.details || []).map((d) => [d.field, d.message])) });
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (key) => errors[key] && <p className="mt-1 font-mono text-[10px] font-bold text-[#e62b2b]">{errors[key]}</p>;

  if (created && !visitPending) {
    return (
      <div className="dash-item card-light p-10 md:p-14 text-center max-w-2xl mx-auto">
        <div className="inline-flex w-24 h-24 rounded-full bg-[#c9ecd9] text-[#12283c] items-center justify-center text-5xl font-black mb-6">✓</div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">Kebutuhan tercatat!</h1>
        <p className="text-sm text-[#12283c]/60 leading-relaxed mb-8">
          “{created.title}” masuk antrean moderasi admin dengan sumber AgenSUSI{visit ? ` dan kunjungan ke ${visitName(visit)} ditandai terdata` : ''}.
          Setelah tayang, Anda mewakili komunitas memilih talenta dan membenarkan hasilnya.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <button type="button" onClick={onOpenNeeds} className="btn-pill btn-red">Ke Kebutuhan Tercatat →</button>
          <button type="button" onClick={onAgain} className="btn-pill btn-ghost-dark">+ Catat lagi</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="dash-item mb-6">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight">Catat Kebutuhan</h1>
        <p className="label-mono mt-2">{visit ? `HASIL KUNJUNGAN KE ${visitName(visit).toUpperCase()}` : 'ATAS NAMA KOMUNITAS · SUMBER AGENSUSI'}</p>
      </div>
      <form onSubmit={submit} className="grid grid-cols-12 gap-6" noValidate>
        <div className="col-span-12 lg:col-span-6 space-y-6">
          <div className="dash-item card-light p-7 space-y-4">
            <span className="label-mono !text-[#e62b2b] !opacity-100">A · KOMUNITAS</span>
            <div className="flex gap-2">
              {[['existing', 'Sudah terdaftar'], ['new', 'Komunitas baru']].map(([value, label]) => (
                <button type="button" key={value} onClick={() => setMode(value)} aria-pressed={mode === value} className={`chip-mono transition-colors ${mode === value ? 'border-0 bg-[#12283c] text-[#f2efe6]' : 'text-[#12283c]'}`}>{label.toUpperCase()}</button>
              ))}
            </div>
            {mode === 'existing' ? (
              <div className="space-y-3">
                <label className="sr-only" htmlFor="intake-comm-search">Cari komunitas</label>
                <input id="intake-comm-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} className="input-line" placeholder="Cari nama komunitas…" />
                <label className="field-label" htmlFor="intake-comm">Komunitas</label>
                <select id="intake-comm" value={communityId} onChange={pick} className="input-line">
                  <option value="">— Pilih komunitas —</option>
                  {picked && !communities.some((c) => String(c.id) === communityId) && <option value={communityId}>{picked.name}</option>}
                  {communities.map((c) => <option key={c.id} value={c.id}>{c.name}{c.sector ? ` · ${c.sector}` : ''}</option>)}
                </select>
                {fieldError('community')}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2"><label className="field-label" htmlFor="intake-new-name">Nama komunitas</label><input id="intake-new-name" value={newComm.name} onChange={setC('name')} className="input-line" maxLength={150} placeholder="Mis. PKK RW 03 Cijerah" />{fieldError('name')}</div>
                <div>
                  <label className="field-label" htmlFor="intake-new-type">Jenis</label>
                  <select id="intake-new-type" value={newComm.type} onChange={setC('type')} className="input-line">{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
                </div>
                <div><label className="field-label" htmlFor="intake-new-leader">Nama ketua</label><input id="intake-new-leader" value={newComm.leader_name} onChange={setC('leader_name')} className="input-line" maxLength={120} placeholder="Mis. Ibu Rina" /></div>
                <div className="md:col-span-2"><label className="field-label" htmlFor="intake-new-wa">WhatsApp komunitas (opsional)</label><input id="intake-new-wa" value={newComm.whatsapp} onChange={setC('whatsapp')} className="input-line" maxLength={30} placeholder="08…" /></div>
              </div>
            )}
          </div>

          <div className="dash-item card-light p-7 space-y-4">
            <span className="label-mono !text-[#e62b2b] !opacity-100">B · MASALAH YANG DIALAMI</span>
            <div><label className="field-label" htmlFor="intake-title">Judul masalah</label><input id="intake-title" value={need.title} onChange={setN('title')} className="input-line" maxLength={200} placeholder="Mis. Iuran warga sering hilang, susah direkap" />{fieldError('title')}</div>
            <div><label className="field-label" htmlFor="intake-desc">Cerita warga (bahasa mereka sendiri)</label><textarea id="intake-desc" value={need.description} onChange={setN('description')} className="input-line h-28 resize-none" maxLength={5000} placeholder="Tuliskan apa yang diceritakan pengurus: siapa yang repot, sejak kapan, dan apa akibatnya." />{fieldError('description')}</div>
            <div>
              <p className="field-label">Kategori</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(NEED_CATEGORY).map(([value, label]) => (
                  <button type="button" key={value} onClick={() => setNeed((n) => ({ ...n, category: value }))} className={`chip-mono transition-colors ${need.category === value ? 'border-0 bg-[#e62b2b] text-white' : 'text-[#12283c]'}`}>{label.toUpperCase()}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="field-label">Keahlian yang mungkin dibutuhkan (opsional)</p>
              <div className="flex flex-wrap gap-2">
                {(skillsQ.data || []).map((s) => (
                  <button type="button" key={s.id} onClick={() => toggleSkill(s.id)} aria-pressed={skillIds.includes(s.id)} className={`chip-mono transition-colors ${skillIds.includes(s.id) ? 'border-0 bg-[#12283c] text-[#f2efe6]' : 'text-[#12283c]'}`}>{s.name}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-6">
          <div className="dash-item card-light p-7">
            <span className="label-mono !text-[#e62b2b] !opacity-100">C · LOKASI</span>
            <div className="my-4"><button type="button" onClick={grabGps} className="w-full btn-pill btn-navy !py-3 text-[10px]">📡 Gunakan GPS saya</button></div>
            {locMsg && <p role="status" className="font-mono text-[10px] font-bold mb-3">{locMsg}</p>}
            <div className="relative z-0 rounded-xl border border-[#12283c]/15 h-[280px] mb-4 overflow-hidden">
              <GoogleMapsEmbed lat={point?.lat} lng={point?.lng} query={address || 'Bandung, Indonesia'} zoom={point ? 16 : 12} title="Peta lokasi kebutuhan" />
            </div>
            <p className="chip-mono border-0 bg-[#12283c] text-[#f2efe6] inline-block mb-4">{point ? `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)} · ${sectorOf(point)}` : 'BELUM ADA TITIK'}</p>
            <label className="field-label" htmlFor="intake-address">Alamat / patokan</label>
            <div className="flex gap-2">
              <input id="intake-address" value={address} onChange={(e) => { setAddress(e.target.value); setCoords(null); }} className="input-line" maxLength={255} placeholder="Mis. Balai RW 03, sebelah pos ronda" />
              <button type="button" onClick={searchAddress} disabled={!address.trim()} className="btn-pill btn-ghost-dark !px-5 !py-2 text-[9px] shrink-0">Cari</button>
            </div>
            {mode === 'existing' && chosenPoint && !coords && <p className="font-mono text-[9px] opacity-50 mt-2">TITIK MENGIKUTI LOKASI KOMUNITAS.</p>}
            {errors.form && <p role="alert" className="mt-5 rounded-lg bg-[#e62b2b] text-white p-3 text-xs font-bold">⚠ {errors.form}</p>}
            {visitPending && created ? (
              <button type="button" onClick={() => finishVisit(created.id)} className="btn-pill btn-navy w-full mt-6">Tandai kunjungan selesai lagi</button>
            ) : (
              <button type="submit" disabled={saving} className="btn-pill btn-red w-full mt-6 disabled:opacity-60">{saving ? 'Menyimpan…' : 'Simpan ke antrean moderasi →'}</button>
            )}
          </div>
        </div>
      </form>
    </>
  );
}
