import { useCallback, useState } from "react";
import type { Card } from "./cards";
import { clearHistory, readHistory, toHistoryRound, writeHistory, type HistoryRound } from "./history";

const MAX_ROUNDS = 200;

export function useHistory() {
  const [rounds, setRounds] = useState<HistoryRound[]>(readHistory);

  const record = useCallback((cards: Card[]) => {
    if (!cards.length) return;
    setRounds((current) => {
      const next = [toHistoryRound(cards), ...current].slice(0, MAX_ROUNDS);
      writeHistory(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    clearHistory();
    setRounds([]);
  }, []);

  return { rounds, record, clear };
}
