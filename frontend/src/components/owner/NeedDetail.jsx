import { useState } from 'react';
import { api } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/toastContext';
import {
  projectStatus, needStatus, moderationStatus, NEED_CATEGORY, NEED_SOURCE,
} from '../../lib/statusMap';
import { formatDate, whatsappLink } from '../../lib/format';
import StatusChip, { TagChip } from '../common/StatusChip';
import ProjSteps from '../common/ProjSteps';
import { SkeletonCard } from '../ui/Skeleton';
import ErrorState from '../ui/ErrorState';
import VerifyModal from '../modals/VerifyModal';
import ApplicantsPanel from './ApplicantsPanel';
import DeliveriesList from '../project/DeliveriesList';
import ProjectTimeline from '../project/ProjectTimeline';
import DisputePanel, { OpenDisputeForm } from '../project/DisputePanel';

const CATEGORIES = Object.keys(NEED_CATEGORY);

function EditNeedForm({ need, onSaved, onCancel }) {
  const toast = useToast();
  const [form, setForm] = useState({ title: need.title, category: need.category, summary: need.summary || '', description: need.description });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/needs/${need.id}`, { ...form, summary: form.summary || null });
      toast.success(need.moderation_status === 'REJECTED' ? 'Diperbaiki dan dikirim ulang ke moderasi' : 'Kebutuhan diperbarui');
      onSaved();
    } catch (err) {
      toast.error(err.message);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <div><label className="field-label" htmlFor="edit-title">Judul</label><input id="edit-title" value={form.title} onChange={set('title')} className="input-line" maxLength={200} required /></div>
      <div>
        <p className="field-label">Kategori</p>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button type="button" key={c} onClick={() => setForm((f) => ({ ...f, category: c }))} className={`chip-mono ${form.category === c ? 'border-0 bg-[#e62b2b] text-white' : 'text-[#12283c]'}`}>{NEED_CATEGORY[c]}</button>
          ))}
        </div>
      </div>
      <div><label className="field-label" htmlFor="edit-summary">Ringkasan singkat</label><input id="edit-summary" value={form.summary} onChange={set('summary')} className="input-line" maxLength={300} /></div>
      <div><label className="field-label" htmlFor="edit-desc">Cerita masalahnya</label><textarea id="edit-desc" value={form.description} onChange={set('description')} className="input-line h-32 resize-none" maxLength={5000} required /></div>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="btn-pill btn-ghost-dark !py-3 flex-1 text-xs">Batal</button>
        <button type="submit" disabled={saving} className="btn-pill btn-red !py-3 flex-1 text-xs disabled:opacity-60">{saving ? 'Menyimpan…' : 'Simpan & kirim ulang'}</button>
      </div>
    </form>
  );
}

function RevisionForm({ projectId, onDone, onCancel }) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/projects/${projectId}/revisions`, { note: note.trim() });
      toast.success('Permintaan perbaikan dikirim ke talenta');
      onDone();
    } catch (err) {
      toast.error(err.message);
      setSaving(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="field-label" htmlFor="revision-note">Bagian yang perlu diperbaiki</label>
      <textarea id="revision-note" value={note} onChange={(e) => setNote(e.target.value.slice(0, 2000))} className="input-line h-24 resize-none" placeholder="Mis. Rekap bulan September belum muncul otomatis." required />
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="btn-pill btn-ghost-dark !py-3 flex-1 text-xs">Batal</button>
        <button type="submit" disabled={!note.trim() || saving} className="btn-pill btn-navy !py-3 flex-1 text-xs disabled:opacity-50">{saving ? 'Mengirim…' : 'Kirim permintaan'}</button>
      </div>
    </form>
  );
}

/**
 * Detail kebutuhan untuk pemiliknya (requester, atau liaison sebagai pemilik proksi).
 * Proyek diambil dari `project_id` kebutuhan, jadi tetap benar setelah talenta dipilih.
 * `liveKey` dinaikkan dasbor saat ada notifikasi baru agar detail ikut dimuat ulang.
 * @param {{ needId: number, liveKey?: number, onBack: () => void, onChanged?: () => void }} props
 */
