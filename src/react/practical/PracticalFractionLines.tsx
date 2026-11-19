import "./PracticalFractionLines.css";
import {
  fractionTex,
  fractionText,
  type FractionLine,
} from "../../cbt/practicalFractions";
import MathFormula from "./MathFormula";
export default function PracticalFractionLines({
  rows,
}: {
  rows: FractionLine[];
}) {
  return (
    <>
      <div className={"practical-fraction-lines"}>
        {rows.map((row, index) => (
          <div key={index} className={"practical-fraction-line"}>
            <MathFormula
              {...{
                tex: fractionTex(row.parts),
                label: fractionText(row.parts),
              }}
            />
            {row.note ? <p className={"fraction-reading"}>{row.note}</p> : null}
          </div>
        ))}
      </div>
    </>
  );
}
