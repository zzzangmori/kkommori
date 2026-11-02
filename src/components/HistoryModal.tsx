import { useEffect, useId, useRef, useState } from "react";
import { formatRate } from "../draw/cards";
import type { HistoryRound } from "../draw/history";

const timeFormat = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export function HistoryModal({
  rounds,
  onClear,
  onClose,
}: {
  rounds: HistoryRound[];
  onClear: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const total = rounds.reduce((sum, round) => sum + round.cards.length, 0);
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());

  function toggle(id: string) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    const panel = panelRef.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel?.querySelector<HTMLElement>(".admin__ghost")?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>("button")].filter((node) => !node.hasAttribute("disabled"));
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

  function clearAll() {
    if (!rounds.length) return;
    if (!window.confirm("이 브라우저에 남은 뽑기 기록을 모두 지울까요?")) return;
    onClear();
  }

  return (
    <div
      className="admin history"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="admin__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={panelRef}
      >
        <header className="admin__head">
          <div>
            <h2 id={titleId} className="admin__title">뽑기 기록</h2>
            <p className="admin__note">
              {rounds.length
                ? `이 브라우저에 ${rounds.length}회, ${total}장이 남아 있습니다. 최근 기록이 위에 있습니다.`
                : "아직 뽑은 기록이 없습니다. 뽑기가 끝나면 이 브라우저에 남습니다."}
            </p>
          </div>
          <button type="button" className="admin__ghost" onClick={onClose}>닫기</button>
        </header>

        <div className="history__body">
          {rounds.length ? (
            <table className="history__table">
              <thead>
                <tr>
                  <th scope="col">시간</th>
                  <th scope="col">회차</th>
                  <th scope="col">번호</th>
                  <th scope="col">결과</th>
                  <th scope="col">설명</th>
                  <th scope="col">확률</th>
                </tr>
              </thead>
              {rounds.map((round, roundIndex) => {
                const turn = rounds.length - roundIndex;
                const expanded = round.cards.length > 1 && openIds.has(round.id);
                const wins = round.cards.filter((card) => !card.miss).length;
                const misses = round.cards.length - wins;
                const summary = [
                  wins ? `당첨 ${wins}` : "",
                  misses ? `꽝 ${misses}` : "",
                ].filter(Boolean).join(" · ");
                return (
                  <tbody key={round.id} id={`history-${round.id}`}>
                    {round.cards.length > 1 ? (
                      <tr>
                        <td>{timeFormat.format(round.at)}</td>
                        <td>{turn}</td>
                        <td>
                          <button
                            type="button"
                            className={expanded ? "history__toggle is-open" : "history__toggle"}
                            aria-expanded={expanded}
                            aria-controls={`history-${round.id}`}
                            onClick={() => toggle(round.id)}
                          >
                            {round.cards.length}장
                          </button>
                        </td>
                        <td colSpan={3}>{summary}</td>
                      </tr>
                    ) : null}
                    {round.cards.length === 1 || expanded
                      ? round.cards.map((card, index) => (
                        <tr
                          key={`${round.id}-${index}`}
                          className={[card.miss ? "is-miss" : "", round.cards.length > 1 ? "is-child" : ""].filter(Boolean).join(" ") || undefined}
                        >
                          <td>{round.cards.length === 1 ? timeFormat.format(round.at) : ""}</td>
                          <td>{round.cards.length === 1 ? turn : ""}</td>
                          <td>{index + 1}</td>
                          <td>{card.name}</td>
                          <td>{card.desc || "—"}</td>
                          <td>{formatRate(card.rate)}</td>
                        </tr>
                      ))
                      : null}
                  </tbody>
                );
              })}
            </table>
          ) : (
            <p className="history__empty">기록이 없습니다.</p>
          )}
        </div>

        <footer className="history__foot">
          <button type="button" className="admin__ghost" onClick={clearAll} disabled={!rounds.length}>
            기록 지우기
          </button>
        </footer>
      </div>
    </div>
  );
}
