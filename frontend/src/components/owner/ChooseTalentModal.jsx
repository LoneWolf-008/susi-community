import { useState } from 'react';
import Modal from '../modals/Modal';
import { api } from '../../lib/api';
import { toDateInput } from '../../lib/format';

/**
 * Memilih talenta + menyepakati lingkup & definisi selesai (PRD P0-4).
 * PATCH /applications/:id/decide { decision: 'DITERIMA', scope, done_definition, deadline }.
 */
export default function ChooseTalentModal({ application, need, onClose, onChosen }) {
  const [scope, setScope] = useState(need?.description || '');
  const [doneDefinition, setDoneDefinition] = useState('');
  const [deadline, setDeadline] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const today = toDateInput(new Date());

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (scope.trim().length < 5) errs.scope = 'Tuliskan lingkup pekerjaan (minimal 5 karakter)';
    if (doneDefinition.trim().length < 5) errs.done_definition = 'Tuliskan kapan pekerjaan dianggap selesai (minimal 5 karakter)';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSubmitting(true);
    try {
      await api.patch(`/applications/${application.id}/decide`, {
        decision: 'DITERIMA',
        scope: scope.trim(),
        done_definition: doneDefinition.trim(),
        deadline: deadline || null,
      });
      onChosen();
    } catch (err) {
      setErrors({ form: err.message, ...Object.fromEntries((err.details || []).map((d) => [d.field, d.message])) });
      setSubmitting(false);
    }
  };

  const err = (key) => errors[key] && <p className="mt-1 font-mono text-[10px] font-bold text-[#ff8a8a]">{errors[key]}</p>;

  return (
    <Modal title={`Pilih ${application.talent_name}?`} eyebrow="KESEPAKATAN KERJA" onClose={onClose} busy={submitting}>
      <p className="text-sm text-[#f2efe6]/75 leading-relaxed mb-6">
        Tuliskan dengan bahasa sehari-hari apa yang akan dikerjakan dan kapan dianggap selesai. Talenta
        akan membaca dan menyetujui kesepakatan ini sebelum mulai. Pelamar lain otomatis diberi tahu.
      </p>
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="field-label" htmlFor="choose-scope">Apa yang dikerjakan (lingkup)</label>
          <textarea id="choose-scope" value={scope} onChange={(e) => setScope(e.target.value.slice(0, 5000))} className="input-line input-line-dark h-28 resize-none" placeholder="Contoh: Membuat pencatatan iuran di Google Sheets untuk 48 kepala keluarga." />
          {err('scope')}
        </div>
        <div>
          <label className="field-label" htmlFor="choose-done">Kapan dianggap selesai</label>
          <textarea id="choose-done" value={doneDefinition} onChange={(e) => setDoneDefinition(e.target.value.slice(0, 2000))} className="input-line input-line-dark h-24 resize-none" placeholder="Contoh: Selesai bila bendahara bisa mencatat sendiri dan rekap bulanan muncul otomatis." />
          {err('done_definition')}
        </div>
        <div>
          <label className="field-label" htmlFor="choose-deadline">Tenggat (opsional)</label>
          <input id="choose-deadline" type="date" min={today} value={deadline} onChange={(e) => setDeadline(e.target.value)} className="input-line input-line-dark [color-scheme:dark]" />
          {err('deadline')}
        </div>
        {errors.form && <p role="alert" className="rounded-lg bg-[#e62b2b] text-white p-3 text-xs font-bold">⚠ {errors.form}</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={submitting} className="btn-pill btn-ghost-light">Batal</button>
          <button type="submit" disabled={submitting} className="btn-pill btn-red disabled:opacity-60">{submitting ? 'Memproses…' : 'Pilih & kirim kesepakatan →'}</button>
        </div>
      </form>
    </Modal>
  );
}
