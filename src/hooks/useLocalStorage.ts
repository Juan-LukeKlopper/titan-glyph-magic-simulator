import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

export interface UseLocalStorageOptions<T> {
  /** Serialize a value for storage (default: String). */
  encode?: (value: T) => string;
  /**
   * Parse a stored string back into T. Required for non-string values
   * (the persisted UI flags are '1'/'0', decoded as `raw === '1'`).
   */
  decode?: (raw: string) => T;
}

/**
 * A localStorage-backed state hook. Reads the stored value once on mount;
 * `initial` is used when the key is missing entirely — preserving the exact
 * original App semantics (missing key -> default). Writes the value back to
 * localStorage on every change.
 */
export function useLocalStorage<T>(
  key: string,
  initial: T,
  { encode = String, decode }: UseLocalStorageOptions<T> = {},
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    const raw = localStorage.getItem(key);
    if (raw === null) {return initial;}
    return decode ? decode(raw) : (raw as T);
  });

  useEffect(() => {
    localStorage.setItem(key, encode(value));
  }, [key, encode, value]);

  return [value, setValue];
}
