import { useState } from 'react';
import SetToggle from '../common/SetToggle';
import { api } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { chatHistoryDeleted } from '../../hooks/useChat';
import { useAuth } from '../../context/authContext';
import { useToast } from '../../context/toastContext';
import { contactHref } from '../../data/contact';
import { SkeletonLines } from '../ui/Skeleton';
import ErrorState from '../ui/ErrorState';

// Pengaturan akun untuk semua peran: profil (PATCH /auth/me) dan preferensi (PATCH /settings).
const NAV = [
  { id: 'profil', l: 'INFORMASI PROFIL' },
  { id: 'notifikasi', l: 'NOTIFIKASI' },
  { id: 'privasi', l: 'PRIVASI' },
  { id: 'akun', l: 'AKUN' },
];

const NOTIF_TOGGLES = [
  { key: 'notif_talenta', label: 'Aktivitas talenta & lamaran', sub: 'Lamaran baru, kesepakatan, dan hasil kerja' },
  { key: 'notif_diskusi', label: 'Balasan mading', sub: 'Saat ada yang membalas topik Anda' },
  { key: 'notif_email', label: 'Email', sub: 'Ringkasan lewat email (segera hadir)' },
  { key: 'notif_whatsapp', label: 'WhatsApp', sub: 'Notifikasi penting via WhatsApp (segera hadir)' },
];

const CHAT_TOGGLES = [
  {
    key: 'allows_ai_chat',
    label: 'Izinkan AI menjawab pertanyaan saya',
    sub: 'Bila mati, Tanya SUSI menjawab dari basis pengetahuan SUSI saja dan pesan Anda tidak dikirim ke penyedia AI',
  },
  {
    key: 'allows_chat_history_storage',
    label: 'Simpan riwayat chat Tanya SUSI',
    sub: 'Bila mati, isi percakapan tidak disimpan di server dan hilang saat halaman ditutup. Riwayat yang disimpan terhapus otomatis setelah 90 hari',
  },
];

/** Hapus seluruh riwayat Tanya SUSI milik akun ini (DELETE /chatbot/history), dengan konfirmasi. */
function DeleteChatHistory({ user }) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      const { deleted } = await api.delete('/chatbot/history');
      chatHistoryDeleted(user);
      toast.success(deleted > 0 ? `${deleted} percakapan Tanya SUSI dihapus` : 'Tidak ada riwayat Tanya SUSI yang tersimpan');
      setConfirming(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pt-3">
      <p className="text-sm font-bold">Hapus riwayat Tanya SUSI</p>
      <p className="text-xs text-[#12283c]/60 mt-1 mb-3">
        Semua percakapan Anda dengan Tanya SUSI dihapus dari server, termasuk permintaan bantuan ke AgenSUSI yang masih terbuka.
        Catatan biaya & kualitas tetap ada tanpa isi pertanyaan dan tanpa tautan ke akun Anda.
      </p>
      {confirming ? (
        <div className="flex gap-3">
          <button type="button" onClick={() => setConfirming(false)} disabled={busy} className="btn-pill btn-ghost-dark !py-3 flex-1 text-xs">Batal</button>
          <button type="button" onClick={remove} disabled={busy} className="btn-pill btn-red !py-3 flex-1 text-xs">{busy ? '…' : 'Ya, hapus'}</button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="btn-pill btn-ghost-dark w-full !py-3 text-xs">Hapus riwayat chat</button>
      )}
    </div>
  );
}

function ProfileForm({ user }) {
  const { updateUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    name: user?.name || '', phone: user?.phone || '', bio: user?.bio || '', extra_info: user?.extra_info || '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => { setForm((f) => ({ ...f, [key]: e.target.value })); setErrors((x) => ({ ...x, [key]: undefined })); };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { user: updated } = await api.patch('/auth/me', {
        name: form.name, phone: form.phone || null, bio: form.bio || null, extra_info: form.extra_info || null,
      });
      updateUser(updated);
      toast.success('Profil tersimpan');
    } catch (err) {
      toast.error(err.message);
      setErrors(Object.fromEntries((err.details || []).map((d) => [d.field, d.message])));
    } finally {
      setSaving(false);
    }
  };

  const field = (key, label, props = {}) => (
    <div className={props.wide ? 'md:col-span-2' : ''}>
      <label className="field-label" htmlFor={`set-${key}`}>{label}</label>
      {props.textarea
        ? <textarea id={`set-${key}`} value={form[key]} onChange={set(key)} className="input-line h-24 resize-none" maxLength={1000} />
        : <input id={`set-${key}`} value={form[key]} onChange={set(key)} className="input-line" maxLength={props.max} />}
      {errors[key] && <p className="mt-1 font-mono text-[10px] font-bold text-[#e62b2b]">{errors[key]}</p>}
    </div>
  );

  return (
    <form onSubmit={save} className="dash-item card-light p-7">
      <span className="label-mono !text-[#e62b2b] !opacity-100">IDENTITAS</span>
      <h3 className="text-xl font-black mt-1 mb-5">Informasi Profil</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {field('name', 'Nama', { max: 120 })}
        <div>
          <p className="field-label">Email</p>
          <p className="input-line opacity-60">{user?.email}</p>
        </div>
        {field('phone', 'Nomor WhatsApp', { max: 30 })}
        {field('extra_info', user?.role === 'talent' ? 'Keahlian utama' : 'Nama komunitas / usaha', { max: 150 })}
        {field('bio', 'Bio singkat', { textarea: true, wide: true })}
      </div>
      <button type="submit" disabled={saving} className="btn-pill btn-navy w-full mt-6 disabled:opacity-60">{saving ? 'Menyimpan…' : 'SIMPAN →'}</button>
    </form>
  );
}

