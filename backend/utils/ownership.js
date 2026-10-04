// Pemilik efektif kebutuhan (keputusan desain #1, docs/TASKS.md):
// kebutuhan jalur Assisted dibuat liaison dengan requester_id = NULL, sehingga liaison
// (created_by) bertindak sebagai pemilik proksi atas nama komunitas.
export const getNeedOwnerId = (need) => need.requester_id ?? need.created_by ?? null;

export const isNeedOwner = (need, userId) => {
  const ownerId = getNeedOwnerId(need);
  return ownerId !== null && Number(ownerId) === Number(userId);
};
