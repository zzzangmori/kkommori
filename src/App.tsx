import { useRef, useState } from "react";
import { AdminModal } from "./components/AdminModal";
import { GiftCard } from "./components/GiftCard";
import { Paw } from "./components/Paw";
import { useCatalog } from "./draw/useCatalog";
import { useLuckyDraw } from "./draw/useLuckyDraw";
import { useFitFrame } from "./hooks/useFitFrame";

export function App() {
  const monitorRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pictureRef = useRef<HTMLDivElement>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const catalog = useCatalog();
  const draw = useLuckyDraw(videoRef, pictureRef, catalog.cards);
  useFitFrame(monitorRef);

  const hasPrize = catalog.cards.some((card) => !card.miss);
  const hint = hasPrize ? draw.error : "상품이 없습니다";
  const pictureClass = ["pv-wrap", draw.fx.playing && "is-playing"].filter(Boolean).join(" ");
  const showAdminButton = draw.phase !== "playing" && draw.phase !== "fading";

  return (
    <>
    <div className={draw.hideCursor ? "letterbox hide-cursor" : "letterbox"} data-phase={draw.phase}>
      <div className="monitor" ref={monitorRef}>
        <i className="monitor__lamp monitor__lamp--left" aria-hidden="true" />
        <i className="monitor__lamp monitor__lamp--right" aria-hidden="true" />
        <div className="monitor__bar">
          <Paw />
          <p className="monitor__title">LUCKY DRAW</p>
          <Paw />
          {showAdminButton ? (
            <button
              type="button"
              className="admin-launch"
              aria-haspopup="dialog"
              aria-expanded={adminOpen}
              title="상품과 확률 관리"
              onClick={() => setAdminOpen(true)}
            >
              관리
            </button>
          ) : null}
        </div>
        <div className="stage">
          <div className={pictureClass} ref={pictureRef}>
            <video
              ref={videoRef}
              className="pv"
              playsInline
              preload="auto"
              disablePictureInPicture
              tabIndex={-1}
            />
          </div>
          <div className={draw.fx.wipe ? "wipe is-on" : "wipe"} />
          <div className={draw.fx.flash ? "flash is-on" : "flash"} />
          <div className="card-slot">
            {draw.phase === "shown" && draw.card ? <GiftCard card={draw.card} /> : null}
          </div>

          <section className="idle">
            <h1 className="sr-only">Lucky Draw</h1>
            <button type="button" className="draw-btn" disabled={!draw.ready} onClick={draw.startDraw}>
              <Paw />
              <span>뽑기</span>
            </button>
            <p className="hint" hidden={!hint}>{hint}</p>
          </section>

          <button
            type="button"
            className="draw-btn draw-btn--again"
            hidden={draw.phase !== "shown"}
            disabled={!draw.ready}
            onClick={draw.startDraw}
          >
            <Paw />
            <span>한번 더 뽑기</span>
          </button>
          <p className="sr-only" aria-live="polite">{draw.live}</p>
        </div>
        <div className="monitor__slot" aria-hidden="true" />
        <p className="monitor__caption">GOOD LUCK</p>
      </div>
    </div>
    {adminOpen ? (
      <AdminModal
        products={catalog.products}
        saved={catalog.saved}
        onSave={catalog.save}
        onReset={catalog.reset}
        onClose={() => setAdminOpen(false)}
      />
    ) : null}
    </>
  );
}
