import { useState } from 'react';
import { useParams } from 'react-router';
import { BadgeCheck, ShieldX, SearchX } from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../hooks/useApi';
import { useNavigateTo } from '../context/transitionContext';
import { certificatePath, normalizeCode, verificationPath } from '../lib/certification';
import { formatDate } from '../lib/format';
import { SkeletonLines } from '../components/ui/Skeleton';

// Verifikasi sertifikat talenta (U5), publik tanpa login: status berlaku/dicabut beserta nama, bidang,
// tanggal terbit, dan jumlah proyek. Tidak ada email atau kontak (backend memang tidak mengirimnya).

function CheckAnother({ initial }) {
  const navigateTo = useNavigateTo();
  const [value, setValue] = useState(initial ?? '');
  const [error, setError] = useState('');
  const submit = (e) => {
    e.preventDefault();
    const code = normalizeCode(value);
    if (!code) {
      setError('Format kode: SUSI-XXXX-XXXX');
      return;
    }
    setError('');
    navigateTo(verificationPath(code));
  };
  return (
    <form onSubmit={submit} className="mt-8 border-t border-[#12283c]/10 pt-6">
      <label htmlFor="cert-code" className="field-label">Cek kode sertifikat lain</label>
      <div className="flex gap-2">
        <input
          id="cert-code"
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, 20))}
          placeholder="SUSI-XXXX-XXXX"
          autoComplete="off"
          className="flex-1 min-w-0 min-h-[44px] rounded-full border border-[#12283c]/20 bg-white px-4 text-base font-mono uppercase outline-none focus:border-[#e62b2b]"
        />
        <button type="submit" className="btn-pill btn-red min-h-[44px] !px-5 shrink-0">Cek</button>
      </div>
      {error && <p role="alert" className="mt-2 text-[12px] font-bold text-[#e62b2b]">{error}</p>}
    </form>
  );
}

export default function VerifyCertificatePage() {
  const { code: raw } = useParams();
  const code = normalizeCode(raw);
  const { data, error } = useApi(
    (signal) => api.get(`/public/certificates/${code}`, { signal }),
    [code],
    { enabled: Boolean(code) },
  );
  const notFound = !code || error?.status === 404;
  const valid = data?.status === 'VALID';

  return (
    <main className="min-h-screen px-4 pt-28 pb-16 flex justify-center">
      <div className="w-full max-w-xl">
        <p className="font-mono text-[10px] font-bold tracking-[0.3em] text-[#f2efe6]/50 mb-4">VERIFIKASI SERTIFIKAT SUSI</p>
        <div className="rounded-2xl bg-[#f2efe6] text-[#12283c] p-6 md:p-10 shadow-2xl">
          {!notFound && !data && !error && <SkeletonLines count={5} />}
          {error && !notFound && <p role="alert" className="text-sm">{error.message}</p>}

          {notFound && (
            <div className="text-center" role="status">
              <SearchX className="w-12 h-12 mx-auto text-[#e62b2b]" aria-hidden="true" />
              <h1 className="text-2xl md:text-3xl font-black mt-3">Sertifikat tidak ditemukan</h1>
              <p className="text-sm opacity-70 mt-2">Periksa kembali kode pada sertifikat. Kode berbentuk SUSI-XXXX-XXXX.</p>
            </div>
          )}

          {data && (
            <>
              <div className={`rounded-xl p-5 flex items-start gap-4 ${valid ? 'bg-[#c9ecd9]' : 'bg-[#e62b2b] text-white'}`} role="status">
                {valid
                  ? <BadgeCheck className="w-10 h-10 shrink-0" aria-hidden="true" />
                  : <ShieldX className="w-10 h-10 shrink-0" aria-hidden="true" />}
                <div>
                  <h1 className="text-2xl md:text-3xl font-black leading-tight">{valid ? 'Sertifikat berlaku' : 'Sertifikat tidak berlaku'}</h1>
                  <p className="text-sm mt-1">
                    {valid
                      ? 'Diterbitkan SUSI Community dan belum pernah dicabut.'
                      : `Sertifikat ini sudah dicabut${data.revoked_at ? ` pada ${formatDate(data.revoked_at)}` : ''}.`}
                  </p>
                </div>
              </div>
              <dl className="mt-6 divide-y divide-[#12283c]/10 text-sm">
                {[
                  ['Nama', data.name],
                  ['Bidang', data.focus_label],
                  ['Tanggal terbit', formatDate(data.issued_at)],
                  ['Proyek terverifikasi', `${data.project_count} proyek`],
                  ['Kode', data.code],
                  ['Penerbit', data.issuer],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 py-3">
                    <dt className="label-mono shrink-0">{label}</dt>
                    <dd className={`font-bold text-right break-words min-w-0 ${label === 'Kode' ? 'font-mono' : ''}`}>{value}</dd>
                  </div>
                ))}
              </dl>
              <a href={certificatePath(data.code)} className="btn-pill btn-navy w-full mt-6 min-h-[44px]">Lihat sertifikat →</a>
            </>
          )}

          <CheckAnother initial={code ?? raw} />
        </div>
      </div>
    </main>
  );
}
