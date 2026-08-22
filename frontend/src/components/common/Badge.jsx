export default function Badge({ type }) {
  const map = {
    selesai: 'bg-[#0E7C66] text-white',
    proses: 'bg-yellow-300 text-black',
    tunggu: 'bg-black text-white',
    buka: 'bg-white text-black border-2 border-black',
  };
  const label = { selesai: 'SELESAI', proses: 'PROSES', tunggu: 'MENUNGGU', buka: 'DALAM ANTRIAN' };
  return <span className={`text-[9px] font-mono font-bold px-2 py-1 ${map[type]}`}>{label[type]}</span>;
}