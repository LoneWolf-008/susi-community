// Anggaran LLM harian (T12.5): bila biaya hari ini mencapai CHATBOT_DAILY_BUDGET_USD, chatbot
// turun ke mode KB-saja (jawaban tetap ada, hanya tanpa LLM) sampai hari berganti.

/** @returns {boolean} true bila LLM tidak boleh dipakai lagi hari ini. Anggaran 0 = LLM dimatikan. */
export function isBudgetExceeded(spentUsd, budgetUsd) {
  if (!(Number(budgetUsd) > 0)) return true;
  return Number(spentUsd) >= Number(budgetUsd);
}

/** Total biaya LLM yang tercatat di ask_logs sejak pukul 00.00 (zona waktu sesi MySQL). */
export async function spentTodayUsd(db) {
  const [[{ spent }]] = await db.query(
    `SELECT COALESCE(SUM(cost_usd), 0) AS spent FROM ask_logs WHERE created_at >= CURDATE()`,
  );
  return Number(spent);
}
