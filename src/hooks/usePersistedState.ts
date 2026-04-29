import { useEffect, useRef, useState } from "react";

/**
 * Estado persistido em sessionStorage. Sobrevive à navegação dentro da mesma aba
 * (ex.: abrir detalhe de um card e voltar para o kanban mantém filtros aplicados).
 */
export function usePersistedState<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = sessionStorage.getItem(key);
      if (raw == null) return initial;
      return JSON.parse(raw) as T;
    } catch {
      return initial;
    }
  });

  const keyRef = useRef(key);
  useEffect(() => {
    keyRef.current = key;
  }, [key]);

  useEffect(() => {
    try {
      sessionStorage.setItem(keyRef.current, JSON.stringify(value));
    } catch {
      // ignore quota errors
    }
  }, [value]);

  return [value, setValue];
}
