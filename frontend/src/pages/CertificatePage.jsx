import { useParams } from 'react-router';
import { BadgeCheck, Printer, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../hooks/useApi';
import { useNavigateTo } from '../context/transitionContext';
import { normalizeCode, verificationPath } from '../lib/certification';
import { formatDate } from '../lib/format';
import { SkeletonLines } from '../components/ui/Skeleton';

// Sertifikat talenta (U5) siap cetak: A4 lanskap lewat CSS print (index.css: .certificate-sheet), tanpa
// library PDF. Ukuran huruf memakai satuan cqw (lebar lembar), jadi tata letaknya sama di layar dan kertas.
// Sertifikat yang dicabut tetap tampil dengan tanda "TIDAK BERLAKU".

function Sheet({ cert }) {
  const revoked = cert.status === 'REVOKED';
  const verifyUrl = `${window.location.host}${verificationPath(cert.code)}`;
  return (
    <div className="certificate-sheet relative mx-auto w-full max-w-[1100px] aspect-[297/210] overflow-hidden bg-[#fdfcf7] text-[#12283c] shadow-[0_25px_60px_rgba(0,0,0,0.25)]" style={{ containerType: 'inline-size' }}>
      {/* Bingkai */}
      <div className="absolute inset-[2.2cqw] border-[length:0.3cqw] border-[#12283c]" aria-hidden="true" />
      <div className="absolute inset-[3cqw] border-[length:0.1cqw] border-[#12283c]/40" aria-hidden="true" />
      <div className="absolute left-[2.2cqw] top-[2.2cqw] w-[14cqw] h-[1.2cqw] bg-[#e62b2b]" aria-hidden="true" />
      <div className="absolute right-[2.2cqw] bottom-[2.2cqw] w-[14cqw] h-[1.2cqw] bg-[#e62b2b]" aria-hidden="true" />

      <div className="absolute inset-[5.5cqw] flex flex-col">
        <div className="flex items-start justify-between gap-[2cqw]">
          <p className="font-black tracking-tight leading-none text-[length:2.6cqw]">SUSI <span className="text-[#e62b2b]">Community.</span></p>
          <p className="font-mono font-bold tracking-[0.15em] text-[length:1.05cqw] text-right">NO. {cert.code}</p>
        </div>

        <div className="flex-1 flex flex-col justify-center">
          <p className="font-mono font-bold tracking-[0.35em] text-[length:1.15cqw] text-[#12283c]/60">SERTIFIKAT KOMPETENSI KOMUNITAS</p>
          <h1 className="font-black tracking-[-0.02em] leading-none text-[length:5.6cqw] mt-[0.8cqw]">Tersertifikasi SUSI<span className="text-[#e62b2b]">.</span></h1>
          <p className="text-[length:1.6cqw] mt-[2.4cqw] text-[#12283c]/70">diberikan kepada</p>
          <p className="font-black leading-tight text-[length:4.4cqw] mt-[0.4cqw] pb-[0.6cqw] border-b-[length:0.2cqw] border-[#12283c] self-start max-w-full break-words">{cert.name}</p>
          <p className="font-black text-[length:2.1cqw] mt-[1.4cqw] text-[#e62b2b]">Bidang {cert.focus_label}</p>
          <p className="text-[length:1.45cqw] leading-relaxed mt-[1.2cqw] max-w-[68cqw] text-[#12283c]/80">
            Telah menyelesaikan {cert.project_count} proyek digital untuk komunitas melalui SUSI Community. Setiap proyek
            diverifikasi oleh komunitas penerima, dan pengajuan sertifikasi ditinjau oleh tim SUSI.
          </p>
        </div>

        <div className="flex items-end justify-between gap-[3cqw]">
          <dl className="grid grid-cols-3 gap-[3cqw] font-mono text-[length:1.05cqw]">
            <div>
              <dt className="font-bold tracking-[0.2em] text-[#12283c]/55">TANGGAL TERBIT</dt>
              <dd className="font-bold text-[length:1.35cqw] mt-[0.3cqw]">{formatDate(cert.issued_at)}</dd>
            </div>
            <div>
              <dt className="font-bold tracking-[0.2em] text-[#12283c]/55">PROYEK TERVERIFIKASI</dt>
              <dd className="font-bold text-[length:1.35cqw] mt-[0.3cqw]">{cert.project_count}</dd>
            </div>
            <div>
              <dt className="font-bold tracking-[0.2em] text-[#12283c]/55">CEK KEASLIAN</dt>
              <dd className="font-bold text-[length:1.1cqw] mt-[0.3cqw] break-all">{verifyUrl}</dd>
            </div>
          </dl>
          <div className="shrink-0 w-[11cqw] h-[11cqw] rounded-full border-[length:0.3cqw] border-[#12283c] flex flex-col items-center justify-center text-center">
            <ShieldCheck style={{ width: '3.6cqw', height: '3.6cqw' }} aria-hidden="true" />
            <p className="font-mono font-black text-[length:0.85cqw] tracking-[0.15em] mt-[0.4cqw] leading-tight">SUSI<br />TERVERIFIKASI</p>
          </div>
        </div>
      </div>

      {revoked && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
          <p className="rotate-[-14deg] border-[length:0.5cqw] border-[#e62b2b] text-[#e62b2b] bg-[#fdfcf7]/80 px-[3cqw] py-[1cqw] font-black tracking-[0.1em] text-[length:7cqw]">TIDAK BERLAKU</p>
        </div>
      )}
    </div>
  );
}