export default function SettingsPanel({ onLogout }) {
  const { user } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('profil');
  const { data: settings, loading, error, refetch, setData } = useApi((signal) => api.get('/settings', { signal }), []);

  const toggle = async (key) => {
    const next = !settings[key];
    setData((s) => ({ ...s, [key]: next ? 1 : 0 }));
    try {
      const saved = await api.patch('/settings', { [key]: next });
      setData(saved);
    } catch (err) {
      setData((s) => ({ ...s, [key]: next ? 0 : 1 }));
      toast.error(err.message);
    }
  };

  const toggles = (list) => {
    if (error) return <ErrorState error={error} onRetry={refetch} compact />;
    if (loading && !settings) return <SkeletonLines count={3} />;
    return list.map((t) => <SetToggle key={t.key} on={Boolean(settings?.[t.key])} onClick={() => toggle(t.key)} label={t.label} sub={t.sub} />);
  };

  return (
    <>
      <div className="dash-item mb-6"><h1 className="text-4xl md:text-5xl font-black tracking-tight">Pengaturan</h1><p className="label-mono mt-2">PREFERENSI AKUN</p></div>
      <div className="grid grid-cols-12 gap-6">
        <aside className="col-span-12 lg:col-span-3">
          <div className="lg:sticky lg:top-28 flex lg:flex-col gap-2 overflow-x-auto">
            {NAV.map((s) => (
              <button type="button" key={s.id} onClick={() => setTab(s.id)} className={`shrink-0 rounded-full px-5 py-3 text-[10px] font-black uppercase tracking-wider transition-colors ${tab === s.id ? 'bg-[#12283c] text-[#f2efe6]' : 'bg-white/60 border border-[#12283c]/15 hover:border-[#12283c]'}`}>{s.l}</button>
            ))}
          </div>
        </aside>
        <div className="col-span-12 lg:col-span-9 space-y-6">
          {tab === 'profil' && <ProfileForm key={user?.id} user={user} />}
          {tab === 'notifikasi' && (
            <div className="dash-item card-light p-7 space-y-3">
              <h3 className="text-xl font-black mb-2">Kelola Notifikasi</h3>
              {toggles(NOTIF_TOGGLES)}
            </div>
          )}
          {tab === 'privasi' && (
            <>
              <div className="dash-item card-light p-7 space-y-3">
                <h3 className="text-xl font-black mb-2">Kontrol Data</h3>
                {toggles([{ key: 'show_location', label: 'Tampilkan lokasi komunitas di peta publik', sub: 'Titik ditampilkan perkiraan (±100 m), alamat lengkap tidak pernah ditampilkan' }])}
              </div>
              <div className="dash-item card-light p-7 space-y-3">
                <h3 className="text-xl font-black mb-2">Tanya SUSI</h3>
                {toggles(CHAT_TOGGLES)}
                <DeleteChatHistory user={user} />
              </div>
            </>
          )}
          {tab === 'akun' && (
            <>
              <div className="dash-item card-light p-7">
                <h3 className="text-xl font-black mb-5">Keluar dari Akun</h3>
                <button type="button" onClick={onLogout} className="btn-pill btn-navy w-full">KELUAR →</button>
              </div>
              <div className="dash-item card-light p-7 border-l-4 border-l-[#e62b2b]">
                <h3 className="text-xl font-black mb-3">Hapus Akun</h3>
                <p className="text-sm text-[#12283c]/70 mb-5">
                  Penghapusan akun diproses tim SUSI agar riwayat proyek dan reputasi pihak lain tetap utuh.
                </p>
                {contactHref(`Halo tim SUSI, saya ingin menghapus akun ${user?.email}.`) ? (
                  <a href={contactHref(`Halo tim SUSI, saya ingin menghapus akun ${user?.email}.`)} target="_blank" rel="noreferrer" className="btn-pill btn-ghost-dark w-full">HUBUNGI ADMIN →</a>
                ) : (
                  <p className="font-mono text-[10px] opacity-60">HUBUNGI ADMIN SUSI LEWAT KANTOR ATAU AGENSUSI TERDEKAT.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
