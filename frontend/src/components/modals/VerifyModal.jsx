import { useState } from 'react';
import Modal from './Modal';
import { api } from '../../lib/api';

const MAX_TESTIMONIAL = 1000;

/**
 * Verifikasi dua arah (PRD P0-5): talenta sudah menandai selesai, pemilik kebutuhan
 * membenarkan → proyek COMPLETED dan reputasi talenta +1. Testimoni opsional tampil publik.
 *
 * @param {{ project: { id: number, project_title?: string, talent_name?: string }, onClose: () => void,
 *           onVerified: (project: object) => void }} props
 */
export default function VerifyModal({ project, onClose, onVerified }) {
  const [testimonial, setTestimonial] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const updated = await api.post(`/projects/${project.id}/verify`, {
        testimonial: testimonial.trim() || undefined,
      });
      onVerified(updated);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Benarkan proyek selesai?" eyebrow="VERIFIKASI DUA ARAH" onClose={onClose} busy={submitting}>
      <div className="grid grid-cols-3 gap-2 mb-6">
        {[
          { n: '01', l: 'TALENTA MENANDAI SELESAI', done: true },
          { n: '02', l: 'KOMUNITAS MEMBENARKAN', active: true },
          { n: '03', l: 'REPUTASI TALENTA +1' },
        ].map((s) => (
          <div
            key={s.n}
            className={`rounded-xl border p-3 text-center ${s.done ? 'border-[#c9ecd9] bg-[#c9ecd9] text-[#12283c]' : s.active ? 'border-[#e62b2b] bg-[#e62b2b]/10' : 'border-white/10 opacity-50'}`}
          >
            <p className="text-lg font-black">{s.n}</p>
            <p className="font-mono text-[8px] font-bold leading-tight">{s.l}</p>
          </div>
        ))}
      </div>

      <p className="text-sm text-[#f2efe6]/80 leading-relaxed mb-6">
        Pastikan hasil <strong>{project.project_title || 'proyek'}</strong>
        {project.talent_name ? <> dari <strong>{project.talent_name}</strong></> : null} sudah sesuai definisi selesai
        yang disepakati. Setelah dibenarkan, status tidak bisa dibatalkan dan reputasi talenta bertambah.
      </p>

      <label className="field-label" htmlFor="verify-testimonial">Testimoni untuk talenta (opsional, tampil publik)</label>
      <textarea
        id="verify-testimonial"
        value={testimonial}
        onChange={(e) => setTestimonial(e.target.value.slice(0, MAX_TESTIMONIAL))}
        className="input-line input-line-dark h-28 resize-none"
        placeholder="Contoh: Hasilnya dipakai bendahara setiap hari, penjelasannya sabar."
      />
      <p className="font-mono text-[9px] opacity-50 mt-1 text-right">{testimonial.length}/{MAX_TESTIMONIAL}</p>

      {error && <p role="alert" className="mt-4 rounded-lg bg-[#e62b2b] text-white p-3 text-xs font-bold">⚠ {error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
        <button type="button" onClick={onClose} disabled={submitting} className="btn-pill btn-ghost-light">Batal</button>
        <button type="button" onClick={submit} disabled={submitting} className="btn-pill bg-[#c9ecd9] text-[#12283c] hover:bg-white disabled:opacity-60">
          {submitting ? 'Memproses…' : '✓ Ya, proyek selesai'}
        </button>
      </div>
    </Modal>
  );
}
