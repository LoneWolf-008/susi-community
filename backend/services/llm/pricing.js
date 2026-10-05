// Harga USD per 1 juta token, hanya untuk ESTIMASI bila respons tidak membawa `usage.cost`.
// OpenRouter selalu mengirim biaya aktual; tabel ini terutama dipakai mode mock.
const PRICES = Object.freeze({
  // Tarif yang tercatat saat uji fase 2 (30 Sep 2026).
  'anthropic/claude-haiku-4.5': { input: 1, output: 5 },
  mock: { input: 1, output: 5 },
});
// Model lain: tarif sengaja tinggi agar estimasi anggaran harian tidak kebablasan.
const UNKNOWN = { input: 5, output: 25 };

export function estimateCostUsd(model, tokensIn = 0, tokensOut = 0) {
  const price = PRICES[model] || UNKNOWN;
  return (tokensIn * price.input + tokensOut * price.output) / 1_000_000;
}
