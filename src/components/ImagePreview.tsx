import { useId, useRef } from "react";

export function ImagePreview({
  src,
  alt,
  label,
  className = "",
}: {
  src: string;
  alt: string;
  label: string;
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  return (
    <div className={`image-preview ${className}`}>
      <button
        type="button"
        className="image-open"
        aria-label={label}
        onClick={() => dialog.current?.showModal()}
      >
        <img src={src} alt={alt} />
        <span className="image-caption">↗ 明細を拡大</span>
      </button>
      <dialog
        ref={dialog}
        className="image-dialog"
        aria-labelledby={titleId}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <div className="dialog-head">
          <h2 id={titleId}>元の画像を確認</h2>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            autoFocus
          >
            拡大画像を閉じる
          </button>
        </div>
        <img src={src} alt="給与明細・勤務記録の拡大表示" />
      </dialog>
    </div>
  );
}
