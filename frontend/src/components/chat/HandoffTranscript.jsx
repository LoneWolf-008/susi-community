import { Sparkles } from 'lucide-react';
import MarkdownLite from './MarkdownLite';
import { AgentMessage } from './Handoff';
import { formatDateTime } from '../../lib/format';

// Transkrip percakapan yang dialihkan ke AgenSUSI (U6): bagian AI (pesan sebelum `sinceId`) bisa
// dilipat, bagian AgenSUSI tampil penuh. Dipakai Ruang AgenSUSI pengguna (viewer "user") dan inbox
// AgenSUSI (viewer "agent"); sisi gelembung mengikuti siapa yang membaca.

function Bubble({ m, viewer, agent, t }) {
  const time = <span className={`block mt-1 font-mono text-[9px] ${t.muted}`}>{formatDateTime(m.created_at)}</span>;
  if (m.role === 'agent') {
    if (viewer === 'agent') {
      return (
        <div className="flex flex-col items-end">
          <span className="font-mono text-[9px] font-bold tracking-widest mb-1 rounded-full bg-[#c9ecd9] text-[#12283c] px-2 py-0.5">AGENSUSI</span>
          <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[#c9ecd9] text-[#12283c] border-r-4 border-[#12283c] px-4 py-3 text-sm break-words">
            <MarkdownLite text={m.content} linkClass="underline underline-offset-2 break-all" />
          </div>
          {time}
        </div>
      );
    }
    return <div><AgentMessage content={m.content} agent={agent} />{time}</div>;
  }
  if (m.role === 'user') {
    const mine = viewer === 'user';
    return (
      <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
        {!mine && <span className={`font-mono text-[9px] font-bold tracking-widest mb-1 ${t.muted}`}>PENGGUNA</span>}
        <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap break-words ${mine ? 'rounded-br-sm bg-[#e62b2b] text-white' : 'rounded-bl-sm bg-[#12283c] text-[#f2efe6]'}`}>
          {mine && <span className="sr-only">Anda: </span>}{m.content}
        </div>
        {time}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start">
      <span className={`font-mono text-[9px] font-bold tracking-widest mb-1 inline-flex items-center gap-1.5 ${t.muted}`}>
        <Sparkles className="w-3 h-3 text-[#e62b2b]" aria-hidden="true" /> TANYA SUSI · AI
      </span>
      <div className={`max-w-[88%] rounded-2xl rounded-bl-sm px-4 py-3 text-sm ${t.ai}`}><MarkdownLite text={m.content} linkClass={t.link} /></div>
      {time}
    </div>
  );
}

/** Pesan konfirmasi tiket (awal bagian AgenSUSI): catatan kecil di tengah, bukan jawaban AI. */
function SystemNote({ m, t }) {
  return (
    <p className={`mx-auto max-w-[90%] text-center text-[11px] leading-snug rounded-xl px-3 py-2 ${t.panel} ${t.muted}`}>
      {m.content}
    </p>
  );
}

/**
 * @param {{ messages: {id:number, role:string, content:string, created_at:string}[], sinceId: number|null,
 *   agent?: {name:string, avatar?:string}|null, viewer?: 'user'|'agent', t: object }} props
 */
export default function HandoffTranscript({ messages, sinceId, agent = null, viewer = 'user', t }) {
  const aiPart = sinceId ? messages.filter((m) => m.id < sinceId) : [];
  const agentPart = sinceId ? messages.filter((m) => m.id >= sinceId) : messages;
  return (
    <div className="space-y-4">
      {aiPart.length > 0 && (
        <details className={`group rounded-2xl ${t.panel}`}>
          <summary className="cursor-pointer list-none flex items-center justify-between gap-2 min-h-[44px] px-4 font-mono text-[10px] font-bold tracking-wider">
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#e62b2b]" aria-hidden="true" /> PERCAKAPAN DENGAN ASISTEN AI · {aiPart.length} PESAN
            </span>
            <span className="transition-transform group-open:rotate-180" aria-hidden="true">▾</span>
          </summary>
          <div className="px-4 pb-4 space-y-4">
            {aiPart.map((m) => <Bubble key={m.id} m={m} viewer={viewer} agent={agent} t={t} />)}
          </div>
        </details>
      )}
      {agentPart.map((m) => (m.id === sinceId && m.role === 'assistant'
        ? <SystemNote key={m.id} m={m} t={t} />
        : <Bubble key={m.id} m={m} viewer={viewer} agent={agent} t={t} />))}
    </div>
  );
}
