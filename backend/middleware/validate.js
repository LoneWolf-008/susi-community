import { z } from 'zod';

// Pesan bawaan zod dalam Bahasa Indonesia; skema di validators/ menambahkan label kolom.
z.config(z.locales.id());

/**
 * Memvalidasi req.body (atau req.query) dengan skema zod. Kolom yang tidak dikenal dibuang,
 * jadi controller hanya menerima data yang sudah bersih (mis. `role` di PATCH /auth/me hilang).
 * Gagal → 400 { error: { message, details: [{ field, message }] } }.
 */
export const validate = (schema, source = 'body') => (req, res, next) => {
  const input = req[source] && typeof req[source] === 'object' ? req[source] : {};
  const result = schema.safeParse(input);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.') || null,
      message: issue.message,
    }));
    return res.status(400).json({ error: { message: details[0].message, details } });
  }
  if (source === 'query') {
    req.validatedQuery = result.data;
  } else {
    req[source] = result.data;
  }
  return next();
};
