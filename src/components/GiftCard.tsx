import { formatRate, type Card } from "../draw/cards";
import { Paw } from "./Paw";

export function GiftCard({ card }: { card: Card }) {
  const length = Array.from(card.name).length;
  const size = length >= 12 ? "is-long" : length >= 8 ? "is-mid" : "";
  const rateLabel = card.miss ? "MISS" : formatRate(card.rate);
  const label = card.miss
    ? card.name
    : card.desc
      ? `${card.name} 당첨, 확률 ${rateLabel}. ${card.desc}`
      : `${card.name} 당첨, 확률 ${rateLabel}`;

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
      <p className="gift__rate">{rateLabel}</p>
    </article>
  );
}