export default function CertificatePage() {
  const { code: raw } = useParams();
  const code = normalizeCode(raw);
  const navigateTo = useNavigateTo();
  const { data, error } = useApi(
    (signal) => api.get(`/public/certificates/${code}`, { signal }),
    [code],
    { enabled: Boolean(code) },
  );
  const notFound = !code || error?.status === 404;
  const revoked = data?.status === 'REVOKED';

  return (
    <div className="certificate-page min-h-dvh bg-[#e9e5d8] text-[#12283c] px-4 py-6 md:py-10">
      <div className="no-print max-w-[1100px] mx-auto mb-5 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => navigateTo('home')} className="font-black tracking-tight text-lg min-h-[44px]">
          SUSI <span className="text-[#e62b2b]">Community.</span>
        </button>
        {data && (
          <div className="flex flex-wrap gap-2">
            <a href={verificationPath(data.code)} className="btn-pill btn-ghost-dark min-h-[44px] !py-2.5 !px-5 text-[10px]">Halaman verifikasi</a>
            <button type="button" onClick={() => window.print()} className="btn-pill btn-red min-h-[44px] !py-2.5 !px-5 text-[10px] inline-flex items-center gap-2">
              <Printer className="w-4 h-4" aria-hidden="true" /> Cetak / Simpan PDF
            </button>
          </div>
        )}
      </div>

      {!notFound && !data && !error && <div className="max-w-xl mx-auto"><SkeletonLines count={5} /></div>}
      {error && !notFound && <p role="alert" className="max-w-xl mx-auto text-sm">{error.message}</p>}
      {notFound && (
        <div className="max-w-xl mx-auto text-center py-16">
          <h1 className="text-3xl font-black">Sertifikat tidak ditemukan</h1>
          <p className="text-sm opacity-70 mt-2">Periksa kembali kode pada tautan. Kode berbentuk SUSI-XXXX-XXXX.</p>
        </div>
      )}

      {data && (
        <>
          {/* Ringkasan terbaca di layar kecil (lembar sertifikat ikut mengecil). */}
          <div className={`no-print sm:hidden max-w-[1100px] mx-auto mb-4 rounded-xl p-4 flex items-start gap-3 ${revoked ? 'bg-[#e62b2b] text-white' : 'bg-[#c9ecd9]'}`}>
            <BadgeCheck className="w-6 h-6 shrink-0" aria-hidden="true" />
            <div className="text-sm">
              <p className="font-black">{revoked ? 'Sertifikat tidak berlaku' : 'Sertifikat berlaku'}</p>
              <p>{data.name} · Bidang {data.focus_label}</p>
              <p className="font-mono text-[11px] mt-1">{data.code} · {formatDate(data.issued_at)}</p>
            </div>
          </div>
          {revoked && (
            <p className="no-print hidden sm:block max-w-[1100px] mx-auto mb-4 rounded-xl bg-[#e62b2b] text-white px-4 py-3 text-sm font-bold" role="status">
              Sertifikat ini sudah dicabut{data.revoked_at ? ` pada ${formatDate(data.revoked_at)}` : ''} dan tidak berlaku.
            </p>
          )}
          <Sheet cert={data} />
          <p className="no-print max-w-[1100px] mx-auto mt-4 text-[12px] opacity-70">
            Saat mencetak, pilih ukuran kertas A4, orientasi lanskap, margin "Tidak ada", dan aktifkan "Grafik latar belakang" agar warna ikut tercetak.
          </p>
        </>
      )}
    </div>
  );
}
