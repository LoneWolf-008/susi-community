import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { Send, X, Sparkles } from 'lucide-react';

/* ===== KNOWLEDGE BASE AI (keyword → response) ===== */
const KB = [
  {
    keys: ['halo', 'hai', 'hi', 'hello', 'pagi', 'siang', 'sore'],
    reply: 'Halo! Saya Agen SUSI AI 👋\nSiap bantu navigasi platform SUSI. Mau tanya soal apa hari ini?',
  },
  {
    keys: ['proyek', 'status', 'progress', 'lacak', 'lacak proyek'],
    reply: 'Untuk melihat progres proyek Anda, buka tab **Beranda** → klik kartu proyek yang ingin dipantau.\n\nSetiap proyek punya 4 fase:\n• DITERIMA → DIKERJAKAN → SELESAI → VERIFIKASI\n\nProgres visual akan muncul otomatis di kartu proyek.',
  },
  {
    keys: ['verifikasi', 'selesai', 'konfirmasi', 'testimoni'],
    reply: 'SUSI pakai **verifikasi dua arah** (langkah 08):\n\n1. Talenta menandai proyek selesai\n2. Komunitas mengonfirmasi + beri testimoni\n\nReputasi talenta baru bertambah **setelah kedua pihak konfirmasi**. Ini menjaga kejujuran sistem.',
  },
  {
    keys: ['talenta', 'reputasi', 'poin', 'level'],
    reply: 'Sistem Reputasi Talenta:\n\n• Setiap proyek terverifikasi = +1 poin\n• Level: Talenta Muda → Terpercaya → Ahli\n• Reputasi tinggi = prioritas dipilih komunitas\n\nPoin bisa dicek di tab **Profil**.',
  },
  {
    keys: ['cara kerja', 'alur', 'langkah', '8 langkah', 'proses'],
    reply: 'SUSI bekerja dalam **8 langkah**:\n\n1. Komunitas cerita masalah\n2. AgenSUSI data lapangan\n3. Masuk katalog terbuka\n4. Talenta mengajukan diri\n5. Komunitas pilih talenta\n6. Kesepakatan target\n7. Pengerjaan\n8. Verifikasi dua arah\n\nScroll ke section "Cara Kerja" untuk detail visual.',
  },
  {
    keys: ['komunitas', 'daftar', 'gabung', 'ikut'],
    reply: 'Komunitas bisa bergabung gratis dengan:\n\n1. Daftar via halaman **Masuk/Daftar** → pilih peran Komunitas\n2. Lengkapi profil\n3. Ajukan pengaduan/kebutuhan di dasbor\n\nButuh bantuan lapangan? AgenSUSI siap datang ke lokasi Anda.',
  },
  {
    keys: ['mading', 'diskusi', 'forum', 'topik'],
    reply: '**Mading Komunitas** adalah ruang diskusi lintas komunitas:\n\n• Drag & drop untuk melihat topik\n• Tempel topik baru (Diskusi/Tanya/Info)\n• Balas topik komunitas lain\n\nAkses via tab **Komunitas** di sidebar.',
  },
  {
    keys: ['map', 'peta', 'lokasi', 'cari komunitas'],
    reply: 'Tab **Map** menampilkan komunitas terdaftar di Bandung:\n\n• Titik merah = komunitas existing\n• Titik mint = komunitas Anda\n• Klik titik untuk lihat detail + rute Google Maps\n\nAnda juga bisa tandai komunitas baru dari tab ini.',
  },
  {
    keys: ['agen', 'agensusi', 'lapangan', 'kunjungan'],
    reply: '**AgenSUSI** adalah tim lapangan kami yang:\n\n• Datang langsung ke komunitas\n• Mencatat kebutuhan secara personal\n• Menjembatani komunitas yang belum familiar digital\n\nKalau butuh kunjungan, hubungi via WhatsApp di halaman Tentang Kami.',
  },
  {
    keys: ['biaya', 'bayar', 'gratis', 'harga', 'mahal'],
    reply: '**SUSI 100% gratis** untuk komunitas maupun talenta.\n\n• Komunitas dapat solusi tanpa biaya\n• Talenta dapat portofolio + poin reputasi\n\nPlatform kami didukung SMKN 4 Bandung sebagai proyek sosial-edukasi.',
  },
  {
    keys: ['bantuan', 'help', 'tolong', 'support'],
    reply: 'Saya di sini untuk bantu! Beberapa hal yang bisa saya jawab:\n\n• Cara kerja platform\n• Status proyek & verifikasi\n• Sistem reputasi talenta\n• Mading komunitas & Map\n\nAtau ketik pertanyaan spesifik Anda 😊',
  },
];

