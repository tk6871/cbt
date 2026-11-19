import { useMemo, useState } from 'react';
import { ComputeEngine } from '@cortex-js/compute-engine';
import { Calculator, RotateCcw, X } from 'lucide-react';
import MathFormula from '../practical/MathFormula';
import './formula-workbench.css';
const example = String.raw`\frac{(760-300)\times101.325}{760}`;
export default function FormulaWorkbench({ onClose }: { onClose: () => void }) {
  const [engine] = useState(() => new ComputeEngine());
  const [latex, setLatex] = useState(example);
  const parsed = useMemo(() => {
    try {
      const expression = engine.parse(latex);
      if (!latex.trim() || expression.errors.length) return null;
      return {
        simplified: expression.simplify().latex,
        result: expression.N().latex,
      };
    } catch {
      return null;
    }
  }, [engine, latex]);
  return (
    <section className="formula-workbench">
      <header>
        <div>
          <span>
            <Calculator size={18} />
          </span>
          <strong>수식 계산 실험실</strong>
          <small>LaTeX 수식을 해석하고 계산 결과를 확인합니다</small>
        </div>
        <button type="button" aria-label="닫기" onClick={onClose}>
          <X size={18} />
        </button>
      </header>
      <label>
        LaTeX 수식
        <textarea
          value={latex}
          onChange={(e) => setLatex(e.currentTarget.value)}
          rows={3}
          spellCheck={false}
        />
      </label>
      {parsed ? (
        <div className="formula-workbench-result">
          <article>
            <span>입력 수식</span>
            <MathFormula tex={latex} label="입력한 계산식" />
          </article>
          <article>
            <span>정리된 식</span>
            <MathFormula tex={parsed.simplified} label="정리된 계산식" />
          </article>
          <article className="answer">
            <span>계산 결과</span>
            <MathFormula tex={parsed.result} label="계산 결과" />
          </article>
        </div>
      ) : (
        <p role="status">수식 기호나 괄호를 확인해 주세요.</p>
      )}
      <footer>
        <button type="button" onClick={() => setLatex(example)}>
          <RotateCcw size={15} />
          예시로 초기화
        </button>
        <small>이 도구는 직접 열었을 때만 계산 엔진을 불러옵니다.</small>
      </footer>
    </section>
  );
}
