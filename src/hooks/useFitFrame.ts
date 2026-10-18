import { useLayoutEffect, type RefObject } from "react";

export function useFitFrame(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fit = () => {
      const width = el.offsetWidth;
      const height = el.offsetHeight;
      if (!width || !height) return;
      const scale = Math.min(
        window.innerWidth / (width + 96),
        window.innerHeight / (height + 96),
      );
      el.style.setProperty("--fit", String(scale));
      el.classList.add("is-fit");
    };

    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [ref]);
}