const QUICK = [
  { q: 'Bagaimana cara kerja SUSI?', icon: '🧭' },
  { q: 'Status proyek saya?', icon: '📊' },
  { q: 'Apa itu verifikasi dua arah?', icon: '✓' },
  { q: 'Cara naik level reputasi?', icon: '⭐' },
];

/* ===== LOGIKA PENCARIAN JAWABAN ===== */
function findReply(text) {
  const q = text.toLowerCase();
  for (const item of KB) {
    if (item.keys.some((k) => q.includes(k))) return item.reply;
  }
  return 'Hmm, saya belum paham pertanyaan itu 🤔\n\nCoba tanyakan soal:\n• Cara kerja SUSI\n• Status proyek & verifikasi\n• Reputasi talenta\n• Mading komunitas\n\nAtau hubungi tim via **WhatsApp** di halaman Tentang Kami untuk bantuan manusia.';
}

export default function AiAgent({ role = 'komunitas' }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const panelRef = useRef(null);
  const btnRef = useRef(null);
  const bodyRef = useRef(null);
  const greetSent = useRef(false);

  /* ===== KIRIM PESAN ===== */
  const pushMsg = (who, text) => {
    setMsgs((m) => [...m, { who, text, id: Date.now() + Math.random() }]);
  };

  /* ===== ANIMASI BUKA / TUTUP ===== */
  useEffect(() => {
    if (open) {
      gsap.to(btnRef.current, { scale: 0, autoAlpha: 0, duration: 0.2, ease: 'power2.in' });
      if (panelRef.current) {
        gsap.fromTo(panelRef.current,
          { y: 40, autoAlpha: 0, scale: 0.96 },
          { y: 0, autoAlpha: 1, scale: 1, duration: 0.4, ease: 'power3.out' }
        );
        gsap.fromTo('.ai-head', { y: -12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.35, ease: 'power3.out', delay: 0.05 });
        gsap.fromTo('.ai-quick', { y: 12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.06, duration: 0.35, ease: 'power3.out', delay: 0.1 });
      }

      /* Salam pertama (sekali per sesi panel) */
      if (!greetSent.current) {
        greetSent.current = true;
        const greet = role === 'talent'
          ? 'Halo Talenta! 🚀\nSaya Agen SUSI AI. Butuh info soal katalog proyek, reputasi, atau verifikasi? Tanyakan saja!'
          : 'Halo Komunitas! 👋\nSaya Agen SUSI AI. Mau tanya soal pengajuan proyek, mading, atau peta komunitas?';
        setTimeout(() => setMsgs((m) => [...m, { who: 'ai', text: greet, id: Date.now() }]), 400);
      }
    } else {
      // Pastikan tombol floating selalu muncul kembali
      gsap.to(btnRef.current, { scale: 1, autoAlpha: 1, duration: 0.35, ease: 'back.out(1.7)', overwrite: true });
    }
  }, [open, role]);

  /* ===== AUTO SCROLL KE BAWAH ===== */
  useEffect(() => {
    if (bodyRef.current) {
      gsap.to(bodyRef.current, { scrollTop: bodyRef.current.scrollHeight, duration: 0.4, ease: 'power2.out' });
    }
  }, [msgs, typing]);

  const send = (text) => {
    const t = (text ?? input).trim();
    if (!t) return;
    pushMsg('user', t);
    setInput('');
    setTyping(true);

    /* Simulasi "berpikir" (diganti streaming jawaban nyata di T14) */
    setTimeout(() => {
      const reply = findReply(t);
      setTyping(false);
      pushMsg('ai', reply);
    }, 1000);
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  /* ===== RENDER TEXT WITH BOLD (**) ===== */
  const renderText = (text) => {
    return text.split('\n').map((line, i) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <p key={i} className="leading-relaxed">
          {parts.map((p, j) =>
            p.startsWith('**') && p.endsWith('**') ? (
              <strong key={j} className="font-bold">{p.slice(2, -2)}</strong>
            ) : (
              <span key={j}>{p}</span>
            )
          )}
        </p>
      );
    });
  };

  return (
    <>
      {/* ===== FLOATING BUTTON (pojok kanan bawah) ===== */}
      <button
        ref={btnRef}
        onClick={() => setOpen(true)}
        aria-label="Buka Agen SUSI AI"
        className="group fixed bottom-6 right-6 z-[400] w-14 h-14 rounded-full bg-[#e62b2b] hover:bg-[#12283c] text-white flex items-center justify-center shadow-[0_10px_30px_rgba(230,43,43,0.4)] hover:shadow-[0_10px_30px_rgba(18,40,60,0.5)] transition-all duration-300 active:scale-90"
      >
        {/* Icon breathing */}
        <Sparkles className="w-6 h-6 fill-current group-hover:scale-110 group-hover:rotate-12 transition-transform duration-300" strokeWidth={2.5} />
        {/* Pulse ring */}
        <span className="absolute inset-0 rounded-full border-2 border-[#e62b2b] animate-ping opacity-40" />
        {/* Label */}
        <span className="absolute right-full mr-3 whitespace-nowrap font-mono text-[10px] font-bold tracking-widest text-[#12283c] bg-[#f2efe6] border border-[#12283c]/15 px-3 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          TANYA SUSI AI
        </span>
      </button>

      {/* ===== CHAT PANEL ===== */}
      {open && (
        <div
          ref={panelRef}
          className="fixed bottom-6 right-6 z-[400] w-[calc(100vw-3rem)] max-w-[400px] h-[560px] max-h-[calc(100vh-3rem)] flex flex-col rounded-2xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.35)] border border-[#12283c]/15"
          style={{ visibility: 'hidden', opacity: 0 }}
        >
          {/* HEADER — navy gelap */}
          <div className="ai-head bg-[#0e2233] text-[#f2efe6] px-5 py-4 flex items-center gap-3 shrink-0">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-[#e62b2b] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white fill-white" strokeWidth={2.5} />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#c9ecd9] rounded-full border-2 border-[#0e2233]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-sm tracking-tight">SUSI AI</p>
              <p className="font-mono text-[9px] opacity-60 flex items-center gap-1.5">
                <Sparkles className="w-2.5 h-2.5" />
                ONLINE
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-[#e62b2b] hover:border-[#e62b2b] transition-colors"
              aria-label="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* BODY — krem */}
          <div ref={bodyRef} className="flex-1 overflow-y-auto bg-[#f2efe6] p-5 space-y-3">
            {msgs.map((m) => (
              <div
                key={m.id}
                className={`ai-msg flex ${m.who === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                    m.who === 'user'
                      ? 'bg-[#e62b2b] text-white rounded-br-sm'
                      : 'bg-white text-[#12283c] border border-[#12283c]/10 rounded-bl-sm shadow-sm'
                  }`}
                >
                  <div className="space-y-1.5">{renderText(m.text)}</div>
                </div>
              </div>
            ))}

            {/* TYPING INDICATOR */}
            {typing && (
              <div className="flex justify-start ai-msg">
                <div className="bg-white border border-[#12283c]/10 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5 shadow-sm">
                  <span className="w-2 h-2 bg-[#12283c]/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-[#12283c]/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-[#12283c]/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
          </div>

          {/* QUICK SUGGESTIONS */}
          {msgs.length <= 2 && (
            <div className="px-4 py-3 bg-[#f2efe6] border-t border-[#12283c]/10 flex gap-2 overflow-x-auto shrink-0">
              {QUICK.map((q, i) => (
                <button
                  key={i}
                  onClick={() => send(q.q)}
                  className="ai-quick shrink-0 rounded-full bg-white border border-[#12283c]/15 px-3.5 py-2 text-[11px] font-bold text-[#12283c] hover:bg-[#12283c] hover:text-[#f2efe6] hover:border-[#12283c] transition-all flex items-center gap-1.5"
                >
                  <span>{q.icon}</span>
                  <span className="whitespace-nowrap">{q.q}</span>
                </button>
              ))}
            </div>
          )}

          {/* INPUT */}
          <div className="bg-white border-t-2 border-[#12283c]/10 p-3 flex items-center gap-2 shrink-0">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Ketik pertanyaan..."
              className="flex-1 bg-[#f2efe6] rounded-full px-4 py-2.5 text-sm text-[#12283c] placeholder-[#12283c]/40 outline-none border border-[#12283c]/10 focus:border-[#e62b2b] transition-colors"
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || typing}
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all ${
                input.trim() && !typing
                  ? 'bg-[#e62b2b] text-white hover:bg-[#12283c]'
                  : 'bg-[#12283c]/10 text-[#12283c]/30 cursor-not-allowed'
              }`}
              aria-label="Kirim"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          {/* FOOTER KECIL */}
          <div className="bg-[#0e2233] px-4 py-1.5 text-center shrink-0">
            <p className="font-mono text-[8px] font-bold tracking-widest text-[#f2efe6]/50">
              DIBUAT OLEH SUSI COMMUNITY · v1.0 Beta
            </p>
          </div>
        </div>
      )}
    </>
  );
}