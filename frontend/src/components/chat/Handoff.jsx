import { useState } from 'react';
import { Headset, Star, PauseCircle, MessageCircle, Maximize2, Sparkles } from 'lucide-react';
import MarkdownLite from './MarkdownLite';
import { CONTACT } from '../../data/contact';
import { HANDOFF_STATUS } from '../../lib/statusMap';
import { isHandoffActive } from '../../lib/handoff';
import { firstName, initialOf } from '../../lib/format';

// Ruang AgenSUSI (U6): bagian percakapan saat AI mengalihkan pengguna ke AgenSUSI. Dipakai widget
// Tanya SUSI dan halaman penuh /dashboard/ruang-agen. Status dari objek `handoff` backend:
// requested/waiting (menunggu agen) → assigned (ditangani) → resolved (selesai, minta penilaian).

/** Foto profil AgenSUSI bila ada (URL absolut), selain itu inisial; belum ada agen → ikon headset. */
export function AgentAvatar({ agent, size = 'w-9 h-9 text-sm' }) {
  if (agent?.avatar && /^https?:\/\//.test(agent.avatar)) {
    return <img src={agent.avatar} alt="" className={`${size} rounded-full object-cover shrink-0`} />;
  }
  return (
    <span className={`${size} rounded-full bg-[#c9ecd9] text-[#12283c] border-2 border-[#12283c] flex items-center justify-center shrink-0 font-black`} aria-hidden="true">
      {agent ? initialOf(agent.name) : <Headset className="w-4 h-4" />}
    </span>
  );
}

/** Menunggu agen → Ditangani oleh <nama> → Selesai. */
export function HandoffChip({ handoff, className = '' }) {
  const status = HANDOFF_STATUS[handoff?.status];
  if (!status) return null;
  const label = handoff.status === 'assigned' && handoff.agent ? `DITANGANI ${firstName(handoff.agent.name).toUpperCase()}` : status.label;
  const tone = { warning: 'bg-[#e62b2b] text-white', info: 'bg-[#12283c] text-[#f2efe6]', success: 'bg-[#c9ecd9] text-[#12283c]' }[status.tone];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[9px] font-black tracking-wider ${tone} ${className}`}>{label}</span>;
}

/** Penanda bahwa asisten AI tidak menjawab selama percakapan dialihkan. */
export function AiPausedNote({ t }) {
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-[9px] font-bold tracking-wider ${t.muted}`}>
      <PauseCircle className="w-3 h-3" aria-hidden="true" /> AI DIJEDA
    </span>
  );
}

/** Ringkasan yang dikirim ke AgenSUSI (transparansi), bisa dibuka/ditutup. */
export function SummaryDisclosure({ t, summary }) {
  if (!summary) return null;
  return (
    <details className={`group rounded-xl px-3 py-2 text-[12px] ${t.panel}`}>
      <summary className="cursor-pointer list-none flex items-center justify-between gap-2 min-h-[32px] font-mono text-[10px] font-bold tracking-wider">
        RINGKASAN YANG DIKIRIM KE AGENSUSI
        <span className="transition-transform group-open:rotate-180" aria-hidden="true">▾</span>
      </summary>
      <p className="mt-1 leading-relaxed">{summary}</p>
    </details>
  );
}

/**
 * Panel status bagian AgenSUSI: perkiraan balasan, ringkasan, WhatsApp resmi, kembali ke AI,
 * dan tautan ke ruang penuh (bila tersedia).
 */
