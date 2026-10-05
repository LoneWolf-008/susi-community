import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { api } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/toastContext';
import { timeAgo, timeLeft, formatDateTime, initialOf } from '../../lib/format';
import { SkeletonLines } from '../ui/Skeleton';
import ErrorState from '../ui/ErrorState';
import EmptyState from '../ui/EmptyState';

// Papan mading lintas komunitas (GET/POST /discussions, balasan, simpan posisi catatan).
// Hanya penulis yang bisa menggeser catatannya; posisi disimpan saat dilepas.
// U1: topik punya masa pajang (bawaan 7 hari) yang bisa diperpanjang penulisnya; topik dihapus oleh
// penulis, pengurus komunitas terkait, atau admin; balasan oleh penulisnya.

const NOTE_COLORS = ['#c9ecd9', '#f4d4d4', '#d8e2ec', '#fdfcf7'];
const CATEGORIES = ['DISKUSI', 'TANYA', 'INFO'];
const DURATIONS = [1, 3, 7, 14, 30];
const CANVAS_W = 1600;
const CANVAS_H = 1000;
const HOUR_MS = 60 * 60 * 1000;
// Sisa < 24 jam: penanda waktu diberi warna peringatan.
const endingSoon = (expiresAt) => expiresAt && new Date(expiresAt).getTime() - Date.now() < 24 * HOUR_MS;

// Dipanggil hanya dari handler kirim topik (bukan saat render).
function randomPlacement() {
  return {
    pos_x: Math.round(150 + Math.random() * (CANVAS_W - 500)),
    pos_y: Math.round(80 + Math.random() * (CANVAS_H - 400)),
    rotation: Math.round(Math.random() * 8 - 4),
    color: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)],
  };
}

