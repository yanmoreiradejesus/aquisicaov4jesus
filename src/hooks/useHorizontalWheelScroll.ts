import { RefObject, useEffect } from "react";

/**
 * Converte scroll vertical da roda do mouse em scroll horizontal dentro do container.
 * Útil para Kanbans em Windows, onde o mouse comum só envia deltaY.
 *
 * - Ignora eventos com deltaX != 0 (trackpad / mouse com scroll horizontal nativo)
 * - Libera o evento quando atinge início/fim horizontal (não prende scroll vertical da página)
 * - Ignora se o alvo estiver dentro de [data-no-wheel-hijack]
 */
export function useHorizontalWheelScroll<T extends HTMLElement>(ref: RefObject<T>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      // Trackpad / mouse com delta horizontal nativo: não interferir
      if (e.deltaX !== 0) return;
      if (e.deltaY === 0) return;

      // Só sequestrar quando o usuário segura Shift (convenção padrão para
      // scroll horizontal com mouse de roda). Sem isso, gestos de trackpad
      // (arrastar pra baixo/cima) eram convertidos em scroll lateral.
      if (!e.shiftKey) return;

      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-no-wheel-hijack]")) return;

      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll <= 0) return;

      const atStart = el.scrollLeft <= 0;
      const atEnd = el.scrollLeft >= maxScroll - 1;

      // Se já está no limite e o usuário continua rolando na mesma direção,
      // libera para a página rolar verticalmente.
      if ((e.deltaY < 0 && atStart) || (e.deltaY > 0 && atEnd)) return;

      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [ref]);
}
