import { useState } from 'react';
import { BadgeCheck, ExternalLink, Link2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/toastContext';
import { CERT_REQUEST_STATUS, certificatePath, verificationUrl } from '../../lib/certification';
import { formatDate } from '../../lib/format';
import StatusChip from '../common/StatusChip';
import { SkeletonLines } from '../ui/Skeleton';
import ErrorState from '../ui/ErrorState';

// Kartu "Sertifikasi" di profil talenta (U5): progres proyek selesai, sertifikat aktif (lihat/cetak &
// tautan verifikasi), status pengajuan, dan formulir pengajuan (bidang, alasan, proyek bukti).

const PITCH_MIN = 30;
const PITCH_MAX = 1500;

function RequestForm({ eligibility, onCancel, onSent }) {
  const toast = useToast();
  const areas = eligibility.available_focus_areas;
  const min = eligibility.min_projects;
  const [focus, setFocus] = useState(areas[0]?.code ?? '');
  const [pitch, setPitch] = useState('');
  // Bawaan: semua proyek selesai terpilih (maks. 10), talenta bisa membuang yang tidak relevan.
  const [picked, setPicked] = useState(() => new Set(eligibility.completed_projects.slice(0, 10).map((p) => p.id)));
  const [busy, setBusy] = useState(false);
  const toggle = (id) => setPicked((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id);
    else if (next.size < 10) next.add(id);
    return next;
  });
  const valid = focus && pitch.trim().length >= PITCH_MIN && picked.size >= min;

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    try {
      await api.post('/certifications', { focus_area: focus, pitch: pitch.trim(), project_ids: [...picked] });
      toast.success('Pengajuan sertifikasi terkirim ke admin & AgenSUSI');
      onSent();
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-5 space-y-4 border-t border-[#12283c]/10 pt-5">
      <fieldset>
        <legend className="field-label">Bidang</legend>
        <div className="flex flex-wrap gap-2 mt-1" role="radiogroup">
          {areas.map((a) => (
            <button type="button" key={a.code} role="radio" aria-checked={focus === a.code} onClick={() => setFocus(a.code)} className={`min-h-[44px] rounded-full px-4 text-[11px] font-bold border transition-colors ${focus === a.code ? 'bg-[#12283c] text-[#f2efe6] border-[#12283c]' : 'border-[#12283c]/20 hover:border-[#12283c]'}`}>
              {a.label}
            </button>
          ))}
        </div>
      </fieldset>
      <div>
        <label className="field-label" htmlFor="cert-pitch">Mengapa Anda layak di bidang ini? (min. {PITCH_MIN} karakter)</label>
        <textarea id="cert-pitch" value={pitch} onChange={(e) => setPitch(e.target.value.slice(0, PITCH_MAX))} rows={4} className="input-line text-base sm:text-sm resize-none" placeholder="Ceritakan proyek yang paling menunjukkan kemampuan Anda dan dampaknya bagi komunitas." />
        <p className="font-mono text-[9px] opacity-50 mt-1">{pitch.trim().length}/{PITCH_MAX}</p>
      </div>
      <fieldset>
        <legend className="field-label">Proyek bukti (minimal {min}; terpilih {picked.size})</legend>
        <ul className="mt-1 space-y-2">
          {eligibility.completed_projects.map((p) => (
            <li key={p.id}>
              <label className="flex items-start gap-3 min-h-[44px] rounded-xl border border-[#12283c]/15 px-3 py-2 cursor-pointer has-[:checked]:border-[#12283c] has-[:checked]:bg-[#c9ecd9]/40">
                <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)} className="mt-1 w-4 h-4 accent-[#12283c]" />
                <span className="min-w-0">
                  <span className="block text-sm font-bold leading-snug break-words">{p.title}</span>
                  <span className="block font-mono text-[9px] opacity-60">{p.community_name || '—'} · SELESAI {formatDate(p.community_verified_at)}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={onCancel} disabled={busy} className="btn-pill btn-ghost-dark min-h-[44px]">Batal</button>
        <button type="submit" disabled={!valid || busy} className="btn-pill btn-red min-h-[44px] disabled:opacity-40">{busy ? 'Mengirim…' : 'Ajukan →'}</button>
      </div>
    </form>
  );
}

/** @param {{ onChanged?: () => void }} props onChanged = profil dimuat ulang (badge) setelah pengajuan. */
export default function CertificationCard({ onChanged = () => {} }) {
  const toast = useToast();
  const [version, setVersion] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const eligQ = useApi((signal) => api.get('/certifications/eligibility', { signal }), [version]);
  const mineQ = useApi((signal) => api.get('/certifications/mine', { signal }), [version]);
  const reload = () => { setVersion((v) => v + 1); onChanged(); };

  if (eligQ.error) return <div className="dash-item"><ErrorState error={eligQ.error} onRetry={eligQ.refetch} compact /></div>;
  if (!eligQ.data) return <div className="dash-item card-light p-7"><SkeletonLines count={4} /></div>;

  const e = eligQ.data;
  const progress = Math.min(e.completed, e.min_projects);
  const latest = mineQ.data?.items?.[0];
  const rejected = latest?.status === 'REJECTED' ? latest : null;
  const copy = async (code) => {
    try {
      await navigator.clipboard.writeText(verificationUrl(code));
      toast.success('Tautan verifikasi disalin');
    } catch {
      toast.error('Gagal menyalin. Salin manual dari halaman sertifikat.');
    }
  };

  return (
    <div className="dash-item card-light p-7">
      <span className="label-mono !text-[#e62b2b] !opacity-100">SERTIFIKASI</span>
      <h3 className="text-xl font-black mt-1 mb-4 flex items-center gap-2">
        {e.certificates.length > 0 ? <><BadgeCheck className="w-5 h-5 text-[#0f766e]" aria-hidden="true" /> Tersertifikasi SUSI</> : 'Sertifikasi SUSI'}
      </h3>

      <div className="flex justify-between font-mono text-[10px] font-bold mb-2">
        <span>PROYEK SELESAI</span>
        <span>{progress}/{e.min_projects}</span>
      </div>
      <div className="h-3 rounded-full bg-[#12283c]/10 overflow-hidden" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={e.min_projects} aria-label="Proyek selesai untuk sertifikasi">
        <div className="h-full rounded-full bg-[#0f766e]" style={{ width: `${(progress / e.min_projects) * 100}%` }} />
      </div>
      <p className="font-mono text-[10px] opacity-50 mt-2">SYARAT: {e.min_projects} PROYEK SELESAI YANG DIVERIFIKASI KOMUNITAS. DITINJAU ADMIN ATAU AGENSUSI.</p>

      {e.certificates.length > 0 && (
        <ul className="mt-5 space-y-3">
          {e.certificates.map((c) => (
            <li key={c.code} className="rounded-xl bg-[#c9ecd9] p-4">
              <p className="font-black text-sm">{c.focus_label}</p>
              <p className="font-mono text-[10px] opacity-70">{c.code} · TERBIT {formatDate(c.issued_at)}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <a href={certificatePath(c.code)} target="_blank" rel="noopener noreferrer" className="min-h-[44px] inline-flex items-center gap-1.5 rounded-full bg-[#12283c] text-[#f2efe6] px-4 font-mono text-[10px] font-bold">
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /> LIHAT & CETAK
                </a>
                <button type="button" onClick={() => copy(c.code)} className="min-h-[44px] inline-flex items-center gap-1.5 rounded-full border border-[#12283c]/30 px-4 font-mono text-[10px] font-bold">
                  <Link2 className="w-3.5 h-3.5" aria-hidden="true" /> SALIN TAUTAN VERIFIKASI
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {e.pending_request && (
        <div className="mt-5 rounded-xl border border-[#12283c]/15 p-4">
          <StatusChip status={CERT_REQUEST_STATUS.PENDING} />
          <p className="text-sm font-bold mt-2">Bidang {e.pending_request.focus_label}</p>
          <p className="font-mono text-[10px] opacity-60">DIAJUKAN {formatDate(e.pending_request.created_at)} · ADMIN ATAU AGENSUSI AKAN MENINJAU BUKTI PROYEK ANDA</p>
        </div>
      )}
      {rejected && !e.pending_request && (
        <div className="mt-5 rounded-xl border border-[#e62b2b]/30 bg-[#e62b2b]/5 p-4">
          <StatusChip status={CERT_REQUEST_STATUS.REJECTED} />
          <p className="text-sm font-bold mt-2">Bidang {rejected.focus_label}</p>
          {rejected.review_note && <p className="text-sm mt-1">{rejected.review_note}</p>}
        </div>
      )}

      {!formOpen && (
        <div className="mt-5">
          <button type="button" onClick={() => setFormOpen(true)} disabled={!e.eligible} className="btn-pill btn-red w-full min-h-[44px] disabled:bg-[#12283c]/10 disabled:text-[#12283c]/50 disabled:cursor-not-allowed">
            {e.certificates.length > 0 ? 'Ajukan bidang lain →' : 'Ajukan sertifikasi →'}
          </button>
          {!e.eligible && (
            <ul className="mt-2 space-y-1" aria-label="Alasan belum bisa mengajukan">
              {e.reasons.map((r) => <li key={r} className="font-mono text-[10px] opacity-70">• {r}</li>)}
            </ul>
          )}
        </div>
      )}
      {formOpen && e.eligible && (
        <RequestForm eligibility={e} onCancel={() => setFormOpen(false)} onSent={() => { setFormOpen(false); reload(); }} />
      )}
    </div>
  );
}
