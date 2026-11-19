import { useRef, useState, useLayoutEffect } from "react";
import { problemImage } from "../../cbt/problemImages";
export default function PracticalProblemImage({
  src,
  alt,
  maxHeight,
}: {
  src: string;
  alt: string;
  maxHeight?: number;
}) {
  const [zoom, setZoom] = useState(100),
    [opened, setOpened] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    viewport = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const area = viewport.current;
    if (area) {
      area.scrollLeft = Math.max(0, (area.scrollWidth - area.clientWidth) / 2);
      area.scrollTop = Math.max(0, (area.scrollHeight - area.clientHeight) / 2);
    }
  }, [zoom, opened]);
  function open() {
    setZoom(100);
    setOpened(true);
    dialog.current?.showModal();
  }

  return (
    <>
      <button
        type={"button"}
        aria-label={alt + " 크게 보기"}
        onClick={open}
        className={"practical-image-button"}
      >
        <img
          src={problemImage(src)}
          alt={alt}
          style={
            maxHeight
              ? {
                  maxHeight: maxHeight + "px",
                  height: "auto",
                  width: "auto",
                  maxWidth: "100%",
                  marginInline: "auto",
                }
              : undefined
          }
          loading={"lazy"}
          decoding={"async"}
          className={"practical-prompt-image"}
        />
        <span>{"그림 크게 보기 ↗"}</span>
      </button>
      <dialog
        ref={dialog}
        aria-label={alt}
        onClose={() => {
          setOpened(false);
        }}
        className={"practical-image-dialog"}
      >
        <header>
          <strong>{alt}</strong>
          <label>
            {"확대 "}
            <select
              value={zoom}
              onChange={(event) => {
                setZoom(Number(event.currentTarget.value));
              }}
              aria-label={"그림 확대 비율"}
            >
              {[100, 150, 200, 300, 400].map((size) => (
                <option key={size} value={size}>
                  {size === 100 ? "그림 전체 맞춤" : size + "%"}
                </option>
              ))}
            </select>
          </label>
          <button
            type={"button"}
            autoFocus={true}
            onClick={() => {
              dialog.current?.close();
            }}
          >
            {"닫기"}
          </button>
        </header>
        {opened ? (
          <div ref={viewport} className={"practical-image-viewport"}>
            <button
              type={"button"}
              aria-label={alt + " 확대 닫기"}
              style={{ width: zoom + "%", height: zoom + "%" }}
              onClick={() => {
                dialog.current?.close();
              }}
              className={"practical-image-close-target"}
            >
              <img src={problemImage(src)} alt={alt} />
            </button>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
