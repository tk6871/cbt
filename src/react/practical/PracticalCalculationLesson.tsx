import type { CalculationLesson } from "../../cbt/practicalCalculations";
import { fractionFormula } from "../../cbt/practicalFractions";
import PracticalFractionLines from "./PracticalFractionLines";
export default function PracticalCalculationLesson({
  lesson,
}: {
  lesson: CalculationLesson;
}) {
  return (
    <>
      <section
        aria-label={"초보자 계산 풀이"}
        className={"practical-calculation-lesson"}
      >
        <h4>{lesson.title}</h4>
        {lesson.numberSelection ? (
          <section
            aria-label={"함정과 조건 구별"}
            className={"calculation-number-selection"}
          >
            <h5>{"숫자부터 골라보기 · 함정과 조건 구별"}</h5>
            <p>
              <b>{"이번 계산에 쓰는 값"}</b> {lesson.numberSelection.used}
            </p>
            {lesson.numberSelection.unused ? (
              <p className={"calculation-unused"}>
                <b>{"이번 식에는 안 쓰는 값"}</b>{" "}
                {lesson.numberSelection.unused}
              </p>
            ) : null}
            <p>
              <b>{"반드시 읽을 조건"}</b> {lesson.numberSelection.condition}
            </p>
            {lesson.temperatureNote ? (
              <p className={"calculation-caution"}>
                <b>{"온도차와 절대온도 구별"}</b> {lesson.temperatureNote}
              </p>
            ) : null}
          </section>
        ) : null}
        <div className={"calculation-formula"}>
          <b>{"먼저 외울 공식"}</b>
          {fractionFormula(lesson.formula).length ? (
            <PracticalFractionLines
              {...{ rows: fractionFormula(lesson.formula) }}
            />
          ) : (
            <p>{lesson.formula}</p>
          )}
        </div>
        <details open={true} className={"calculation-symbols"}>
          <summary>{"기호는 무슨 뜻일까?"}</summary>
          <ul>
            {lesson.symbols.map((symbol) => (
              <li key={symbol}>{symbol}</li>
            ))}
          </ul>
        </details>
        <p>
          <b>{"왜 이렇게 계산할까?"}</b> {lesson.why}
        </p>
        <div className={"calculation-steps"}>
          <b>{"숫자 넣어 풀기"}</b>
          {lesson.fractions?.length ? (
            <PracticalFractionLines {...{ rows: lesson.fractions }} />
          ) : null}
          <ol>
            {lesson.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
        <details open={true} className={"calculation-units"}>
          <summary>{"단위가 왜 이렇게 남을까?"}</summary>
          <ul>
            {lesson.units.map((unit) => (
              <li key={unit}>{unit}</li>
            ))}
          </ul>
        </details>
        {lesson.temperatureFractions ? (
          <details className={"calculation-units"}>
            <summary>{"K로 바꿔 푸는 대체 과정 · 선택"}</summary>
            <PracticalFractionLines
              {...{ rows: lesson.temperatureFractions }}
            />
          </details>
        ) : null}
        {lesson.examAnswer ? (
          <div className={"calculation-final"}>
            <b>{"시험 답안의 최종값 예시"}</b>
            <p>{lesson.examAnswer}</p>
            <small>
              {lesson.rounding}
              {" 위 계산과정도 함께 작성하세요."}
            </small>
          </div>
        ) : null}
        <p className={"calculation-memory"}>
          <b>{"한 줄로 기억"}</b> {lesson.memory}
        </p>
        {lesson.caution ? (
          <p className={"calculation-caution"}>
            <b>{"이 문제의 조건"}</b> {lesson.caution}
          </p>
        ) : null}
      </section>
    </>
  );
}
