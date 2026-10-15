"use client";
import { useEffect, useRef } from "react";
export function CenterDialog({
  title,
  close,
  busy,
  children,
}: {
  title: string;
  close: () => void;
  busy: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    dialog.showModal();
    const overflow = document.body.style.overflow;
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
      className="pc-dialog event-module"
      aria-labelledby="pc-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close();
      }}
    >
      <div className="pc-dialog-heading">
        <h2 id="pc-dialog-title">{title}</h2>
        <button
          type="button"
          aria-label="Close / 关闭"
          disabled={busy}
          onClick={close}
        >
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
