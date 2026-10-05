import { useState } from 'react';
import { api } from '../../../lib/api';
import { useApi } from '../../../hooks/useApi';
import { useToast } from '../../../context/toastContext';
import { TALENT_LEVEL } from '../../../lib/statusMap';
import { formatDate, initialOf, timeAgo } from '../../../lib/format';
import { SkeletonCard, SkeletonLines } from '../../../components/ui/Skeleton';
import ErrorState from '../../../components/ui/ErrorState';
import CertifiedBadge from '../../../components/common/CertifiedBadge';
import CertificationCard from '../../../components/certification/CertificationCard';

const MAX_SKILLS = 20;
const NEXT_LEVEL = { TALENTA_MUDA: 'TALENTA_TERPERCAYA', TALENTA_TERPERCAYA: 'TALENTA_AHLI' };

/** Pilih keahlian dari /skills + tambah nama baru → PATCH /talent/profile. */
function SkillsEditor({ current, onSaved, onCancel }) {
  const toast = useToast();
  const allQ = useApi((signal) => api.get('/skills', { signal }), []);
  const [selected, setSelected] = useState(() => current.map((s) => s.id));
  const [custom, setCustom] = useState([]);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const count = selected.length + custom.length;

  const toggle = (id) => setSelected((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : count < MAX_SKILLS ? [...ids, id] : ids));
  const addCustom = () => {
    const name = draft.trim().slice(0, 60);
    if (!name || count >= MAX_SKILLS) return;
    const known = (allQ.data || []).find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (known) {
      if (!selected.includes(known.id)) setSelected((ids) => [...ids, known.id]);
    } else if (!custom.some((c) => c.toLowerCase() === name.toLowerCase())) {
      setCustom((list) => [...list, name]);
    }
    setDraft('');
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.patch('/talent/profile', { skill_ids: selected, skills: custom });
      toast.success('Keahlian diperbarui');
      onSaved();
    } catch (err) {
      toast.error(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {allQ.loading && !allQ.data && <SkeletonLines count={2} />}
      <div className="flex flex-wrap gap-2">
        {(allQ.data || []).map((s) => (
          <button type="button" key={s.id} onClick={() => toggle(s.id)} aria-pressed={selected.includes(s.id)} className={`chip-mono transition-colors ${selected.includes(s.id) ? 'border-0 bg-[#12283c] text-[#f2efe6]' : 'text-[#12283c] hover:border-[#e62b2b]'}`}>{s.name}</button>
        ))}
        {custom.map((name) => (
          <button type="button" key={name} onClick={() => setCustom((list) => list.filter((c) => c !== name))} className="chip-mono border-0 bg-[#e62b2b] text-white" title="Klik untuk menghapus">{name} ×</button>
        ))}
      </div>
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="skill-new">Keahlian lain</label>
        <input id="skill-new" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }} className="input-line" placeholder="Keahlian lain, mis. Canva" maxLength={60} />
        <button type="button" onClick={addCustom} disabled={!draft.trim() || count >= MAX_SKILLS} className="btn-pill btn-ghost-dark !py-3 text-[10px] shrink-0 disabled:opacity-40">+ Tambah</button>
      </div>
      <p className="font-mono text-[9px] opacity-50">{count}/{MAX_SKILLS} KEAHLIAN DIPILIH</p>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="btn-pill btn-ghost-dark !py-3 flex-1 text-xs">Batal</button>
        <button type="button" onClick={save} disabled={saving} className="btn-pill btn-red !py-3 flex-1 text-xs disabled:opacity-60">{saving ? 'Menyimpan…' : 'Simpan keahlian'}</button>
      </div>
    </div>
  );
}

