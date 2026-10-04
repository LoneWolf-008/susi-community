// Error dengan status HTTP. Pesan 4xx diteruskan ke klien apa adanya;
// pesan 5xx disamarkan di production oleh middleware/errorHandler.js.
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    if (details !== undefined) this.details = details;
  }
}

export const badRequest = (message, details) => new HttpError(400, message, details);
export const forbidden = (message = 'Akses ditolak') => new HttpError(403, message);
export const notFound = (message) => new HttpError(404, message);
export const conflict = (message) => new HttpError(409, message);
