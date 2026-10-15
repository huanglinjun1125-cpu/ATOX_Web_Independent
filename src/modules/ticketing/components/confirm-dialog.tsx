"use client";
import { useEffect, useId, useRef } from "react";
import { useTicketText } from "./shared";

export function TicketConfirmDialog({
  busy,
  close,
  confirm,
}: {
  busy: boolean;
  close: () => void;
  confirm: () => void;
}) {
  const { t } = useTicketText();
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="tk-confirm-dialog"
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) close();
      }}
    >
      <h2 id={id}>{t.closeTitle}</h2>
      <p>{t.confirmClose}</p>
      <div>
        <button
          className="tk-button tk-secondary"
          disabled={busy}
          onClick={close}
          autoFocus
        >
          {t.keepOrder}
        </button>
        <button
          className="tk-button tk-primary"
          disabled={busy}
          onClick={confirm}
        >
          {busy ? t.busy : t.closeAndChange}
        </button>
      </div>
    </dialog>
  );
}
