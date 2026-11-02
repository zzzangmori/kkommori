import { useEffect, useId, useRef } from "react";
import { MAX_DRAWS } from "../draw/constants";
import { Paw } from "./Paw";

const COUNTS = Array.from({ length: MAX_DRAWS }, (_, index) => index + 1);
const COLUMNS = 5;

export function CountPicker({
  onPick,
  onClose,
}: {
  onPick: (count: number) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onPickRef = useRef(onPick);
  const onCloseRef = useRef(onClose);
  onPickRef.current = onPick;
  onCloseRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.querySelector<HTMLButtonElement>(".count-pick__n")?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const count = event.key >= "1" && event.key <= "9"
        ? Number(event.key)
        : event.key === "0"
          ? 10
          : null;
      if (count && count <= MAX_DRAWS) {
        event.preventDefault();
        event.stopPropagation();
        onPickRef.current(count);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      const panel = panelRef.current;
      if (!panel) return;

      if (event.key === "ArrowRight" || event.key === "ArrowLeft" || event.key === "ArrowDown" || event.key === "ArrowUp") {
        const buttons = [...panel.querySelectorAll<HTMLButtonElement>(".count-pick__n")];
        const index = buttons.findIndex((button) => button === document.activeElement);
        if (index < 0) {
          event.preventDefault();
          buttons[0]?.focus();
          return;
        }
        const delta = event.key === "ArrowRight" ? 1
          : event.key === "ArrowLeft" ? -1
            : event.key === "ArrowDown" ? COLUMNS
              : -COLUMNS;
        event.preventDefault();
        buttons[Math.min(buttons.length - 1, Math.max(0, index + delta))]?.focus();
        return;
      }

      if (event.key !== "Tab") return;
      const items = [...panel.querySelectorAll<HTMLElement>("button")];
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      previous?.focus();
    };
  }, []);

  return (
    <div
      className="count-pick"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="count-pick__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={panelRef}
      >
        <h2 id={titleId} className="count-pick__title">
          <Paw />
          몇 장 뽑을까요?
          <Paw />
        </h2>
        <p className="count-pick__note">번호를 고르면 바로 뽑습니다. 숫자 키도 됩니다.</p>
        <div className="count-pick__grid">
          {COUNTS.map((count) => (
            <button
              key={count}
              type="button"
              className="count-pick__n"
              aria-label={`${count}장 뽑기`}
              onClick={() => onPick(count)}
            >
              {count}
            </button>
          ))}
        </div>
        <button type="button" className="count-pick__cancel" onClick={onClose}>
          취소
        </button>
      </div>
    </div>
  );
}
