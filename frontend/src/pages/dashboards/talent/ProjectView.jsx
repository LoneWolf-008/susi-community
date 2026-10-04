import { useRef, useState } from 'react';
import { api } from '../../../lib/api';
import { useApi } from '../../../hooks/useApi';
import { useToast } from '../../../context/toastContext';
import { projectStatus } from '../../../lib/statusMap';
import { formatBytes, formatDate, formatDateTime, whatsappLink } from '../../../lib/format';
import StatusChip from '../../../components/common/StatusChip';
import ProjSteps from '../../../components/common/ProjSteps';
import DeliveriesList from '../../../components/project/DeliveriesList';
import ProjectTimeline from '../../../components/project/ProjectTimeline';
import DisputePanel, { OpenDisputeForm } from '../../../components/project/DisputePanel';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import ErrorState from '../../../components/ui/ErrorState';

// Sama dengan backend (utils/uploads.js): 25 MB dan ekstensi yang diizinkan.
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ACCEPT = '.zip,.rar,.pdf,.png,.jpg,.jpeg,.doc,.docx,.txt,.mp4,.mov';
const CANCELLABLE = ['AGREEMENT', 'IN_PROGRESS', 'REVISION'];
const DISPUTABLE = ['IN_PROGRESS', 'AWAITING_VERIFICATION', 'REVISION'];

