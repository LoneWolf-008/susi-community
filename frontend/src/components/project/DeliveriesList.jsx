import { useState } from 'react';
import { api } from '../../lib/api';
import { useToast } from '../../context/toastContext';
import { formatDateTime, formatBytes } from '../../lib/format';

const fileNameOf = (path) => (path || '').split('/').pop();

/** Riwayat pengiriman hasil (tautan dan/atau berkas yang diunduh dengan login). */
export default function DeliveriesList({ deliveries = [], dark = false }) {
  const toast = useToast();
  const [downloading, setDownloading] = useState(null);

  const download = async (d) => {
    setDownloading(d.id);
    try {
      await api.download(`/upload/delivery/${fileNameOf(d.file_path)}`, d.file_name || fileNameOf(d.file_path));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDownloading(null);
    }
  };

  if (deliveries.length === 0) {
    return <p className={`text-sm ${dark ? 'text-[#f2efe6]/60' : 'text-[#12283c]/60'}`}>Belum ada hasil yang dikirim.</p>;
  }

  return (
    <ul className="space-y-3">
      {deliveries.map((d) => (
        <li key={d.id} className={`rounded-xl border p-4 ${dark ? 'border-white/15' : 'border-[#12283c]/15'}`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="font-mono text-[10px] font-bold">PENGIRIMAN #{d.round_no}</p>
            <p className="font-mono text-[10px] opacity-60">{formatDateTime(d.delivered_at)}</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            {d.link_url && (
              <a href={d.link_url} target="_blank" rel="noreferrer noopener" className="font-mono text-xs font-bold text-[#e62b2b] underline break-all">
                BUKA HASIL / DEMO ↗
              </a>
            )}
            {d.file_path && (
              <button type="button" onClick={() => download(d)} disabled={downloading === d.id} className="font-mono text-xs font-bold text-[#e62b2b] underline disabled:opacity-50">
                {downloading === d.id ? 'MENGUNDUH…' : `UNDUH ${d.file_name || 'BERKAS'}`} {formatBytes(d.file_size) && `(${formatBytes(d.file_size)})`}
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
