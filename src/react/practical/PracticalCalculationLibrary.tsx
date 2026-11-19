import "./PracticalCalculationLibrary.css";
import type { PracticalPrompt } from "../../cbt/hvacPracticalTypes";
import { practicalSourceLabel } from "../../cbt/practicalLabels";
import { practicalFormulaSummary } from "../../cbt/practicalFormulaSummary";
import { fractionFormula, fractionBasics } from "../../cbt/practicalFractions";
import {
  calculationLesson,
  calculationPrompts,
  practicalSiBasics,
  practicalCalculationPdf,
  practicalCalculationReferences,
  practicalExamFamilies,
  practicalExamFamiliesFor,
  orderPracticalCalculations,
  type PracticalExamFamily,
} from "../../cbt/practicalCalculations";
import { useMemo, useState, useRef } from "react";
import { problemImage } from "../../cbt/problemImages";
import PracticalFractionLines from "./PracticalFractionLines";
const storageKey = "cbt-practical-calculation-filters";
function readFilters(): Record<string, unknown> {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}
function readInitialFilters() {
  const stored = readFilters();
  const scope = stored.scope === "all" ? "all" : "exam";
  const family: "all"|PracticalExamFamily =
    typeof stored.family === "string" &&
    practicalExamFamilies.some((f) => f.key === stored.family)
      ? (stored.family as PracticalExamFamily)
      : "all";
  const topic =
    stored.scope &&
    typeof stored.topic === "string" &&
    [
      "all",
      "공기조화",
      "열관류",
      "배관",
      "냉동사이클",
      "열량·부하",
      "펌프",
      "압력",
    ].includes(stored.topic)
      ? stored.topic
      : "all";
  const source =
    stored.scope &&
    typeof stored.source === "string" &&
    ["all", "restored", "practice"].includes(stored.source)
      ? stored.source
      : "all";
  const kind =
    stored.scope &&
    typeof stored.kind === "string" &&
    ["all", "numeric", "formula"].includes(stored.kind)
      ? stored.kind
      : "all";
  return { scope, family, topic, source, kind };
}

