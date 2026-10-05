// Sertifikasi talenta (U5): label status dan tautan publik sertifikat.

export const CERT_REQUEST_STATUS = {
  PENDING: { label: 'MENUNGGU TINJAUAN', tone: 'warning' },
  APPROVED: { label: 'DISETUJUI', tone: 'success' },
  REJECTED: { label: 'BELUM DISETUJUI', tone: 'danger' },
};

export const certificatePath = (code) => `/sertifikat/${encodeURIComponent(code)}`;
export const verificationPath = (code) => `/verifikasi/${encodeURIComponent(code)}`;
/** Tautan verifikasi lengkap untuk dibagikan / dicetak di sertifikat. */
export const verificationUrl = (code) => `${window.location.origin}${verificationPath(code)}`;

const CODE_RE = /^SUSI-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
/** Rapikan input kode dari pengguna ("susi 7kq2 m9xd" → "SUSI-7KQ2-M9XD"); null bila formatnya salah. */
export function normalizeCode(raw) {
  const compact = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = compact.startsWith('SUSI') ? compact.slice(4) : compact;
  const code = `SUSI-${body.slice(0, 4)}-${body.slice(4, 8)}`;
  return body.length === 8 && CODE_RE.test(code) ? code : null;
}
