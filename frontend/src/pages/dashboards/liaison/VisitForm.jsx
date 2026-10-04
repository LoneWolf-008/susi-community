import { useState } from 'react';
import { api } from '../../../lib/api';
import { useApi } from '../../../hooks/useApi';
import { useToast } from '../../../context/toastContext';
import { geocode, sectorOf } from '../../../lib/geocode';
import { toDateInput } from '../../../lib/format';
import { todayInput } from './visits';

/** Jadwalkan (POST) atau ubah (PATCH) kunjungan. Status hanya berubah lewat mulai/selesai. */
export default function VisitForm({ visit, onSaved, onCancel }) {
  const toast = useToast();
  const editing = Boolean(visit);
  const commQ = useApi((signal) => api.get('/communities', { signal, query: { limit: 50 } }), []);
  const [form, setForm] = useState(() => ({
    community_id: visit?.community_id ? String(visit.community_id) : '',
    community_name: visit?.community_name || '',
    scheduled_date: visit ? toDateInput(visit.scheduled_date) : todayInput(),
    scheduled_time: visit?.scheduled_time ? String(visit.scheduled_time).slice(0, 5) : '',
    address: visit?.address || '',
    contact_person: visit?.contact_person || '',
    note: visit?.note || '',
  }));
  const [coords, setCoords] = useState(visit?.lat != null ? { lat: Number(visit.lat), lng: Number(visit.lng) } : null);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => { setForm((f) => ({ ...f, [key]: e.target.value })); setErrors((x) => ({ ...x, [key]: undefined })); };

  const pickCommunity = (e) => {
    const id = e.target.value;
    const c = (commQ.data?.items || []).find((x) => String(x.id) === id);
    setForm((f) => ({ ...f, community_id: id, community_name: c ? c.name : f.community_name, address: c?.address || f.address }));
    if (c?.lat != null) setCoords({ lat: Number(c.lat), lng: Number(c.lng) });
  };

  const search = async () => {
    if (!form.address.trim()) return;
    setMessage('Mencari…');
    try {
      const found = await geocode(form.address);
      setCoords(found ? { lat: found.lat, lng: found.lng } : null);
      setMessage(found ? `Lokasi ditemukan · ${sectorOf(found)}` : 'Alamat tidak ditemukan. Tambahkan nama jalan atau kelurahan.');
    } catch (err) {
      setMessage(err.message);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    const body = {
      community_id: form.community_id || null,
      community_name: form.community_name.trim(),
      scheduled_date: form.scheduled_date,
      scheduled_time: form.scheduled_time || null,
      address: form.address.trim() || null,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      contact_person: form.contact_person.trim() || null,
      note: form.note.trim() || null,
    };
    try {
      const saved = editing ? await api.patch(`/liaison/visits/${visit.id}`, body) : await api.post('/liaison/visits', body);
      toast.success(editing ? 'Kunjungan diperbarui' : 'Kunjungan dijadwalkan');
      onSaved(saved);
    } catch (err) {
      toast.error(err.message);
      setErrors(Object.fromEntries((err.details || []).map((d) => [d.field, d.message])));
      setSaving(false);
    }
  };

  const err = (key) => errors[key] && <p className="mt-1 font-mono text-[10px] font-bold text-[#e62b2b]">{errors[key]}</p>;

  return (
    <form onSubmit={save} className="dash-item card-light p-6 md:p-7 mb-6 space-y-4">
      <h3 className="text-xl font-black">{editing ? 'Ubah kunjungan' : 'Jadwalkan kunjungan'}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="field-label" htmlFor="visit-community">Komunitas terdaftar (opsional)</label>
          <select id="visit-community" value={form.community_id} onChange={pickCommunity} className="input-line">
            <option value="">— Belum terdaftar —</option>
            {(commQ.data?.items || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="visit-name">Nama komunitas</label>
          <input id="visit-name" value={form.community_name} onChange={set('community_name')} className="input-line" maxLength={150} placeholder="Mis. PKK RW 03 Cijerah" required />
          {err('community_name')}
        </div>
        <div>
          <label className="field-label" htmlFor="visit-date">Tanggal</label>
          <input id="visit-date" type="date" value={form.scheduled_date} onChange={set('scheduled_date')} className="input-line" required />
          {err('scheduled_date')}
        </div>
        <div>
          <label className="field-label" htmlFor="visit-time">Jam (opsional)</label>
          <input id="visit-time" type="time" value={form.scheduled_time} onChange={set('scheduled_time')} className="input-line" />
          {err('scheduled_time')}
        </div>
        <div className="md:col-span-2">
          <label className="field-label" htmlFor="visit-address">Alamat / titik temu</label>
          <div className="flex gap-2">
            <input id="visit-address" value={form.address} onChange={(e) => { set('address')(e); setCoords(null); setMessage(''); }} className="input-line" maxLength={255} placeholder="Mis. Balai RW 03, Jl. Cijerah II" />
            <button type="button" onClick={search} disabled={!form.address.trim()} className="btn-pill btn-ghost-dark !py-2 !px-5 text-[10px] shrink-0">Cari</button>
          </div>
          {message && <p role="status" className="font-mono text-[10px] mt-2">{message}</p>}
        </div>
        <div>
          <label className="field-label" htmlFor="visit-contact">Narahubung (opsional)</label>
          <input id="visit-contact" value={form.contact_person} onChange={set('contact_person')} className="input-line" maxLength={120} placeholder="Mis. Ibu Rina (Ketua RW 03)" />
        </div>
        <div>
          <label className="field-label" htmlFor="visit-note">Catatan (opsional)</label>
          <input id="visit-note" value={form.note} onChange={set('note')} className="input-line" maxLength={2000} placeholder="Mis. Ingin konsultasi rekap iuran" />
        </div>
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="btn-pill btn-ghost-dark !py-3 flex-1 text-xs">Batal</button>
        <button type="submit" disabled={saving || !form.community_name.trim() || !form.scheduled_date} className="btn-pill btn-red !py-3 flex-1 text-xs disabled:opacity-50">{saving ? 'Menyimpan…' : editing ? 'Simpan perubahan' : 'Jadwalkan'}</button>
      </div>
    </form>
  );
}
