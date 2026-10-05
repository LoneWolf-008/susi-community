// Galat bertipe dari lapisan LLM. Pesan TIDAK pernah memuat API key, header, atau isi prompt,
// sehingga aman dicatat dan ditangkap pemanggil untuk jatuh ke jawaban KB.

export class LLMError extends Error {
  constructor(message, { status = null, code = null, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
  }
}

/** Key/provider belum dikonfigurasi (mis. OPENROUTER_API_KEY kosong). */
export class LLMNotConfigured extends LLMError {}
/** Melewati batas waktu (OPENROUTER_TIMEOUT_MS). */
export class LLMTimeout extends LLMError {}
/** 429 dari OpenRouter/provider setelah retry. */
export class LLMRateLimited extends LLMError {}
/** 5xx, jaringan, kredit habis (402), key ditolak (401/403), atau galat lain dari provider. */
export class LLMUnavailable extends LLMError {}
/** Model menolak menjawab atau membalas kosong (mis. habis untuk reasoning). */
export class LLMEmptyResponse extends LLMError {}