export default function NeedDetail({ needId, liveKey = 0, onBack, onChanged }) {
  const toast = useToast();
  const [version, setVersion] = useState(0);
  const [panel, setPanel] = useState(null); // 'edit' | 'revision' | 'dispute' | 'withdraw'
  const [verifying, setVerifying] = useState(false);
  const [busy, setBusy] = useState(false);

  const needQ = useApi((signal) => api.get(`/needs/${needId}`, { signal }), [needId, version, liveKey]);
  const projectId = needQ.data?.project_id ?? null;
  const projQ = useApi((signal) => api.get(`/projects/${projectId}`, { signal }), [projectId, version, liveKey], { enabled: Boolean(projectId) });

  const refresh = () => {
    setPanel(null);
    setVersion((v) => v + 1);
    onChanged?.();
  };

  const need = needQ.data;
  // Abaikan data proyek lama selama proyek baru (mis. setelah ganti talenta) masih dimuat.
  const projData = projectId && projQ.data?.id === projectId ? projQ.data : null;
  const project = projData && projData.status !== 'CANCELLED' ? projData : null;
  const error = needQ.error || projQ.error;
  const loading = (needQ.loading && !need) || (projectId && !projData && !error);

  const withdraw = async () => {
    setBusy(true);
    try {
      await api.post(`/needs/${needId}/withdraw`, { reason: 'Ditarik pemilik dari dasbor' });
      toast.success('Kebutuhan ditarik dari katalog');
      refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <>
        <BackButton onBack={onBack} />
        <ErrorState error={error} onRetry={() => setVersion((v) => v + 1)} />
      </>
    );
  }
  if (loading || !need) {
    return (
      <>
        <BackButton onBack={onBack} />
        <div className="space-y-6"><SkeletonCard /><SkeletonCard /></div>
      </>
    );
  }

  const statusChip = project
    ? projectStatus(project.status)
    : need.moderation_status !== 'APPROVED' ? moderationStatus(need.moderation_status) : needStatus(need.status);
  const editable = !project && ['PENDING', 'REJECTED'].includes(need.moderation_status);
  const withdrawable = !project && need.status !== 'CLOSED' && need.status !== 'COMPLETED';

  return (
    <>
      <BackButton onBack={onBack} />

      <div className="dash-item card-light p-8 md:p-10 mb-6">
        <div className="flex justify-between items-start flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <TagChip>{NEED_CATEGORY[need.category] || need.category}</TagChip>
            <StatusChip status={statusChip} />
            <TagChip>{NEED_SOURCE[need.source]}</TagChip>
          </div>
          <span className="label-mono">KEBUTUHAN #{need.id}</span>
        </div>
        <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-[0.95] mb-4">{need.title}</h1>
        <p className="text-sm text-[#12283c]/70 leading-relaxed max-w-3xl whitespace-pre-line">{need.description}</p>
        {need.skills?.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">{need.skills.map((s) => <span key={s.id} className="chip-mono text-[#12283c]">{s.name}</span>)}</div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#12283c]/10 rounded-xl overflow-hidden mt-6">
          {[
            ['KOMUNITAS', need.community_name || '—'],
            ['DIAJUKAN', formatDate(need.created_at)],
            ['TALENTA', project?.talent_name || '— BELUM ADA —'],
            ['TENGGAT', project?.deadline ? formatDate(project.deadline) : '—'],
          ].map(([l, v]) => (
            <div key={l} className="bg-[#fdfcf7] p-4"><p className="label-mono">{l}</p><p className="text-sm font-black mt-1 break-words">{v}</p></div>
          ))}
        </div>
      </div>

      {!project && (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8 space-y-6">
            {need.moderation_status === 'PENDING' && (
              <div className="dash-item card-light p-7">
                <h3 className="text-xl font-black mb-2">Menunggu moderasi</h3>
                <p className="text-sm text-[#12283c]/70">Admin SUSI memeriksa kebutuhan ini sebelum tampil di katalog talenta. Anda akan mendapat notifikasi hasilnya.</p>
              </div>
            )}
            {need.moderation_status === 'REJECTED' && (
              <div className="dash-item card-light p-7 border-l-4 border-l-[#e62b2b]">
                <h3 className="text-xl font-black mb-2">Belum bisa ditayangkan</h3>
                <p className="text-sm text-[#12283c]/70 mb-1">Alasan admin: <strong>{need.reject_reason}</strong>.</p>
                <p className="text-sm text-[#12283c]/70">Perbaiki ceritanya lalu kirim ulang; kebutuhan akan diperiksa lagi.</p>
              </div>
            )}
            {need.moderation_status === 'APPROVED' && need.status === 'OPEN' && (
              <ApplicantsPanel need={need} onChanged={refresh} />
            )}
            {need.status === 'CLOSED' && (
              <div className="dash-item card-light p-7"><h3 className="text-xl font-black mb-2">Kebutuhan ditutup</h3><p className="text-sm text-[#12283c]/70">Kebutuhan ini sudah ditarik dan tidak tampil di katalog.</p></div>
            )}
          </div>
          <div className="col-span-12 lg:col-span-4 space-y-6">
            {editable && (
              <div className="dash-item card-light p-7">
                <h3 className="text-lg font-black mb-4">Ubah kebutuhan</h3>
                {panel === 'edit'
                  ? <EditNeedForm need={need} onSaved={refresh} onCancel={() => setPanel(null)} />
                  : <button type="button" onClick={() => setPanel('edit')} className="btn-pill btn-navy w-full !py-3 text-xs">{need.moderation_status === 'REJECTED' ? 'Perbaiki & kirim ulang' : 'Ubah'}</button>}
              </div>
            )}
            {withdrawable && (
              <div className="dash-item card-light p-7">
                <h3 className="text-lg font-black mb-2">Tarik kebutuhan</h3>
                <p className="text-xs text-[#12283c]/60 mb-4">Kebutuhan hilang dari katalog dan pelamar diberi tahu. Riwayatnya tetap tersimpan.</p>
                {panel === 'withdraw' ? (
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setPanel(null)} className="btn-pill btn-ghost-dark !py-3 flex-1 text-xs">Batal</button>
                    <button type="button" onClick={withdraw} disabled={busy} className="btn-pill btn-red !py-3 flex-1 text-xs">{busy ? '…' : 'Ya, tarik'}</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setPanel('withdraw')} className="btn-pill btn-ghost-dark w-full !py-3 text-xs">Tarik kebutuhan</button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {project && (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-7 space-y-6">
            <div className="dash-item card-light p-7"><h3 className="text-xl font-black mb-6">Progres Proyek</h3><ProjSteps status={project.status} /></div>
            <div className="dash-item card-light p-7">
              <h3 className="text-xl font-black mb-4">Kesepakatan</h3>
              <p className="label-mono mb-1">LINGKUP</p>
              <p className="text-sm leading-relaxed mb-4 whitespace-pre-line">{project.scope}</p>
              <p className="label-mono mb-1">DEFINISI SELESAI</p>
              <p className="text-sm leading-relaxed whitespace-pre-line">{project.done_definition || '—'}</p>
              {project.status === 'AGREEMENT' && (
                <p className="mt-4 rounded-lg bg-[#12283c]/5 p-3 font-mono text-[10px] font-bold">⌛ MENUNGGU TALENTA MENYETUJUI KESEPAKATAN</p>
              )}
            </div>
            <div className="dash-item card-light p-7"><h3 className="text-xl font-black mb-4">Hasil Kiriman Talenta</h3><DeliveriesList deliveries={project.deliveries} /></div>
            <div className="dash-item card-light p-7"><h3 className="text-xl font-black mb-5">Lini Masa</h3><ProjectTimeline events={project.events} /></div>
          </div>

          <div className="col-span-12 lg:col-span-5 space-y-6">
            <div className="dash-item card-light p-7">
              <h3 className="text-xl font-black mb-2">Verifikasi Proyek</h3>
              <p className="label-mono mb-5">SELESAI HANYA BILA KEDUA PIHAK SETUJU</p>
              {['AGREEMENT', 'IN_PROGRESS', 'REVISION'].includes(project.status) && (
                <div className="rounded-xl border-2 border-dashed border-[#12283c]/25 p-5 font-mono text-[10px] font-bold opacity-60">🔒 TERBUKA SETELAH TALENTA MENANDAI SELESAI.</div>
              )}
              {project.status === 'AWAITING_VERIFICATION' && (
                <div className="space-y-3">
                  <div className="rounded-xl bg-[#c9ecd9] p-4 font-mono text-[10px] font-bold text-[#12283c]">✓ TALENTA MENANDAI SELESAI · {formatDate(project.talent_marked_done_at)}</div>
                  <button type="button" onClick={() => setVerifying(true)} className="btn-pill w-full bg-[#c9ecd9] text-[#12283c] hover:bg-[#e62b2b] hover:text-white">✓ Benarkan Selesai</button>
                  {panel === 'revision'
                    ? <RevisionForm projectId={project.id} onDone={refresh} onCancel={() => setPanel(null)} />
                    : <button type="button" onClick={() => setPanel('revision')} className="btn-pill btn-ghost-dark w-full !py-3">✕ Minta Perbaikan</button>}
                </div>
              )}
              {project.status === 'COMPLETED' && (
                <div className="space-y-5">
                  <div className="rounded-xl bg-[#c9ecd9]/60 border border-[#12283c]/15 p-5">
                    <p className="font-mono text-[10px] font-bold">✓ TERVERIFIKASI {formatDate(project.community_verified_at)} · REPUTASI TALENTA +1</p>
                  </div>
                  <ProjectTestimonials project={project} />
                </div>
              )}
              {project.status === 'DISPUTED' && (
                <p className="rounded-xl bg-[#7a1a1f] text-white p-4 font-mono text-[10px] font-bold">⚖ SEDANG DIMEDIASI ADMIN — LIHAT PANEL SENGKETA.</p>
              )}
            </div>

            <div className="dash-item card-dark !bg-[#12283c] p-6 text-[#f2efe6]">
              <p className="label-mono mb-2">KONTAK TALENTA</p>
              <p className="text-lg font-black">{project.talent_name}</p>
              {project.talent_email && <p className="font-mono text-xs opacity-70 mt-1">{project.talent_email}</p>}
              {whatsappLink(project.talent_phone) && (
                <a href={whatsappLink(project.talent_phone)} target="_blank" rel="noreferrer" className="btn-pill btn-red !py-2.5 !px-5 text-[10px] mt-4">CHAT WHATSAPP ↗</a>
              )}
            </div>

            {project.status === 'DISPUTED' && (
              <div className="dash-item card-light p-7"><h3 className="text-xl font-black mb-4">Sengketa</h3><DisputePanel projectId={project.id} side="community" onChanged={refresh} /></div>
            )}
            {['IN_PROGRESS', 'REVISION', 'AWAITING_VERIFICATION'].includes(project.status) && (
              <div className="dash-item card-light p-7">
                <h3 className="text-lg font-black mb-3">Ada masalah?</h3>
                {panel === 'dispute'
                  ? <OpenDisputeForm projectId={project.id} onOpened={refresh} onCancel={() => setPanel(null)} />
                  : <button type="button" onClick={() => setPanel('dispute')} className="btn-pill btn-ghost-dark w-full !py-3 text-xs">Ajukan sengketa ke admin</button>}
              </div>
            )}
          </div>
        </div>
      )}

      {verifying && project && (
        <VerifyModal
          project={{ ...project, project_title: need.title }}
          onClose={() => setVerifying(false)}
          onVerified={() => {
            setVerifying(false);
            toast.success('Proyek terverifikasi. Reputasi talenta +1 dan testimoni tercatat.');
            refresh();
          }}
        />
      )}
    </>
  );
}

function ProjectTestimonials({ project }) {
  const items = project.testimonials || [];
  return (
    <div>
      <p className="label-mono mb-3">TESTIMONI</p>
      {items.length === 0 && <p className="text-xs text-[#12283c]/60">Belum ada testimoni untuk proyek ini.</p>}
      <ul className="space-y-4">
        {items.map((t) => (
          <li key={t.id} className="border-l-2 border-[#c9ecd9] pl-4">
            <p className="text-sm italic leading-relaxed">“{t.text}”</p>
            <p className="font-mono text-[9px] opacity-60 mt-1">
              {Number(t.to_user_id) === Number(project.talent_id) ? 'UNTUK TALENTA' : 'DARI TALENTA'} · {t.from_name}
              {t.moderation_status === 'PENDING' ? ' · MENUNGGU MODERASI' : ''}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BackButton({ onBack }) {
  return (
    <div className="dash-item mb-6">
      <button type="button" onClick={onBack} className="btn-pill btn-ghost-dark !py-3 !px-5 text-[10px]">← KEMBALI</button>
    </div>
  );
}
