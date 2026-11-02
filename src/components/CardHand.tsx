import type { DrawResult } from "../draw/useLuckyDraw";
import { GiftCard } from "./GiftCard";
import { Paw } from "./Paw";

function CardBack() {
  return (
    <div className="gift gift--back">
      <p className="gift__brand">
        <Paw />
        LUCKY
      </p>
    </div>
  );
}

export function CardHand({
  results,
  revealed,
}: {
  results: DrawResult[];
  revealed: number;
}) {
  return (
    <div className="card-hand">
      {results.map((item, index) => {
        const open = index < revealed;
        return (
          <div className="card-cell" key={item.id}>
            <div className={open ? "card-flip is-flipped" : "card-flip"}>
              <div className="card-flip__inner">
                <div className="card-flip__back">
                  <CardBack />
                </div>
                <div className="card-flip__face" aria-hidden={open ? undefined : true}>
                  <GiftCard card={item.card} />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