export default function PracticalCalculationLibrary({
  prompts,
  onStart,
}: {
  prompts: PracticalPrompt[];
  onStart: (ids: string[], memorize: boolean) => void;
}) {
  const [filters, setFilters] = useState(readInitialFilters);
  const { scope, family, topic, source, kind } = filters;
  function update(diff: Partial<typeof filters>) {
    const next = { ...filters, ...diff };
    setFilters(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
  }
  const rows = useMemo(
    () => orderPracticalCalculations(calculationPrompts(prompts)),
    [prompts],
  );
  const formulaSection = useRef<HTMLElement>(null),
    problemSection = useRef<HTMLDivElement>(null);
  const examCount = rows.filter(
    (p) => practicalExamFamiliesFor(p).length,
  ).length;
  const topics = [...new Set(rows.map((p) => calculationLesson(p)!.topic))];
  const filtered = rows.filter((p) => {
    const lesson = calculationLesson(p)!;
    const families = practicalExamFamiliesFor(p);
    return (
      (scope === "all" ||
        (families.length > 0 &&
          (family === "all" || families.includes(family)))) &&
      (scope === "exam" || topic === "all" || lesson.topic === topic) &&
      (source === "all" ||
        (source === "restored"
          ? p.group === "restored"
          : p.group !== "restored")) &&
      (kind === "all" || lesson.kind === kind)
    );
  });

  function start(memorize: boolean, prompt?: PracticalPrompt) {
    onStart(prompt ? [prompt.id] : filtered.map((p) => p.id), memorize);
  }
  function selectFamily(family: "all" | PracticalExamFamily) {
    update({ scope: "exam", family, topic: "all", source: "all", kind: "all" });
  }

  return (
    <>
      <section className={"practical-calculation-library"}>
        <header>
          <div>
            <h3>{"필답형 계산문제 모아보기"}</h3>
            <p>
              {
                "기호 읽기부터 숫자 대입·단위 약분까지. 복원문제와 연습문제를 함께 공부합니다."
              }
            </p>
          </div>
          <a href={problemImage(practicalCalculationPdf)} download={true}>
            {"공식·풀이 PDF 받기 ↓"}
          </a>
        </header>
        <nav aria-label={"계산 공부 바로가기"} className={"calculation-jumps"}>
          <button
            type={"button"}
            onClick={() => {
              formulaSection.current?.scrollIntoView({
                block: "start",
                behavior: "smooth",
              });
            }}
          >
            {"공식 먼저 보기"}
          </button>
          <button
            type={"button"}
            onClick={() => {
              problemSection.current?.scrollIntoView({
                block: "start",
                behavior: "smooth",
              });
            }}
          >
            {"문제 "}
            {filtered.length}
            {"개로 이동 ↓"}
          </button>
        </nav>
        <section
          ref={formulaSection}
          aria-label={"먼저 외울 한 줄 공식"}
          className={"formula-recall"}
        >
          <h4>{"먼저 외울 한 줄 공식"}</h4>
          <p>
            {
              "CGT·CR·COP·BF를 먼저, 상사법칙은 함께 기억하세요. 보충 공식은 출제 확정이 아닌 계산 복습용입니다."
            }
          </p>
          <details className={"fraction-intro"}>
            <summary>{"분수 처음 읽기 · 위를 아래로 나눕니다"}</summary>
            <PracticalFractionLines {...{ rows: fractionBasics }} />
            <p>
              {
                "가로 분수선은 괄호 역할도 합니다. 위·아래를 각각 먼저 계산한 뒤 나누세요. 분모가 0이면 나눌 수 없습니다."
              }
            </p>
          </details>
          <div className={"formula-recall-grid"}>
            {practicalFormulaSummary.slice(0, 5).map((item) => (
              <article key={item.key}>
                <h5>{item.title}</h5>
                {fractionFormula(item.formula).length ? (
                  <PracticalFractionLines
                    {...{ rows: fractionFormula(item.formula) }}
                  />
                ) : (
                  <p className={"calculation-formula"}>{item.formula}</p>
                )}
                <details>
                  <summary>{"언제 쓰나 · 기호 뜻 · 암기법"}</summary>
                  <p>{item.when}</p>
                  <p>{item.symbols}</p>
                  <p>
                    <b>{item.remember}</b>
                  </p>
                </details>
              </article>
            ))}
          </div>
          <details className={"formula-recall-more"}>
            <summary>
              {"보충 공식 5개 · 펌프·냉매순환량·송풍량·열관류·현열비"}
            </summary>
            <div className={"formula-recall-grid"}>
              {practicalFormulaSummary.slice(5).map((item) => (
                <article key={item.key}>
                  <h5>{item.title}</h5>
                  {fractionFormula(item.formula).length ? (
                    <PracticalFractionLines
                      {...{ rows: fractionFormula(item.formula) }}
                    />
                  ) : (
                    <p className={"calculation-formula"}>{item.formula}</p>
                  )}
                  <p>{item.when}</p>
                  <p>{item.symbols}</p>
                  <p>
                    <b>{item.remember}</b>
                  </p>
                </article>
              ))}
            </div>
          </details>
          <p>
            {
              "같은 Q라도 열량 또는 유량일 수 있어요. 해당 공식의 뜻·단위를 확인하고, 자세한 숫자 대입은 아래 문제 풀이에서 보세요."
            }
          </p>
        </section>
        <section
          aria-label={"시험 우선 네 가지 공식"}
          className={"practical-exam-focus"}
        >
          <h4>{"이번 시험은 CGT · CR · COP · BF부터"}</h4>
          <p>
            {
              "전달받은 시험 안내: 네 유형 중 계산문제 1개, 경우에 따라 2개. 해당 공식을 중심으로 푸는 "
            }
            {examCount}
            {"문제를 먼저 모았습니다."}
          </p>
          <nav
            aria-label={"시험 우선 공식 선택"}
            className={"practical-exam-family-buttons"}
          >
            <button
              type={"button"}
              aria-pressed={scope === "exam" && family === "all"}
              onClick={() => {
                selectFamily("all");
              }}
            >
              {"네 유형 함께 "}
              {examCount}
            </button>
            {practicalExamFamilies.map((item) => (
              <button
                key={item.key}
                type={"button"}
                aria-pressed={scope === "exam" && family === item.key}
                onClick={() => {
                  selectFamily(item.key);
                }}
              >
                {item.key.toUpperCase()}{" "}
                {
                  rows.filter((p) =>
                    practicalExamFamiliesFor(p).includes(item.key),
                  ).length
                }
              </button>
            ))}
            <button
              type={"button"}
              aria-pressed={scope === "all"}
              onClick={() => {
                update({ scope: "all" });
              }}
            >
              {"전체 계산 "}
              {rows.length}
            </button>
          </nav>
          {practicalExamFamilies.map((item) => (
            <details
              key={item.key}
              open={scope === "exam" && family === item.key}
            >
              <summary>
                {item.title}
                {" · 공식부터 이해하기"}
              </summary>
              {fractionFormula(item.formula).length ? (
                <PracticalFractionLines
                  {...{ rows: fractionFormula(item.formula) }}
                />
              ) : (
                <p className={"calculation-formula"}>{item.formula}</p>
              )}
              <p>{item.when}</p>
              <p>
                <b>{"기호 뜻"}</b> {item.symbols}
              </p>
              <p>
                <b>{"쉬운 예제"}</b> {item.example}
              </p>
              <p>
                <b>{"단위가 남는 과정"}</b> {item.units}
              </p>
              <p className={"calculation-memory"}>{item.remember}</p>
            </details>
          ))}
        </section>
        <details className={"practical-si-basics"}>
          <summary>{"계산이 처음이라면 · SI 단위부터 읽기"}</summary>
          {practicalSiBasics.map((item) => (
            <article key={item.title}>
              <h4>{item.title}</h4>
              <p>{item.text}</p>
            </article>
          ))}
        </details>
        <div ref={problemSection} className={"practical-calculation-filters"}>
          {scope === "all" ? (
            <label>
              {"유형"}
              <select
                value={topic}
                onChange={(event) => {
                  update({ topic: event.currentTarget.value });
                }}
              >
                <option value={"all"}>{"모든 유형"}</option>
                {topics.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            {"출처"}
            <select
              value={source}
              onChange={(event) => {
                update({ source: event.currentTarget.value });
              }}
            >
              <option value={"all"}>{"복원 + 연습 전체"}</option>
              <option value={"restored"}>{"회차별 복원문제"}</option>
              <option value={"practice"}>{"추가 자료·기초·심화"}</option>
            </select>
          </label>
          <label>
            {"문제 종류"}
            <select
              value={kind}
              onChange={(event) => {
                update({ kind: event.currentTarget.value });
              }}
            >
              <option value={"all"}>{"계산 + 공식 쓰기"}</option>
              <option value={"numeric"}>{"숫자 계산만"}</option>
              <option value={"formula"}>{"공식 쓰기만"}</option>
            </select>
          </label>
        </div>
        <div className={"practical-calculation-start"}>
          <strong>
            {filtered.length}
            {"문제"}
          </strong>
          <button
            disabled={!filtered.length}
            type={"button"}
            onClick={() => {
              start(false);
            }}
          >
            {"선택 범위 문제부터 풀기"}
          </button>
          <button
            disabled={!filtered.length}
            type={"button"}
            onClick={() => {
              start(true);
            }}
          >
            {"풀이·공식 공부하기"}
          </button>
        </div>
        <p className={"calculation-scope-note"}>
          {scope === "exam"
            ? "네 공식의 기본·응용 문제를 모았습니다. 얼음 가열·상태 변화처럼 두 공식을 함께 쓰는 문제는 두 유형에 모두 연결하되 한 번만 표시합니다."
            : "기존 계산 분류에 공기조화의 혼합공기·전열 계산도 포함했습니다."}
          {" 전체 계산을 누르면 다른 계산문제도 볼 수 있습니다."}
        </p>
        <ol className={"practical-calculation-index"}>
          {filtered.map((prompt) => (
            <li key={prompt.id}>
              <div>
                <small>
                  {calculationLesson(prompt)!.topic}
                  {" · "}
                  {calculationLesson(prompt)!.kind === "numeric"
                    ? "수치 계산"
                    : "공식 쓰기"}
                  {" · "}
                  {practicalSourceLabel(prompt)}
                </small>
                <strong>{calculationLesson(prompt)!.title}</strong>
                <p>{prompt.question}</p>
              </div>
              <button
                type={"button"}
                onClick={() => {
                  start(true, prompt);
                }}
              >
                {"이 문제 공부 →"}
              </button>
            </li>
          ))}
        </ol>
        {!filtered.length ? (
          <p>
            {"해당 조건의 문제가 없습니다. "}
            <button
              type={"button"}
              onClick={() => {
                selectFamily("all");
              }}
            >
              {"시험 우선 4공식으로 초기화"}
            </button>
          </p>
        ) : null}
        <details>
          <summary>{"공식 원리 참고 자료"}</summary>
          <p>
            {
              "문항 수치와 조건은 기존 복원·연습 자료를 따릅니다. 기본 원리는 아래 자료와 대조했습니다. 문제에서 준 비열·밀도·환산값이 우선입니다."
            }
          </p>
          {practicalCalculationReferences.map((reference) => (
            <a
              key={reference.url}
              href={problemImage(reference.url)}
              target={"_blank"}
              rel={"noreferrer"}
            >
              {reference.title}
              {" ↗ "}
            </a>
          ))}
        </details>
      </section>
    </>
  );
}
