import { useEffect, useRef } from "react";
export default function PracticalLoadMore({ onMore }: { onMore: () => void }) {
  const target = useRef<HTMLButtonElement>(null),
    callback = useRef(onMore);
  callback.current = onMore;
  useEffect(() => {
    const el = target.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (rows) => {
        if (rows.some((e) => e.isIntersecting)) callback.current();
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <button
      ref={target}
      type="button"
      className="practical-load-more"
      onClick={onMore}
    >
      아래 문제 계속 보기
    </button>
  );
}
