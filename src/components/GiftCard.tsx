import type { Card } from "../draw/cards";
import { Paw } from "./Paw";

export function GiftCard({ card }: { card: Card }) {
  const length = Array.from(card.name).length;
  const size = length >= 12 ? "is-long" : length >= 8 ? "is-mid" : "";
  const label = card.miss
    ? card.name
    : card.desc
      ? `${card.name} 당첨. ${card.desc}`
      : `${card.name} 당첨`;

  return (
    <article className={card.miss ? "gift gift--miss" : "gift"} aria-label={label}>
      <p className="gift__brand">
        <Paw />
        LUCKY
      </p>
      <div className="gift__body">
        <h2 className={size ? `gift__name ${size}` : "gift__name"}>{card.name}</h2>
        {!card.miss && card.desc ? <p className="gift__desc">{card.desc}</p> : null}
      </div>
    </article>
  );
}
