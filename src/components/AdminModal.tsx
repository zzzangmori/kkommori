import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { formatRate } from "../draw/cards";
import { createId, parseRate, type Product } from "../draw/catalog";

type Draft = {
  id: string;
  name: string;
  desc: string;
  rate: string;
};

const SEGMENT_COLORS = ["#ff4ad8", "#c084fc", "#7af0ff", "#ffd0f0", "#8b7cff", "#67e8f9"];

function toDraft(products: Product[]): Draft[] {
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    desc: product.desc,
    rate: String(product.rate),
  }));
}

function draftValue(draft: Draft[]): Product[] | null {
  const products: Product[] = [];
  for (const item of draft) {
    const name = item.name.trim();
    const rate = parseRate(item.rate);
    if (!name || rate == null) return null;
    products.push({
      id: item.id,
      name,
      desc: item.desc.trim(),
      rate,
    });
  }
  const sum = Math.round(products.reduce((total, product) => total + product.rate, 0) * 10000) / 10000;
  if (sum > 100) return null;
  return products;
}

function sameProducts(a: Product[], b: Product[]) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function AdminModal({
  products,
  saved,
  onSave,
  onReset,
  onClose,
}: {
  products: Product[];
  saved: boolean;
  onSave: (products: Product[]) => void;
  onReset: () => Product[];
  onClose: () => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(() => toDraft(products));
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const savingRef = useRef(false);
  const focusId = useRef<string | null>(null);

  const parsed = draft.map((item) => parseRate(item.rate));
  let rawSum = 0;
  for (const rate of parsed) rawSum += rate ?? 0;
  const sum = Math.round(rawSum * 10000) / 10000;
  const ratesComplete = parsed.length > 0 && parsed.every((rate) => rate != null);
  const overflow = sum > 100;
  const miss = ratesComplete && !overflow ? Math.max(0, 100 - sum) : null;
  const scale = Math.max(sum, 100) || 100;
  const nextProducts = draftValue(draft);
  const dirty = nextProducts == null || !sameProducts(nextProducts, products);
  const requestCloseRef = useRef<() => void>(() => {});

  useEffect(() => {
    const panel = panelRef.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const field = panel?.querySelector<HTMLElement>("[id^='product-name-']");
    (field ?? panel?.querySelector<HTMLElement>(".admin__foot .admin__ghost"))?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        requestCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>("button, input, textarea, select")]
        .filter((node) => !node.hasAttribute("disabled"));
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
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

  useEffect(() => {
    const id = focusId.current;
    if (!id) return;
    focusId.current = null;
    document.getElementById(`product-name-${id}`)?.focus();
  }, [draft]);

  function requestClose() {
    if (savingRef.current) return;
    if (dirty && !window.confirm("저장하지 않은 내용이 있습니다. 닫을까요?")) return;
    onClose();
  }
  requestCloseRef.current = requestClose;

  function update(id: string, patch: Partial<Draft>) {
    setFormError("");
    setDraft((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function move(index: number, direction: -1 | 1) {
    setDraft((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = current.slice();
      const [item] = next.splice(index, 1);
      if (!item) return current;
      next.splice(nextIndex, 0, item);
      return next;
    });
  }

  function remove(id: string) {
    setFormError("");
    setDraft((current) => current.filter((item) => item.id !== id));
  }

  function addProduct() {
    const id = createId();
    focusId.current = id;
    setTried(false);
    setDraft((current) => [...current, { id, name: "", desc: "", rate: "" }]);
  }

  function restoreDefaults() {
    if (savingRef.current) return;
    if (!window.confirm("이 브라우저에 저장한 상품을 지우고, 기본 목록으로 되돌릴까요?")) return;
    setFormError("");
    setDraft(toDraft(onReset()));
    setTried(false);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (savingRef.current) return;
    setTried(true);
    setFormError("");
    const next = draftValue(draft);
    if (!next?.length) return;
    savingRef.current = true;
    setSaving(true);
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    try {
      onSave(next);
      onClose();
    } catch (error) {
      savingRef.current = false;
      setSaving(false);
      setFormError(error instanceof Error ? error.message : "이 브라우저에 저장하지 못했습니다.");
    }
  }

  const messages = [
    draft.length === 0 ? "상품을 한 개 이상 추가해 주세요." : "",
    overflow ? "확률 합계가 100%를 넘었습니다." : "",
    formError,
  ].filter(Boolean);

  return (
    <div
      className={saving ? "admin is-saving" : "admin"}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div
        className="admin__panel"
        role="dialog"
        aria-modal="true"
        aria-busy={saving}
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={panelRef}
      >
        <header className="admin__head">
          <div>
            <h2 id={titleId} className="admin__title">상품 관리</h2>
            <p className="admin__note">
              {saved
                ? "이 브라우저에 저장되어 있습니다. 저장하면 다음 뽑기부터 적용됩니다."
                : "기본 목록을 보고 있습니다. 저장하면 이 브라우저에 남습니다."}
              {" "}
              꽝은 목록에 넣지 않습니다. 100%에서 당첨 확률을 뺀 만큼 꽝이 나옵니다.
            </p>
          </div>
          <button type="button" className="admin__ghost" onClick={requestClose}>닫기</button>
        </header>

        <form className="admin__form" onSubmit={onSubmit}>
          <fieldset className="admin__list">
            <legend className="sr-only">상품 목록</legend>
            {draft.map((item, index) => {
              const nameInvalid = tried && !item.name.trim();
              const rateInvalid = tried && parseRate(item.rate) == null;
              return (
                <div className="admin__row" key={item.id}>
                  <label className="admin__field">
                    <span>상품명</span>
                    <input
                      id={`product-name-${item.id}`}
                      value={item.name}
                      maxLength={40}
                      autoComplete="off"
                      aria-invalid={nameInvalid}
                      placeholder="상품 이름"
                      onChange={(event) => update(item.id, { name: event.target.value })}
                    />
                    {nameInvalid ? <small>이름을 입력해 주세요</small> : null}
                  </label>
                  <label className="admin__field">
                    <span>설명</span>
                    <input
                      value={item.desc}
                      maxLength={100}
                      autoComplete="off"
                      placeholder="선택"
                      onChange={(event) => update(item.id, { desc: event.target.value })}
                    />
                  </label>
                  <label className="admin__field admin__field--rate">
                    <span>확률 %</span>
                    <input
                      value={item.rate}
                      inputMode="decimal"
                      autoComplete="off"
                      aria-invalid={rateInvalid}
                      placeholder="0.5"
                      onChange={(event) => update(item.id, { rate: event.target.value })}
                    />
                    {rateInvalid ? <small>0보다 큰 숫자</small> : null}
                  </label>
                  <div className="admin__actions">
                    <button type="button" aria-label="위로" disabled={index === 0 || saving} onClick={() => move(index, -1)}>↑</button>
                    <button type="button" aria-label="아래로" disabled={index === draft.length - 1 || saving} onClick={() => move(index, 1)}>↓</button>
                    <button type="button" onClick={() => remove(item.id)} disabled={saving}>삭제</button>
                  </div>
                </div>
              );
            })}
          </fieldset>

          <footer className="admin__foot">
            <div className={overflow ? "admin__meter is-over" : "admin__meter"} aria-hidden="true">
              {draft.map((item, index) => {
                const rate = parsed[index];
                if (rate == null) return null;
                return (
                  <span
                    key={item.id}
                    title={`${item.name.trim() || "이름 없음"} ${formatRate(rate)}`}
                    style={{ width: `${(rate / scale) * 100}%`, background: SEGMENT_COLORS[index % SEGMENT_COLORS.length] }}
                  />
                );
              })}
              {miss != null && miss > 0 ? (
                <span title={`꽝 ${formatRate(miss)}`} style={{ width: `${(miss / scale) * 100}%`, background: "#8d879c" }} />
              ) : null}
            </div>
            <p className={overflow ? "admin__sum is-over" : "admin__sum"}>
              <span>당첨 {formatRate(sum)}</span>
              <span>꽝 {miss == null ? "—" : formatRate(miss)}</span>
            </p>
            {messages.length ? (
              <div className="admin__alert" role="alert">
                {messages.map((message) => <p key={message}>{message}</p>)}
              </div>
            ) : null}
            <div className="admin__foot-actions">
              <button type="button" className="admin__ghost" onClick={addProduct} disabled={saving}>상품 추가</button>
              <div className="admin__foot-save">
                <button type="button" className="admin__ghost" onClick={restoreDefaults} disabled={saving}>
                  기본값
                </button>
                <button type="submit" className="admin__save" disabled={saving || draft.length === 0 || overflow}>
                  {saving ? "저장 중" : "저장"}
                </button>
              </div>
            </div>
          </footer>
        </form>
      </div>
      {saving ? (
        <div className="admin__pending" role="status" aria-live="polite">
          <span className="admin__spinner" aria-hidden="true" />
          <span>저장 중</span>
        </div>
      ) : null}
    </div>
  );
}
