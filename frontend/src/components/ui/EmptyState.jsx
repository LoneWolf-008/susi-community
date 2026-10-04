/**
 * Empty state yang menjelaskan langkah berikutnya (PRD user story #12),
 * bukan sekadar "tidak ada data".
 */
export default function EmptyState({ title, description, action, icon = '◇', dark = false }) {
  return (
    <div className={`${dark ? 'card-dark' : 'card-light'} p-8 md:p-10 text-center`}>
      <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#e62b2b] text-white text-lg font-black">
        {icon}
      </span>
      <p className="text-lg font-black tracking-tight">{title}</p>
      {description && (
        <p className={`mt-2 text-sm leading-relaxed max-w-md mx-auto ${dark ? 'text-[#f2efe6]/60' : 'text-[#12283c]/60'}`}>
          {description}
        </p>
      )}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
