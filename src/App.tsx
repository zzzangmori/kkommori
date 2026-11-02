import { useRef, useState } from "react";
import { AdminModal } from "./components/AdminModal";
import { CardHand } from "./components/CardHand";
import { CountPicker } from "./components/CountPicker";
import { HistoryModal } from "./components/HistoryModal";
import { Paw } from "./components/Paw";
import { announceCard } from "./draw/cards";
import { useCatalog } from "./draw/useCatalog";
import { useHistory } from "./draw/useHistory";
import { useLuckyDraw } from "./draw/useLuckyDraw";
import { useFitFrame } from "./hooks/useFitFrame";

export function App() {
  const monitorRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const catalog = useCatalog();
  const history = useHistory();
  const draw = useLuckyDraw(videoRef, canvasRef, catalog.cards, history.record);
  useFitFrame(monitorRef);

  const hasPrize = catalog.cards.some((card) => !card.miss);
  const hint = hasPrize ? draw.error : "상품이 없습니다";
  const canPick = draw.ready && (draw.phase === "idle" || draw.phase === "shown");
  const showHand = (draw.phase === "dealing" || draw.phase === "shown") && draw.results.length > 0;
  const dealingMulti = draw.phase === "dealing" && draw.total > 1;
  const showBarButtons = !picking
    && draw.phase !== "playing"
    && draw.phase !== "fading"
    && draw.phase !== "dealing";

  function openPicker() {
    if (!canPick) return;
    setPicking(true);
  }

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
          {showBarButtons ? (
            <>
              <button
                type="button"
                className="admin-launch admin-launch--left"
                aria-haspopup="dialog"
                aria-expanded={historyOpen}
                title="뽑기 기록"
                onClick={() => setHistoryOpen(true)}
              >
                히스토리
              </button>
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
            </>
          ) : null}
        </div>
        <div className="stage">
          <video
            ref={videoRef}
            className="pv-audio"
            playsInline
            preload="auto"
            disablePictureInPicture
            tabIndex={-1}
          />
          <div className="pv-wrap">
            <canvas ref={canvasRef} className="pv" />
          </div>
        <div className="card-slot" data-count={showHand ? draw.total : undefined}>
          {showHand ? <CardHand results={draw.results} revealed={draw.revealed} /> : null}
        </div>

        <section className="idle">
          <h1 className="sr-only">Lucky Draw</h1>
          <button type="button" className="draw-btn" disabled={!draw.ready} hidden={picking} onClick={openPicker}>
            <Paw />
            <span>뽑기</span>
          </button>
          <p className="hint" hidden={!hint}>{hint}</p>
        </section>

        <button
          type="button"
          className="draw-btn draw-btn--again"
          hidden={draw.phase !== "shown" || picking}
          disabled={!draw.ready}
          onClick={openPicker}
        >
          <Paw />
          <span>한번 더 뽑기</span>
        </button>
        {picking && canPick ? (
          <CountPicker
            onPick={(count) => {
              setPicking(false);
              void draw.startDraw(count);
            }}
            onClose={() => setPicking(false)}
          />
        ) : null}
        <div className="sr-only" aria-live="polite" aria-relevant="additions">
          {draw.phase === "dealing" || draw.phase === "shown"
            ? draw.results.slice(0, draw.revealed).map((item) => <p key={item.id}>{announceCard(item.card)}</p>)
            : null}
        </div>
        </div>
        <div className="monitor__slot" aria-hidden="true" />
        <p className={dealingMulti ? "monitor__caption monitor__caption--count" : "monitor__caption"}>
          {dealingMulti ? `${draw.revealed} / ${draw.total}` : "GOOD LUCK"}
        </p>
      </div>
    </div>
    {historyOpen ? (
      <HistoryModal
        rounds={history.rounds}
        onClear={history.clear}
        onClose={() => setHistoryOpen(false)}
      />
    ) : null}
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
