import { useState } from 'react';
import { api } from '../../lib/api';
import { useToast } from '../../context/toastContext';
import { requestOpenNeed, requestOpenOwnerNeed } from '../../lib/chatNavigation';

// Kartu terstruktur di jawaban Tanya SUSI (R3): kebutuhan yang cocok untuk talenta (Lihat & lamar)
// dan talenta yang cocok untuk pemilik kebutuhan (Lihat, Undang melamar). Sumbernya mesin
// rekomendasi R1; keputusan tetap di tangan pengguna.

function NeedCard({ t, card, onNavigate }) {
  return (
    <li className={`rounded-xl px-3 py-2.5 ${t.ai}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-black leading-snug break-words">{card.title}</p>
        <span className="shrink-0 rounded-full bg-[#c9ecd9] text-[#12283c] px-2 py-0.5 font-mono text-[9px] font-black">{card.score}%</span>
      </div>
      {card.invited && <p className="mt-1 font-mono text-[9px] font-bold text-[#e62b2b]">✉ ANDA DIUNDANG</p>}
      <button
        type="button"
        onClick={() => { requestOpenNeed(card.id); onNavigate(); }}
        className="mt-2 min-h-[44px] w-full rounded-full bg-[#e62b2b] text-white px-3 text-[11px] font-black"
      >
        Lihat & lamar →
      </button>
    </li>
  );
}

function TalentCard({ t, card, onNavigate }) {
  const toast = useToast();
  const [invited, setInvited] = useState(card.invited);
  const [busy, setBusy] = useState(false);

  const invite = async () => {
    setBusy(true);
    try {
      await api.post(`/needs/${card.need_id}/invite`, { talent_id: card.id });
      setInvited(true);
      toast.success(`Undangan terkirim ke ${card.title}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={`rounded-xl px-3 py-2.5 ${t.ai}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-black leading-snug break-words">{card.title}</p>
          <p className={`font-mono text-[9px] ${t.muted} break-words`}>UNTUK: {card.need_title}</p>
        </div>
        <span className="shrink-0 rounded-full bg-[#c9ecd9] text-[#12283c] px-2 py-0.5 font-mono text-[9px] font-black">{card.score}%</span>
      </div>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => { requestOpenOwnerNeed(card.need_id); onNavigate(); }}
          className={`min-h-[44px] flex-1 rounded-full px-3 text-[11px] font-black ${t.action}`}
        >
          Lihat
        </button>
        {card.applied ? (
          <span className="min-h-[44px] flex-1 inline-flex items-center justify-center rounded-full bg-[#c9ecd9] text-[#12283c] text-[11px] font-black">Sudah melamar</span>
        ) : invited ? (
          <span className="min-h-[44px] flex-1 inline-flex items-center justify-center rounded-full bg-[#c9ecd9] text-[#12283c] text-[11px] font-black">✓ Diundang</span>
        ) : (
          <button type="button" onClick={invite} disabled={busy} className="min-h-[44px] flex-1 rounded-full bg-[#12283c] text-[#f2efe6] px-3 text-[11px] font-black disabled:opacity-60">
            {busy ? '…' : 'Undang'}
          </button>
        )}
      </div>
    </li>
  );
}

/** @param {{ t: object, cards: { type: 'need'|'talent', id: number, score: number, title: string }[], onNavigate: () => void }} props */
export default function ChatCards({ t, cards, onNavigate }) {
  return (
    <ul className="mt-2 w-full max-w-[88%] space-y-2" aria-label="Rekomendasi">
      {cards.map((card) => (card.type === 'talent'
        ? <TalentCard key={`t-${card.need_id}-${card.id}`} t={t} card={card} onNavigate={onNavigate} />
        : <NeedCard key={`n-${card.id}`} t={t} card={card} onNavigate={onNavigate} />))}
      <li className={`font-mono text-[9px] ${t.muted}`}>Rekomendasi sistem. Keputusan tetap di tangan Anda.</li>
    </ul>
  );
}