/** Kirim hasil: unggah berkas (dengan progres) dan/atau tautan → POST /projects/:id/deliveries. */
function DeliveryForm({ projectId, isRevision, onDone }) {
  const toast = useToast();
  const abortRef = useRef(null);
  const [file, setFile] = useState(null);
  const [link, setLink] = useState('');
  const [progress, setProgress] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const pick = (e) => {
    const picked = e.target.files?.[0] || null;
    setError('');
    if (picked && picked.size > MAX_UPLOAD_BYTES) {
      setError(`Berkas ${formatBytes(picked.size)} melebihi batas 25 MB. Unggah ke Google Drive lalu kirim tautannya.`);
      setFile(null);
      e.target.value = '';
      return;
    }
    setFile(picked);
  };

  const submit = async (e) => {
    e.preventDefault();
    const url = link.trim();
    if (!file && !url) { setError('Lampirkan berkas atau tautan hasil kerja.'); return; }
    if (url && !/^https?:\/\/\S+$/i.test(url)) { setError('Tautan harus diawali http:// atau https://'); return; }
    setError('');
    setSubmitting(true);
    try {
      const body = url ? { link_url: url } : {};
      if (file) {
        const form = new FormData();
        form.append('file', file);
        abortRef.current = new AbortController();
        setProgress(0);
        const uploaded = await api.upload('/upload/delivery', form, { onProgress: setProgress, signal: abortRef.current.signal });
        Object.assign(body, { file_path: uploaded.file_path, file_name: uploaded.file_name });
      }
      await api.post(`/projects/${projectId}/deliveries`, body);
      toast.success('Hasil terkirim. Komunitas akan memeriksa dan memverifikasi.');
      onDone();
    } catch (err) {
      setError(err.name === 'AbortError' ? 'Unggahan dibatalkan.' : err.message);
      setSubmitting(false);
    } finally {
      abortRef.current = null;
      setProgress(null);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-xs text-[#12283c]/70 leading-relaxed">
        {isRevision ? 'Kirim ulang hasil yang sudah diperbaiki.' : 'Kirim saat pekerjaan sudah memenuhi definisi selesai.'} Proyek
        berpindah ke "menunggu verifikasi" dan komunitas mendapat notifikasi.
      </p>
      <div>
        <label className="field-label" htmlFor="delivery-file">Berkas (opsional, maks 25 MB)</label>
        <input id="delivery-file" type="file" accept={ACCEPT} onChange={pick} disabled={submitting} className="block w-full text-xs file:mr-3 file:rounded-full file:border-0 file:bg-[#12283c] file:px-4 file:py-2 file:font-mono file:text-[10px] file:font-bold file:text-[#f2efe6]" />
        {file && <p className="font-mono text-[10px] opacity-60 mt-1">{file.name} · {formatBytes(file.size)}</p>}
        <p className="font-mono text-[9px] opacity-50 mt-1">ZIP, RAR, PDF, PNG, JPG, DOC, DOCX, TXT, MP4, MOV</p>
      </div>
      <div>
        <label className="field-label" htmlFor="delivery-link">Tautan hasil / demo (opsional)</label>
        <input id="delivery-link" type="url" value={link} onChange={(e) => setLink(e.target.value)} disabled={submitting} className="input-line" placeholder="https://docs.google.com/… atau https://situs-demo…" maxLength={500} />
      </div>
      {progress !== null && (
        <div>
          <div className="flex justify-between font-mono text-[10px] font-bold mb-1"><span>MENGUNGGAH…</span><span>{progress}%</span></div>
          <div className="h-2 rounded-full bg-[#12283c]/10 overflow-hidden" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progres unggah">
            <div className="h-full rounded-full bg-[#e62b2b] transition-[width]" style={{ width: `${progress}%` }} />
          </div>
          <button type="button" onClick={() => abortRef.current?.abort()} className="chip-mono mt-2 text-[#12283c]">BATALKAN UNGGAHAN</button>
        </div>
      )}
      {error && <p role="alert" className="rounded-lg bg-[#e62b2b] text-white p-3 text-xs font-bold">⚠ {error}</p>}
      <button type="submit" disabled={submitting} className="btn-pill btn-red w-full disabled:opacity-60">{submitting ? 'Mengirim…' : 'Kirim hasil kerja →'}</button>
    </form>
  );
}

function CancelForm({ projectId, onDone, onCancel }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/projects/${projectId}/cancel`, { reason: reason.trim() });
      toast.show('Anda mundur dari proyek. Kebutuhan kembali terbuka untuk talenta lain.');
      onDone();
    } catch (err) {
      toast.error(err.message);
      setSaving(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="field-label" htmlFor="cancel-reason">Alasan mundur (dibaca komunitas)</label>
      <textarea id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value.slice(0, 500))} className="input-line h-24 resize-none" placeholder="Mis. Jadwal kuliah bentrok sehingga tidak bisa memenuhi tenggat." />
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="btn-pill btn-ghost-dark !py-3 flex-1 text-xs">Batal</button>
        <button type="submit" disabled={reason.trim().length < 5 || saving} className="btn-pill btn-navy !py-3 flex-1 text-xs disabled:opacity-50">{saving ? '…' : 'Ya, saya mundur'}</button>
      </div>
    </form>
  );
}

/** Testimoni talenta untuk komunitas setelah proyek terverifikasi (dimoderasi admin). */
function TestimonialForm({ project, onDone }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/testimonials', { project_id: project.id, to_user_id: project.requester_id, text: text.trim() });
      toast.success('Testimoni terkirim, tayang setelah diperiksa admin.');
      onDone();
    } catch (err) {
      toast.error(err.message);
      setSaving(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="field-label" htmlFor="testimonial-text">Testimoni untuk {project.community_name || project.requester_name}</label>
      <textarea id="testimonial-text" value={text} onChange={(e) => setText(e.target.value.slice(0, 1000))} className="input-line h-24 resize-none" placeholder="Mis. Pengurusnya responsif dan jelas menjelaskan kebutuhan." />
      <button type="submit" disabled={!text.trim() || saving} className="btn-pill btn-navy w-full !py-3 text-xs disabled:opacity-50">{saving ? 'Mengirim…' : 'Kirim testimoni'}</button>
    </form>
  );
}

/** Detail proyek dari sisi talenta: kesepakatan, kirim hasil, revisi, sengketa, mundur, testimoni. */
export default function ProjectView({ projectId, userId, liveKey = 0, onBack, onChanged }) {
  const toast = useToast();
  const [version, setVersion] = useState(0);
  const [panel, setPanel] = useState(null); // 'cancel' | 'dispute'
  const [agreeing, setAgreeing] = useState(false);
  const { data: project, loading, error } = useApi((signal) => api.get(`/projects/${projectId}`, { signal }), [projectId, version, liveKey]);

  const refresh = () => {
    setPanel(null);
    setVersion((v) => v + 1);
    onChanged?.();
  };

  const agree = async () => {
    setAgreeing(true);
    try {
      await api.patch(`/projects/${projectId}/agree`);
      toast.success('Kesepakatan disetujui. Selamat bekerja!');
      refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAgreeing(false);
    }
  };

  const back = (
    <div className="dash-item mb-6">
      <button type="button" onClick={onBack} className="btn-pill btn-ghost-dark !py-3 !px-5 text-[10px]">← KEMBALI KE PROYEK SAYA</button>
    </div>
  );
  if (error) return <>{back}<ErrorState error={error} onRetry={() => setVersion((v) => v + 1)} /></>;
  if (loading && !project) return <>{back}<div className="space-y-6"><SkeletonCard /><SkeletonCard /></div></>;

  const status = project.status;
  const latestRevision = project.revisions?.[0];
  const myTestimonial = project.testimonials?.find((t) => Number(t.from_user_id) === Number(userId));
  const forMe = project.testimonials?.filter((t) => Number(t.to_user_id) === Number(userId)) || [];
  const wa = whatsappLink(project.requester_phone);

  return (
    <>
      {back}
      <div className="dash-item card-light p-8 md:p-10 mb-6">
        <div className="flex justify-between items-start flex-wrap gap-3 mb-4">
          <StatusChip status={projectStatus(status)} />
          <span className="label-mono">PROYEK #{project.id}</span>
        </div>
        <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-[0.95] mb-3">{project.project_title}</h1>
        <p className="font-mono text-[10px] opacity-60">{project.community_name || project.requester_name} · {project.deadline ? `TENGGAT ${formatDate(project.deadline)}` : 'TANPA TENGGAT'}</p>
        <div className="mt-6"><ProjSteps status={status} /></div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-7 space-y-6">
          <div className="dash-item card-light p-7">
            <h3 className="text-xl font-black mb-4">Kesepakatan</h3>
            <p className="label-mono mb-1">LINGKUP</p>
            <p className="text-sm leading-relaxed mb-4 whitespace-pre-line">{project.scope}</p>
            <p className="label-mono mb-1">DEFINISI SELESAI</p>
            <p className="text-sm leading-relaxed mb-4 whitespace-pre-line">{project.done_definition || '—'}</p>
            <p className="label-mono mb-1">TENGGAT</p>
            <p className="text-sm">{project.deadline ? formatDate(project.deadline) : 'Tidak ditentukan'}</p>
            {status === 'AGREEMENT' && (
              <div className="mt-6 rounded-xl bg-[#12283c] text-[#f2efe6] p-5">
                <p className="text-sm leading-relaxed mb-4">Dengan menyetujui, Anda berkomitmen mengerjakan lingkup di atas. Hubungi komunitas lebih dulu bila ada yang perlu diperjelas.</p>
                <button type="button" onClick={agree} disabled={agreeing} className="btn-pill btn-red w-full disabled:opacity-60">{agreeing ? 'Memproses…' : 'Setuju & mulai bekerja →'}</button>
              </div>
            )}
          </div>

          {['IN_PROGRESS', 'REVISION'].includes(status) && (
            <div className="dash-item card-light p-7">
              <h3 className="text-xl font-black mb-4">{status === 'REVISION' ? 'Kirim ulang hasil' : 'Kirim hasil kerja'}</h3>
              {status === 'REVISION' && latestRevision && (
                <div className="rounded-xl bg-[#f4d4d4] p-4 text-sm leading-relaxed mb-5">
                  <p className="label-mono mb-1">CATATAN PERBAIKAN · {formatDateTime(latestRevision.requested_at)}</p>
                  {latestRevision.note}
                </div>
              )}
              <DeliveryForm projectId={project.id} isRevision={status === 'REVISION'} onDone={refresh} />
            </div>
          )}

          {status === 'AWAITING_VERIFICATION' && (
            <div className="dash-item rounded-xl border-2 border-dashed border-[#12283c]/25 p-6 font-mono text-[10px] font-bold">
              ⌛ HASIL TERKIRIM {formatDate(project.talent_marked_done_at)}. MENUNGGU KOMUNITAS MEMVERIFIKASI — ATAU MEMINTA PERBAIKAN.
            </div>
          )}

          <div className="dash-item card-light p-7"><h3 className="text-xl font-black mb-4">Hasil yang Sudah Dikirim</h3><DeliveriesList deliveries={project.deliveries} /></div>
          <div className="dash-item card-light p-7"><h3 className="text-xl font-black mb-5">Lini Masa</h3><ProjectTimeline events={project.events} /></div>
        </div>

        <div className="col-span-12 lg:col-span-5 space-y-6">
          <div className="dash-item card-dark !bg-[#12283c] p-6 text-[#f2efe6]">
            <p className="label-mono mb-2">KONTAK KOMUNITAS</p>
            <p className="text-lg font-black">{project.requester_name}</p>
            {project.community_name && <p className="text-xs opacity-70">{project.community_name}</p>}
            {project.requester_email && <p className="font-mono text-xs opacity-70 mt-1">{project.requester_email}</p>}
            {wa && <a href={wa} target="_blank" rel="noreferrer" className="btn-pill btn-red !py-2.5 !px-5 text-[10px] mt-4">CHAT WHATSAPP ↗</a>}
          </div>

          {status === 'COMPLETED' && (
            <div className="dash-item rounded-xl bg-[#c9ecd9] text-[#12283c] p-7 space-y-5">
              <div>
                <h3 className="text-xl font-black mb-1">Terverifikasi ✓</h3>
                <p className="font-mono text-[10px] font-bold">DIBENARKAN KOMUNITAS {formatDate(project.community_verified_at)} · REPUTASI +1</p>
              </div>
              {forMe.map((t) => (
                <blockquote key={t.id} className="border-l-2 border-[#12283c] pl-4">
                  <p className="text-sm italic leading-relaxed">“{t.text}”</p>
                  <footer className="font-mono text-[9px] opacity-60 mt-1">— {t.from_name}</footer>
                </blockquote>
              ))}
              {myTestimonial ? (
                <p className="rounded-lg bg-white/60 p-3 text-xs">
                  Testimoni Anda: “{myTestimonial.text}”{myTestimonial.moderation_status === 'PENDING' ? ' · menunggu moderasi admin' : ''}
                </p>
              ) : <TestimonialForm project={project} onDone={refresh} />}
            </div>
          )}

          {status === 'DISPUTED' && (
            <div className="dash-item card-light p-7"><h3 className="text-xl font-black mb-4">Sengketa</h3><DisputePanel projectId={project.id} side="talent" onChanged={refresh} /></div>
          )}
          {DISPUTABLE.includes(status) && (
            <div className="dash-item card-light p-7">
              <h3 className="text-lg font-black mb-3">Ada masalah?</h3>
              {panel === 'dispute'
                ? <OpenDisputeForm projectId={project.id} onOpened={refresh} onCancel={() => setPanel(null)} />
                : <button type="button" onClick={() => setPanel('dispute')} className="btn-pill btn-ghost-dark w-full !py-3 text-xs">Ajukan sengketa ke admin</button>}
            </div>
          )}
          {CANCELLABLE.includes(status) && (
            <div className="dash-item card-light p-7">
              <h3 className="text-lg font-black mb-2">Mundur dari proyek</h3>
              <p className="text-xs text-[#12283c]/60 mb-4">Kebutuhan kembali terbuka untuk talenta lain. Tidak memengaruhi reputasi, tetapi tercatat di lini masa.</p>
              {panel === 'cancel'
                ? <CancelForm projectId={project.id} onDone={refresh} onCancel={() => setPanel(null)} />
                : <button type="button" onClick={() => setPanel('cancel')} className="btn-pill btn-ghost-dark w-full !py-3 text-xs">Mundur…</button>}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
