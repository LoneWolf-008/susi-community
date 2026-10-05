// Validasi kontak balik (eskalasi chatbot): email, atau nomor telepon/WhatsApp berisi 9–15 digit.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[\d\s().-]+$/;

export function isValidContact(value) {
  const s = String(value ?? '').trim();
  if (EMAIL_RE.test(s)) return true;
  if (!PHONE_RE.test(s)) return false;
  const digits = s.replace(/\D/g, '').length;
  return digits >= 9 && digits <= 15;
}
