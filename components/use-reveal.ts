"use client";

import { useEffect } from "react";

/**
 * Añade la clase `in` a cada `.reveal` cuando entra en pantalla, para disparar
 * la transición de entrada definida en `globals.css`.
 *
 * Con `prefers-reduced-motion: reduce` no se observa nada: se marcan todos de
 * golpe, así el contenido nunca depende del scroll para hacerse visible.
 */
export function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".reveal");

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      els.forEach((el) => el.classList.add("in"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            // Una vez visible ya no interesa: la entrada no se repite.
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );

    els.forEach((el) => io.observe(el));

    return () => io.disconnect();
  }, []);
}