export function HandoffInfo({ t, handoff, onCancel, cancelling = false, onOpenFull }) {
  const active = isHandoffActive(handoff);
  const whatsapp = active ? CONTACT.whatsappUrl(`Halo SUSI, saya butuh bantuan (tiket #${handoff.ticket_id}).`) : null;
  return (
    <div className="space-y-2" role="status">
      {handoff.eta_text && <p className={`text-[12px] leading-snug ${t.muted}`}>{handoff.eta_text}</p>}
      <SummaryDisclosure t={t} summary={handoff.summary} />
      {(active || onOpenFull) && (
        <div className="flex flex-wrap gap-2">
          {active && onCancel && (
            <button type="button" onClick={onCancel} disabled={cancelling} className={`min-h-[44px] inline-flex items-center gap-1.5 rounded-full px-3 font-mono text-[10px] font-bold tracking-wider disabled:opacity-50 ${t.action}`}>
              <Sparkles className="w-3.5 h-3.5 text-[#e62b2b]" aria-hidden="true" /> {cancelling ? 'MEMPROSES…' : 'KEMBALI KE ASISTEN AI'}
            </button>
          )}
          {whatsapp && (
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={`min-h-[44px] inline-flex items-center gap-1.5 rounded-full px-3 font-mono text-[10px] font-bold tracking-wider ${t.action}`}>
              <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" /> WHATSAPP RESMI
            </a>
          )}
          {onOpenFull && (
            <button type="button" onClick={onOpenFull} className={`min-h-[44px] inline-flex items-center gap-1.5 rounded-full px-3 font-mono text-[10px] font-bold tracking-wider ${t.action}`}>
              <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" /> BUKA DI RUANG PENUH
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Gelembung balasan AgenSUSI (manusia): warna & label berbeda dari jawaban AI. */
export function AgentMessage({ content, agent }) {
  return (
    <div className="flex items-end gap-2">
      <AgentAvatar agent={agent} size="w-7 h-7 text-[11px]" />
      <div className="flex flex-col items-start min-w-0">
        <span className="font-mono text-[9px] font-bold tracking-widest mb-1 inline-flex items-center gap-1.5 rounded-full bg-[#c9ecd9] text-[#12283c] px-2 py-0.5">
          <Headset className="w-3 h-3" aria-hidden="true" /> AGENSUSI{agent ? ` · ${firstName(agent.name).toUpperCase()}` : ' · TIM SUSI'}
        </span>
        <div className="max-w-full rounded-2xl rounded-bl-sm bg-[#c9ecd9] text-[#12283c] border-l-4 border-[#12283c] px-4 py-3 text-sm break-words">
          <MarkdownLite text={content} linkClass="underline underline-offset-2 break-all" />
        </div>
      </div>
    </div>
  );
}

const CONTACT_HINT = 'Email atau nomor WhatsApp';

/**
 * Kartu inline saat AI menyarankan AgenSUSI: "Ya, hubungkan" / "Lanjut dengan AI". Pengunjung
 * anonim mengisi kontak balik dulu di langkah berikutnya, sebelum tiket dibuat.
 * @param {{ t: object, anonymous: boolean, onConnect: (contact?: string) => Promise<void>, onDecline: () => void }} props
 */
export function HandoffOffer({ t, anonymous, onConnect, onDecline }) {
  const [step, setStep] = useState('ask'); // ask → contact (anonim)
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const connect = async (e) => {
    e?.preventDefault();
    if (anonymous && step === 'ask') {
      setStep('contact');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onConnect(anonymous ? contact.trim() : undefined);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={connect} className={`mt-2 w-full max-w-[88%] rounded-2xl p-3 space-y-2 ${t.panel}`} aria-label="Tawaran bantuan AgenSUSI">
      <div className="flex items-center gap-2">
        <AgentAvatar agent={null} size="w-8 h-8 text-xs" />
        <div className="min-w-0">
          <p className="text-sm font-black leading-tight">Lanjutkan dengan AgenSUSI?</p>
          <p className={`text-[11px] leading-snug ${t.muted}`}>Tim pendamping SUSI (manusia) membaca percakapan ini dan membalas di sini.</p>
        </div>
      </div>
      {step === 'contact' && (
        <div className="space-y-1">
          <label htmlFor="handoff-contact" className={`block font-mono text-[10px] font-bold tracking-widest ${t.muted}`}>KONTAK UNTUK DIHUBUNGI KEMBALI</label>
          <input
            id="handoff-contact"
            value={contact}
            onChange={(e) => setContact(e.target.value.slice(0, 150))}
            placeholder={CONTACT_HINT}
            autoComplete="email"
            autoFocus
            className={`w-full min-h-[44px] rounded-lg px-3 text-base sm:text-sm outline-none ${t.field}`}
          />
          <p className={`text-[11px] leading-snug ${t.muted}`}>Kontak hanya dilihat AgenSUSI untuk membalas Anda, dan tidak dikirim ke AI.</p>
        </div>
      )}
      {error && <p role="alert" className="text-[11px] font-bold text-[#e62b2b]">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={step === 'contact' ? () => setStep('ask') : onDecline} disabled={busy} className={`min-h-[44px] flex-1 rounded-full px-3 font-mono text-[10px] font-bold tracking-wider ${t.action}`}>
          {step === 'contact' ? 'KEMBALI' : 'LANJUT DENGAN AI'}
        </button>
        <button type="submit" disabled={busy || (step === 'contact' && contact.trim().length < 5)} className="min-h-[44px] flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-[#e62b2b] text-white px-3 font-mono text-[10px] font-bold tracking-wider disabled:opacity-40">
          <Headset className="w-3.5 h-3.5" aria-hidden="true" /> {busy ? 'MENGHUBUNGKAN…' : step === 'contact' ? 'KIRIM KE AGENSUSI' : 'YA, HUBUNGKAN'}
        </button>
      </div>
    </form>
  );
}

/**
 * Setelah AgenSUSI selesai: penilaian 1–5 dan "Pertanyaan baru ke AI" (tanpa menilai).
 * @param {{ t: object, handoff: object, onRate: (rating: number|null) => Promise<void> }} props
 */
export function RatingPrompt({ t, handoff, onRate }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (rating) => {
    setBusy(true);
    setError('');
    try {
      await onRate(rating);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <div className={`rounded-2xl p-3 space-y-2 ${t.panel}`} role="group" aria-label="Nilai bantuan AgenSUSI">
      <p className="text-sm font-black leading-tight">
        {handoff.handed_back ? 'AgenSUSI mengembalikan percakapan ini ke asisten AI.' : 'AgenSUSI menandai bantuan ini selesai.'}
      </p>
      <p className={`text-[12px] ${t.muted}`}>Seberapa membantu {handoff.agent ? firstName(handoff.agent.name) : 'AgenSUSI'}?</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => submit(n)} disabled={busy} aria-label={`Beri nilai ${n} dari 5`} className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 ${t.action}`}>
            <Star className="w-5 h-5 text-[#e62b2b]" aria-hidden="true" />
          </button>
        ))}
      </div>
      {error && <p role="alert" className="text-[11px] font-bold text-[#e62b2b]">{error}</p>}
      <button type="button" onClick={() => submit(null)} disabled={busy} className="min-h-[44px] w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-[#e62b2b] text-white px-3 font-mono text-[10px] font-bold tracking-wider disabled:opacity-50">
        <Sparkles className="w-3.5 h-3.5" aria-hidden="true" /> PERTANYAAN BARU KE AI
      </button>
    </div>
  );
}
