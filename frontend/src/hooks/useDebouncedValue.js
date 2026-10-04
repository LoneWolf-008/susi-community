import { useEffect, useState } from 'react';

/** Nilai yang baru ikut berubah setelah `delay` ms tanpa perubahan (mis. kotak pencarian). */
export function useDebouncedValue(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default useDebouncedValue;