/** Masa pajang topik: info, perpanjang (penulis), dan hapus (penulis/pengurus/admin) dengan konfirmasi. */
function TopicActions({ topic, onChanged, onDeleted }) {
  const toast = useToast();
  const [panel, setPanel] = useState(null); // 'extend' | 'delete'
  const [busy, setBusy] = useState(false);

  const run = async (request, message, after) => {
    setBusy(true);
    try {
      await request();
      toast.success(message);
      setPanel(null);
      after();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  const extend = (days) => run(() => api.patch(`/discussions/${topic.id}/extend`, { duration_days: days }), `Masa pajang ditambah ${days} hari`, onChanged);
  const remove = () => run(() => api.delete(`/discussions/${topic.id}`), 'Topik dihapus dari mading', onDeleted);

  const expiry = topic.expires_at === null
    ? 'DIPAJANG TANPA BATAS WAKTU'
    : topic.expired
      ? 'MASA PAJANG HABIS · TIDAK TAMPIL DI PAPAN'
      : `DIPAJANG SAMPAI ${formatDateTime(topic.expires_at).toUpperCase()} · ${timeLeft(topic.expires_at).toUpperCase()}`;

  return (
    <div className="dash-item card-light p-5 mb-6">
      <p className={`font-mono text-[10px] font-bold ${topic.expired || endingSoon(topic.expires_at) ? 'text-[#e62b2b]' : 'opacity-70'}`}>⏳ {expiry}</p>
      {(topic.can_extend || topic.can_delete) && (
        <div className="flex flex-wrap gap-2 mt-3">
          {topic.can_extend && topic.expires_at !== null && (
            <button type="button" onClick={() => setPanel(panel === 'extend' ? null : 'extend')} aria-expanded={panel === 'extend'} className="btn-pill btn-ghost-dark !py-2 !px-4 min-h-[44px] text-[11px]">Perpanjang</button>
          )}
          {topic.can_delete && (
            <button type="button" onClick={() => setPanel(panel === 'delete' ? null : 'delete')} aria-expanded={panel === 'delete'} className="btn-pill btn-ghost-dark !py-2 !px-4 min-h-[44px] text-[11px] !text-[#e62b2b] !border-[#e62b2b]/50">Hapus topik</button>
          )}
        </div>
      )}
      {panel === 'extend' && (
        <div className="mt-3" role="group" aria-label="Tambah masa pajang">
          <p className="text-xs mb-2">Tambah masa pajang:</p>
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((d) => (
              <button type="button" key={d} onClick={() => extend(d)} disabled={busy} className="rounded-full border border-[#12283c]/25 px-4 min-h-[44px] text-xs font-bold hover:bg-[#12283c] hover:text-[#f2efe6] disabled:opacity-50">+{d} hari</button>
            ))}
          </div>
        </div>
      )}
      {panel === 'delete' && (
        <div className="mt-3 rounded-xl bg-[#e62b2b]/10 border border-[#e62b2b]/30 p-4">
          <p className="text-sm">Hapus topik ini dari mading? Topik dan balasannya tidak tampil lagi.</p>
          <div className="flex gap-2 mt-3">
            <button type="button" onClick={() => setPanel(null)} disabled={busy} className="btn-pill btn-ghost-dark !py-2 !px-4 min-h-[44px] text-[11px] flex-1 sm:flex-none">Batal</button>
            <button type="button" onClick={remove} disabled={busy} className="btn-pill btn-red !py-2 !px-4 min-h-[44px] text-[11px] flex-1 sm:flex-none">{busy ? '…' : 'Ya, hapus'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function TopicDetail({ topicId, onBack, communities }) {
  const toast = useToast();
  const { data: topic, loading, error, refetch } = useApi((signal) => api.get(`/discussions/${topicId}`, { signal }), [topicId]);
  const [reply, setReply] = useState('');
  const [communityId, setCommunityId] = useState('');
  const [sending, setSending] = useState(false);
  const [confirmReply, setConfirmReply] = useState(null);

  const send = async () => {
    if (!reply.trim() || sending) return;
    setSending(true);
    try {
      await api.post(`/discussions/${topicId}/replies`, { text: reply.trim(), community_id: communityId || null });
      setReply('');
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  const deleteReply = async (id) => {
    try {
      await api.delete(`/discussions/replies/${id}`);
      toast.success('Balasan dihapus');
      setConfirmReply(null);
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <div className="dash-item mb-6"><button type="button" onClick={onBack} className="btn-pill btn-ghost-dark !py-3 !px-5 text-[10px]">← KEMBALI KE MADING</button></div>
      {loading && !topic && <div className="card-light p-8"><SkeletonLines count={4} /></div>}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {topic && (
        <>
          <div className="dash-item rounded-xl p-8 md:p-10 mb-6 text-[#12283c]" style={{ background: topic.color }}>
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <span className="chip-mono border-0 bg-[#12283c] text-[#f2efe6]">{topic.category}</span>
              <span className="font-mono text-[9px] opacity-60">{timeAgo(topic.created_at)}</span>
            </div>
            <h1 className="text-2xl md:text-4xl font-black tracking-tight leading-tight mb-3 whitespace-pre-line break-words">{topic.text}</h1>
            <p className="font-mono text-[10px] opacity-60">
              DITEMPEL OLEH {topic.author_name?.toUpperCase()}{topic.community_name ? ` · ${topic.community_name.toUpperCase()}` : ''}
            </p>
          </div>
          <TopicActions topic={topic} onChanged={refetch} onDeleted={onBack} />
          <h3 className="text-xl font-black mb-4">{topic.replies.length} BALASAN</h3>
          <div className="space-y-4 mb-6">
            {topic.replies.map((r) => (
              <div key={r.id} className="dash-item card-light p-5 flex items-start gap-3">
                <span className="w-10 h-10 rounded-full bg-[#e62b2b] text-white font-black flex items-center justify-center shrink-0">{initialOf(r.author_name)}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm">
                    {r.author_name}{' '}
                    <span className="font-mono text-[9px] opacity-50">{r.community_name ? `· ${r.community_name} ` : ''}· {timeAgo(r.created_at)}</span>
                  </p>
                  <p className="text-sm leading-relaxed mt-1 whitespace-pre-line break-words">{r.text}</p>
                  {r.can_delete && (confirmReply === r.id ? (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs">Hapus balasan ini?</span>
                      <button type="button" onClick={() => setConfirmReply(null)} className="rounded-full border border-[#12283c]/25 px-3 min-h-[44px] text-[11px] font-bold">Batal</button>
                      <button type="button" onClick={() => deleteReply(r.id)} className="rounded-full bg-[#e62b2b] text-white px-3 min-h-[44px] text-[11px] font-bold">Ya, hapus</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setConfirmReply(r.id)} className="mt-1 min-h-[44px] font-mono text-[10px] font-bold text-[#e62b2b] underline underline-offset-2">HAPUS</button>
                  ))}
                </div>
              </div>
            ))}
            {topic.replies.length === 0 && (
              <p className="dash-item rounded-xl border-2 border-dashed border-[#12283c]/25 p-6 text-center font-mono text-xs opacity-50">BELUM ADA BALASAN — JADI YANG PERTAMA MENJAWAB.</p>
            )}
          </div>
          <div className="dash-item card-light p-6">
            <label className="field-label" htmlFor="mading-reply">Tulis Balasan</label>
            <textarea id="mading-reply" value={reply} onChange={(e) => setReply(e.target.value.slice(0, 1000))} className="input-line h-24 resize-none" placeholder="Tanggapi topik ini..." />
            {communities.length > 0 && (
              <div className="mt-4">
                <label className="field-label" htmlFor="mading-reply-comm">Balas atas nama (opsional)</label>
                <select id="mading-reply-comm" value={communityId} onChange={(e) => setCommunityId(e.target.value)} className="input-line">
                  <option value="">Pribadi</option>
                  {communities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            <button type="button" onClick={send} disabled={!reply.trim() || sending} className={`btn-pill w-full mt-4 ${reply.trim() ? 'btn-red' : 'bg-[#12283c]/10 text-[#12283c]/40 cursor-not-allowed'}`}>
              {sending ? 'Mengirim…' : 'Kirim Balasan →'}
            </button>
          </div>
        </>
      )}
    </>
  );
}

function NewTopicForm({ onBack, onCreated, communities }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [category, setCategory] = useState('DISKUSI');
  const [duration, setDuration] = useState(7);
  const [communityId, setCommunityId] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const created = await api.post('/discussions', {
        text: text.trim(), category, duration_days: duration, community_id: communityId || null, ...randomPlacement(),
      });
      toast.success('Topik ditempel ke mading');
      onCreated(created);
    } catch (err) {
      toast.error(err.message);
      setSending(false);
    }
  };

  return (
    <>
      <div className="dash-item mb-6"><button type="button" onClick={onBack} className="btn-pill btn-ghost-dark !py-3 !px-5 text-[10px]">← KEMBALI KE MADING</button></div>
      <div className="dash-item card-light p-8 md:p-10 max-w-2xl">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">Buat Topik Baru</h1>
        <p className="text-xs text-[#12283c]/60 mb-6">Buat topik baru dan berdiskusi dengan komunitas lain!</p>
        <p className="field-label">Kategori</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {CATEGORIES.map((c) => (
            <button type="button" key={c} onClick={() => setCategory(c)} className={`chip-mono transition-colors ${category === c ? 'border-0 bg-[#e62b2b] text-white' : 'text-[#12283c] hover:border-[#e62b2b]'}`}>{c}</button>
          ))}
        </div>
        <label className="field-label" htmlFor="mading-new">Isi Topik</label>
        <textarea id="mading-new" value={text} onChange={(e) => setText(e.target.value.slice(0, 1000))} className="input-line h-28 resize-none" placeholder="Contoh: butuh ide buat acara 17-an..." />
        <p className="field-label mt-5" id="mading-duration-label">Lama dipajang</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="mading-duration-label">
          {DURATIONS.map((d) => (
            <button type="button" key={d} role="radio" aria-checked={duration === d} onClick={() => setDuration(d)} className={`rounded-full px-4 min-h-[44px] text-xs font-bold transition-colors ${duration === d ? 'bg-[#12283c] text-[#f2efe6]' : 'border border-[#12283c]/25 hover:border-[#12283c]'}`}>
              {d} hari
            </button>
          ))}
        </div>
        <p className="font-mono text-[10px] opacity-60 mt-2">Setelah itu topik hilang dari papan. Anda bisa memperpanjangnya dari halaman topik.</p>
        {communities.length > 0 && (
          <div className="mt-5">
            <label className="field-label" htmlFor="mading-new-comm">Tempel atas nama (opsional)</label>
            <select id="mading-new-comm" value={communityId} onChange={(e) => setCommunityId(e.target.value)} className="input-line">
              <option value="">Pribadi</option>
              {communities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        <button type="button" onClick={submit} disabled={!text.trim() || sending} className={`btn-pill w-full mt-5 ${text.trim() ? 'btn-red' : 'bg-[#12283c]/10 text-[#12283c]/40 cursor-not-allowed'}`}>
          {sending ? 'Menempel…' : 'Tempel ke Mading'}
        </button>
      </div>
    </>
  );
}

export default function MadingBoard({ user }) {
  const toast = useToast();
  const [view, setView] = useState('board');
  const [activeId, setActiveId] = useState(null);
  const { data, loading, error, refetch, setData } = useApi((signal) => api.get('/discussions', { signal, query: { limit: 50 } }), []);
  const { data: mine } = useApi((signal) => api.get('/communities', { signal, query: { mine: 'true', limit: 50 } }), []);
  const topics = data?.items || [];
  const communities = mine?.items || [];

  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const boardDrag = useRef({ down: false, sx: 0, sy: 0, bx: 0, by: 0 });
  const noteDrag = useRef({ id: null, el: null, sx: 0, sy: 0, ox: 0, oy: 0, nx: 0, ny: 0, moved: false });
  const pan = useRef({ x: 0, y: 0 });

  const clampPan = (x, y) => {
    const vp = wrapRef.current;
    const minX = vp ? Math.min(0, vp.clientWidth - CANVAS_W) : -CANVAS_W;
    const minY = vp ? Math.min(0, vp.clientHeight - CANVAS_H) : -CANVAS_H;
    return { x: Math.max(minX, Math.min(0, x)), y: Math.max(minY, Math.min(0, y)) };
  };

  // Mulai dari pojok kiri atas: catatan seed & sebagian besar catatan baru ada di sana
  // (dulu dipusatkan, sehingga catatan di pojok tersembunyi sampai papan digeser).
  useEffect(() => {
    if (view !== 'board' || !wrapRef.current) return;
    const p = clampPan(0, 0);
    pan.current = p;
    gsap.set(canvasRef.current, { x: p.x, y: p.y });
  }, [view, topics.length]);

  useEffect(() => {
    if (view !== 'board' || topics.length === 0) return;
    gsap.fromTo('.mading-note',
      { autoAlpha: 0, y: -70, scale: 0.85, rotation: (i, el) => (parseFloat(el.dataset.rot) || 0) - 6 },
      { autoAlpha: 1, y: 0, scale: 1, rotation: (i, el) => parseFloat(el.dataset.rot) || 0, duration: 0.6, stagger: 0.06, ease: 'back.out(1.6)', overwrite: true });
  }, [view, topics.length]);

  const onBoardDown = (e) => Object.assign(boardDrag.current, { down: true, sx: e.clientX, sy: e.clientY, bx: pan.current.x, by: pan.current.y });
  const onBoardMove = (e) => {
    const d = boardDrag.current;
    if (!d.down) return;
    const p = clampPan(d.bx + e.clientX - d.sx, d.by + e.clientY - d.sy);
    pan.current = p;
    gsap.set(canvasRef.current, { x: p.x, y: p.y });
  };
  const onBoardUp = () => { boardDrag.current.down = false; };

  const isMine = (t) => Number(t.author_id) === Number(user?.id);

  const onNoteDown = (e, t) => {
    e.stopPropagation();
    Object.assign(noteDrag.current, { id: t.id, el: e.currentTarget, sx: e.clientX, sy: e.clientY, ox: t.pos_x, oy: t.pos_y, nx: t.pos_x, ny: t.pos_y, moved: false });
    e.currentTarget.setPointerCapture(e.pointerId);
    if (isMine(t)) gsap.to(e.currentTarget, { scale: 1.07, rotation: 0, zIndex: 50, duration: 0.2, ease: 'power2.out' });
  };
  const onNoteMove = (e, t) => {
    const d = noteDrag.current;
    if (d.id !== t.id || !isMine(t)) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (Math.abs(dx) + Math.abs(dy) > 6) d.moved = true;
    if (!d.moved) return;
    d.nx = Math.max(8, Math.min(CANVAS_W - 270, d.ox + dx));
    d.ny = Math.max(8, Math.min(CANVAS_H - 170, d.oy + dy));
    gsap.set(d.el, { left: d.nx, top: d.ny });
  };
  const onNoteUp = async (e, t) => {
    const d = noteDrag.current;
    if (d.id !== t.id) return;
    d.id = null;
    if (isMine(t)) gsap.to(d.el, { scale: 1, rotation: t.rotation, zIndex: 1, duration: 0.5, ease: 'elastic.out(1,0.4)' });
    if (!d.moved) {
      setActiveId(t.id);
      setView('detail');
      return;
    }
    const pos = { pos_x: Math.round(d.nx), pos_y: Math.round(d.ny) };
    setData((prev) => prev && { ...prev, items: prev.items.map((x) => (x.id === t.id ? { ...x, ...pos } : x)) });
    try {
      await api.patch(`/discussions/${t.id}/position`, pos);
    } catch (err) {
      toast.error(`Posisi belum tersimpan: ${err.message}`);
    }
  };

  if (view === 'detail' && activeId) {
    return <TopicDetail topicId={activeId} communities={communities} onBack={() => { setView('board'); refetch(); }} />;
  }
  if (view === 'tempel') {
    return <NewTopicForm communities={communities} onBack={() => setView('board')} onCreated={() => { setView('board'); refetch(); }} />;
  }

  return (
    <>
      <div className="dash-item flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight">Mading Komunitas</h1>
          <p className="text-sm text-[#12283c]/60 mt-2">Mulai diskusi bersama komunitas lain! Geser catatanmu sendiri untuk merapikan papan.</p>
        </div>
        <button type="button" onClick={() => setView('tempel')} className="btn-pill btn-red">Buat Topik</button>
      </div>
      {error && <ErrorState error={error} onRetry={refetch} />}
      {loading && !data && <div className="card-light p-8"><SkeletonLines count={5} /></div>}
      {data && topics.length === 0 && (
        <EmptyState
          title="Mading masih kosong"
          description="Tempel pertanyaan atau info pertama agar komunitas lain bisa ikut menanggapi."
          action={<button type="button" onClick={() => setView('tempel')} className="btn-pill btn-red">Buat Topik Pertama</button>}
        />
      )}
      {topics.length > 0 && (
        <div
          ref={wrapRef}
          onPointerDown={onBoardDown}
          onPointerMove={onBoardMove}
          onPointerUp={onBoardUp}
          onPointerCancel={onBoardUp}
          className="dash-item relative h-[560px] rounded-xl overflow-hidden cursor-grab active:cursor-grabbing select-none bg-[#12283c]"
          style={{ backgroundImage: 'radial-gradient(rgba(242,239,230,0.10) 1px, transparent 1px)', backgroundSize: '24px 24px', touchAction: 'none' }}
        >
          <div ref={canvasRef} className="absolute top-0 left-0" style={{ width: CANVAS_W, height: CANVAS_H }}>
            {topics.map((t) => (
              <div
                key={t.id}
                data-rot={t.rotation}
                role="button"
                tabIndex={0}
                aria-label={`Buka topik: ${t.text.slice(0, 60)}`}
                onKeyDown={(e) => { if (e.key === 'Enter') { setActiveId(t.id); setView('detail'); } }}
                onPointerDown={(e) => onNoteDown(e, t)}
                onPointerMove={(e) => onNoteMove(e, t)}
                onPointerUp={(e) => onNoteUp(e, t)}
                onPointerCancel={(e) => onNoteUp(e, t)}
                className={`mading-note absolute w-64 p-5 rounded-sm shadow-[0_10px_30px_rgba(0,0,0,0.35)] text-[#12283c] ${isMine(t) ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
                style={{ left: t.pos_x, top: t.pos_y, background: t.color, touchAction: 'none' }}
              >
                <span className="absolute -top-3 left-1/2 -ml-2 w-4 h-4 rounded-full bg-[#e62b2b] border-2 border-[#12283c]" />
                <div className="flex items-center justify-between mb-2">
                  <span className="chip-mono border-0 bg-[#12283c] text-[#f2efe6]">{t.category}</span>
                  <span className="font-mono text-[8px] opacity-50">{timeAgo(t.created_at)}</span>
                </div>
                <p className="text-xs font-bold leading-relaxed mb-3 line-clamp-5">{t.text}</p>
                {t.expires_at && (
                  <p className={`font-mono text-[8px] font-bold mb-1 ${endingSoon(t.expires_at) ? 'text-[#e62b2b]' : 'opacity-50'}`}>⏳ {timeLeft(t.expires_at)}</p>
                )}
                <div className="flex items-center justify-between font-mono text-[9px] opacity-60">
                  <span className="truncate">{t.author_name}{t.community_name ? ` · ${t.community_name}` : ''}</span>
                  <span className="shrink-0">💬 {t.replies_count}</span>
                </div>
                {isMine(t) && <span className="absolute bottom-1.5 right-2 font-mono text-[8px] opacity-40">⠿ geser</span>}
              </div>
            ))}
          </div>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 chip-mono border-0 bg-[#e62b2b] text-white pointer-events-none">DRAG PAPAN UNTUK MELIHAT TOPIK</div>
        </div>
      )}
    </>
  );
}