/** Profil talenta: reputasi & level (GET /talent/profile), keahlian, testimoni (/testimonials/mine). */
export default function ProfileTab({ onEdit }) {
  const [editingSkills, setEditingSkills] = useState(false);
  const profileQ = useApi((signal) => api.get('/talent/profile', { signal }), []);
  const testiQ = useApi((signal) => api.get('/testimonials/mine', { signal, query: { limit: 10 } }), []);

  if (profileQ.error) return <ErrorState error={profileQ.error} onRetry={profileQ.refetch} />;
  if (profileQ.loading && !profileQ.data) return <div className="space-y-6"><SkeletonCard /><SkeletonCard /></div>;

  const { user, profile, skills, projects } = profileQ.data;
  const points = Number(profile.reputation_points) || 0;
  const target = Number(profile.next_level_target) || points;
  const nextLevel = NEXT_LEVEL[profile.level];
  const completed = projects.filter((p) => p.status === 'COMPLETED');
  const active = projects.filter((p) => !['COMPLETED', 'CANCELLED'].includes(p.status));
  const testimonials = (testiQ.data?.items || []).filter((t) => t.moderation_status !== 'REJECTED');

  return (
    <>
      <div className="dash-item rounded-2xl bg-[#12283c] text-[#f2efe6] p-8 md:p-10 mb-6 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 border-2 border-[#e62b2b]/30 rounded-full" />
        <div className="grid grid-cols-12 gap-6 relative z-10">
          <div className="col-span-12 md:col-span-4 flex flex-col items-center md:items-start gap-4">
            <div className="w-28 h-28 rounded-2xl bg-[#e62b2b] flex items-center justify-center text-5xl font-black">{initialOf(user.name)}</div>
            <div>
              <h2 className="text-2xl font-black">{user.name}</h2>
              <p className="font-mono text-[10px] text-[#e62b2b] font-bold mt-1">TALENTA · {(TALENT_LEVEL[profile.level] || profile.level).toUpperCase()}</p>
              {profileQ.data.certified && <CertifiedBadge dark className="mt-2" />}
              {user.extra_info && <p className="text-xs opacity-70 mt-1">{user.extra_info}</p>}
            </div>
          </div>
          <div className="col-span-12 md:col-span-8">
            <p className="text-sm leading-relaxed opacity-80 mb-6">{user.bio || 'Belum ada bio. Ceritakan singkat pengalaman Anda di Pengaturan — komunitas membacanya saat memilih pelamar.'}</p>
            <div className="grid grid-cols-3 gap-px bg-white/10 rounded-xl overflow-hidden">
              {[
                { v: points, l: 'POIN REPUTASI' },
                { v: completed.length, l: 'PROYEK TERVERIFIKASI' },
                { v: active.length, l: 'PROYEK AKTIF' },
              ].map((s) => (
                <div key={s.l} className="bg-[#12283c] p-4"><div className="text-3xl font-black tabular-nums text-[#e62b2b]">{s.v}</div><p className="label-mono mt-1">{s.l}</p></div>
              ))}
            </div>
            {onEdit && <button type="button" onClick={onEdit} className="btn-pill btn-ghost-light !py-2.5 !px-5 text-[10px] mt-5">UBAH BIO & KONTAK →</button>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-5 space-y-6">
          <div className="dash-item card-light p-7">
            <span className="label-mono !text-[#e62b2b] !opacity-100">REPUTASI</span>
            <h3 className="text-xl font-black mt-1 mb-5">{nextLevel ? 'Menuju level berikutnya' : 'Level tertinggi'}</h3>
            <div className="flex justify-between font-mono text-[10px] font-bold mb-2">
              <span>{(TALENT_LEVEL[profile.level] || profile.level).toUpperCase()}</span>
              <span>{points} / {target}</span>
            </div>
            <div className="h-3 rounded-full bg-[#12283c]/10 overflow-hidden" role="progressbar" aria-valuenow={points} aria-valuemin={0} aria-valuemax={target} aria-label="Poin reputasi">
              <div className="h-full rounded-full bg-[#e62b2b]" style={{ width: `${Math.min(100, target ? (points / target) * 100 : 100)}%` }} />
            </div>
            <p className="font-mono text-[10px] opacity-50 mt-3">
              {nextLevel
                ? `${Math.max(0, target - points)} PROYEK TERVERIFIKASI LAGI MENUJU "${TALENT_LEVEL[nextLevel].toUpperCase()}". +1 POIN SETIAP PROYEK YANG DIBENARKAN KOMUNITAS.`
                : 'ANDA SUDAH DI LEVEL TERTINGGI. TERUS JAGA KUALITAS!'}
            </p>
          </div>

          <CertificationCard onChanged={profileQ.refetch} />

          <div className="dash-item card-light p-7">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-xl font-black">Keahlian</h3>
              {!editingSkills && <button type="button" onClick={() => setEditingSkills(true)} className="chip-mono text-[#12283c] hover:border-[#e62b2b]">UBAH</button>}
            </div>
            {editingSkills ? (
              <SkillsEditor current={skills} onCancel={() => setEditingSkills(false)} onSaved={() => { setEditingSkills(false); profileQ.refetch(); }} />
            ) : skills.length > 0 ? (
              <div className="flex flex-wrap gap-2">{skills.map((s) => <span key={s.id} className="chip-mono">{s.name}</span>)}</div>
            ) : (
              <p className="text-sm text-[#12283c]/60">Belum ada keahlian. Tambahkan agar katalog bisa difilter dan komunitas tahu kekuatan Anda.</p>
            )}
          </div>

          <div className="dash-item card-light p-7">
            <span className="label-mono !text-[#e62b2b] !opacity-100">KONTAK</span>
            <div className="space-y-3 text-sm mt-4">
              <div className="flex justify-between gap-3 border-b border-[#12283c]/10 pb-2"><span className="label-mono">EMAIL</span><span className="font-bold break-all text-right">{user.email}</span></div>
              <div className="flex justify-between gap-3 border-b border-[#12283c]/10 pb-2"><span className="label-mono">WHATSAPP</span><span className="font-bold">{user.phone || '—'}</span></div>
            </div>
            <p className="font-mono text-[9px] opacity-50 mt-3">KONTAK HANYA TERLIHAT OLEH KOMUNITAS SETELAH ANDA DIPILIH.</p>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-7 space-y-6">
          <div className="dash-item rounded-xl bg-[#c9ecd9] text-[#12283c] p-7">
            <h3 className="text-xl font-black mb-5">Testimoni dari Komunitas</h3>
            {testiQ.error && <ErrorState error={testiQ.error} onRetry={testiQ.refetch} compact />}
            {testiQ.loading && !testiQ.data && <SkeletonLines count={3} />}
            {testiQ.data && testimonials.length === 0 && <p className="text-sm opacity-70">Belum ada testimoni. Testimoni ditulis komunitas saat membenarkan proyek selesai.</p>}
            <div className="space-y-5">
              {testimonials.map((t) => (
                <div key={t.id} className="border-b-2 border-[#12283c]/15 pb-4 last:border-0 last:pb-0">
                  <p className="text-sm italic leading-relaxed mb-2">“{t.text}”</p>
                  <p className="font-mono text-[10px] opacity-70">— {t.from_name} · {t.project_title} · {timeAgo(t.created_at)}{t.moderation_status === 'PENDING' ? ' · MENUNGGU MODERASI' : ''}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="dash-item card-light p-7">
            <h3 className="text-xl font-black mb-5">Proyek Terverifikasi</h3>
            {completed.length === 0 && <p className="text-sm text-[#12283c]/60">Belum ada. Proyek tercatat di sini setelah komunitas membenarkan hasil kerja Anda.</p>}
            <ol className="space-y-4">
              {completed.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 border-b border-[#12283c]/10 pb-3 last:border-0">
                  <span>
                    <span className="block font-black text-sm">{p.title}</span>
                    {p.community_name && <span className="block font-mono text-[10px] opacity-60">{p.community_name}</span>}
                  </span>
                  <span className="font-mono text-[10px] opacity-60 shrink-0">✓ {formatDate(p.community_verified_at || p.created_at)}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </>
  );
}
