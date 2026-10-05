// Navigasi dari kartu Tanya SUSI (R3) ke dasbor yang sedang terbuka: widget chat global tidak
// memegang state tab dasbor, jadi ia mengirim event dan dasbor yang relevan menanggapinya.

export const OPEN_NEED_EVENT = 'susi:open-need'; // talenta: buka detail kebutuhan di katalog
export const OPEN_OWNER_NEED_EVENT = 'susi:open-owner-need'; // komunitas/AgenSUSI: buka kebutuhan miliknya

export const requestOpenNeed = (id) => window.dispatchEvent(new CustomEvent(OPEN_NEED_EVENT, { detail: { id } }));
export const requestOpenOwnerNeed = (id) => window.dispatchEvent(new CustomEvent(OPEN_OWNER_NEED_EVENT, { detail: { id } }));
