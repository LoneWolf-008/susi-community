export const success = (res, data, message = 'Berhasil', status = 200) => {
  return res.status(status).json({
    success: true,
    message,
    data,
  });
};

export const created = (res, data, message = 'Berhasil dibuat') => {
  return success(res, data, message, 201);
};

export const fail = (res, message, status = 400, details = null) => {
  const body = {
    error: { message },
  };
  if (details) body.error.details = details;
  return res.status(status).json(body);
};