import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
export default function MathFormula({
  tex,
  label,
}: {
  tex: string;
  label: string;
}) {
  const html = useMemo(
    () =>
      katex.renderToString(tex, {
        displayMode: true,
        throwOnError: false,
        strict: "ignore",
        output: "htmlAndMathml",
      }),
    [tex],
  );
  return (
    <div
      className="math-formula"
      aria-label={label}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
