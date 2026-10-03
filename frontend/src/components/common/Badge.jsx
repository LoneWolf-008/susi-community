export default function Badge({ type }) {
  const map = {
    selesai: 'bg-[#c9ecd9] text-[#12283c]',
    proses: 'bg-[#12283c] text-[#f2efe6]',
    tunggu: 'bg-[#e62b2b] text-white',
    buka: 'bg-transparent text-[#12283c]',
  };
  const label = { selesai: 'SELESAI', proses: 'PROSES', tunggu: 'MENUNGGU', buka: 'DALAM ANTRIAN' };
  return <span className={`chip-mono border-0 ${map[type]}`}>{label[type]}</span>;
}