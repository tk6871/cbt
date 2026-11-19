import { comparePracticalQuantities } from "../../cbt/practicalQuantities";
import type {
  PracticalAssessment,
  PracticalConfidence,
  PracticalMistakeReason,
  PracticalPrompt,
} from "../../cbt/hvacPracticalTypes";
import {
  criterionMatchesDraft,
  maskPracticalAnswer,
  practicalAnswerTemplate,
  practicalCategoryHint,
  practicalCriteria,
  practicalExpectedNumbers,
  practicalExpectedUnits,
  practicalInitialHint,
  practicalRequirementLines,
  practicalContainsNumber,
  practicalContainsUnit,
} from "../../cbt/hvacPracticalTraining";

import { useState, type ChangeEvent } from "react";
import {clsx as normalizeClass} from "clsx";
interface Props {
  prompt: PracticalPrompt;
  draft: string;
  revealed: boolean;
  assessment?: PracticalAssessment;
  similarCount: number;
  onUpdate(v: PracticalAssessment): void;
  onInsertTemplate(v: string): void;
  onReveal(): void;
}
export default function PracticalTrainingTools(props: Props) {
  const { prompt, draft, revealed, assessment, similarCount } = props;
  const [guideOpen, setGuideOpen] = useState(false),
    [blankOpen, setBlankOpen] = useState(false),
    [checklistOpen, setChecklistOpen] = useState(false),
    [speechListening, setSpeechListening] = useState(false);
  const [retryStage, setRetryStage] = useState<
    "formula" | "substitution" | "calculation" | "unit"
  >("formula");
  const retryStages = [
    {
      key: "formula",
      label: "공식",
      placeholder: "숫자 대신 기호로 공식을 적어보세요.",
    },
    {
      key: "substitution",
      label: "대입",
      placeholder: "기호 자리에 문제의 숫자를 넣어보세요.",
    },
    {
      key: "calculation",
      label: "계산",
      placeholder: "괄호부터 계산하고 계산 결과를 적어보세요.",
    },
    {
      key: "unit",
      label: "단위",
      placeholder: "최종 숫자와 문제에서 요구한 단위를 적어보세요.",
    },
  ] as const;
  const retryStageInfo = retryStages.find((stage) => stage.key === retryStage)!;
  function updateRetry(event: ChangeEvent<HTMLTextAreaElement>): void {
    update({
      calculationRetry: {
        ...props.assessment?.calculationRetry,
        [retryStage]: (event.target as HTMLTextAreaElement).value,
      },
    });
  }
  function insertCalculationRetry(): void {
    props.onInsertTemplate(
      retryStages
        .map(
          (stage) =>
            `${stage.label}: ${props.assessment?.calculationRetry?.[stage.key] || ""}`,
        )
        .join("\n"),
    );
  }

  const criteria = practicalCriteria(props.prompt);
  const requirements = practicalRequirementLines(props.prompt);
  const units = practicalExpectedUnits(props.prompt);
  const numbers = practicalExpectedNumbers(props.prompt);
  const checkedIds = props.assessment?.checkedPointIds || [];
  const autoMatchedIds = criteria
    .filter((criterion) => criterionMatchesDraft(criterion, props.draft))
    .map((criterion) => criterion.id);
  const effectiveIds = [...new Set([...checkedIds, ...autoMatchedIds])].filter(
    (id) => !props.assessment?.rejectedPointIds?.includes(id),
  );
  const score = criteria.length
    ? Math.round(
        (effectiveIds.length / criteria.length) * props.prompt.points * 2,
      ) / 2
    : props.assessment?.score || 0;
  const unitCheck = units.map((unit) => ({
    unit,
    found: practicalContainsUnit(props.draft, unit),
  }));
  const numberCheck = numbers.map((number) => ({
    number,
    found: practicalContainsNumber(props.draft, number),
  }));
  const quantityCheck = comparePracticalQuantities(
    props.prompt.answer,
    props.draft,
  );
  const requiredAnswerCount = Number(
    props.prompt.question.match(
      /(\d+)\s*(가지|개|항목|종류|방법|원인|대책)/,
    )?.[1] || 0,
  );
  const writtenAnswerCount = props.draft
    .split(/\n|[.;。]/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 2).length;
  const countWarning =
    requiredAnswerCount > 0 && writtenAnswerCount < requiredAnswerCount;
  const rangeWarning = computeRangeWarning();
  function computeRangeWarning() {
    if (quantityCheck.some((row) => row.match)) return "";
    const expected = numbers
      .map(Number)
      .filter((value) => Number.isFinite(value) && value !== 0);
    const written = (props.draft.match(/(?<![a-z가-힣])\d+(?:\.\d+)?/gi) || [])
      .map(Number)
      .filter((value) => Number.isFinite(value) && value !== 0);
    if (!expected.length || !written.length) return "";
    const finalWritten = written.at(-1)!;
    const closestRatio = Math.min(
      ...expected.map(
        (value) =>
          Math.max(finalWritten, value) / Math.min(finalWritten, value),
      ),
    );
    return closestRatio >= 10
      ? "최종 숫자의 자리수가 모범답안과 크게 다릅니다. 소수점·단위 환산을 확인하세요."
      : "";
  }
  const missingCriteria = criteria.filter(
    (criterion) => !effectiveIds.includes(criterion.id),
  );
  const scoreTips = computeScoreTips();
  function computeScoreTips() {
    const tips: string[] = [];
    if (criteria.some((criterion) => criterion.kind === "formula"))
      tips.push(
        "공식을 먼저 쓰면 최종 숫자가 틀려도 계산 과정 점수를 받을 수 있습니다.",
      );
    if (criteria.some((criterion) => criterion.kind === "unit"))
      tips.push("마지막 숫자 뒤에 단위를 크게 써서 단위 점수를 놓치지 마세요.");
    if (criteria.some((criterion) => criterion.kind === "diagram"))
      tips.push("도면은 기호·연결선·흐름 방향을 각각 확인하세요.");
    const count = props.prompt.question.match(
      /(\d+)\s*(가지|개|항목|종류|방법|원인|대책)/,
    )?.[1];
    if (count)
      tips.push(
        `${count}개를 요구하므로 답안 번호도 ${count}개까지 먼저 적어 두세요.`,
      );
    if (!tips.length)
      tips.push(
        "완전한 문장보다 채점 핵심어를 먼저 적어 부분점수를 확보하세요.",
      );
    return tips;
  }

  const mistakeOptions: Array<{ key: PracticalMistakeReason; label: string }> =
    [
      { key: "formula", label: "공식" },
      { key: "substitution", label: "대입" },
      { key: "calculation", label: "계산" },
      { key: "unit", label: "단위" },
      { key: "keyword", label: "핵심어" },
      { key: "count", label: "개수 누락" },
      { key: "diagram", label: "도면" },
      { key: "time", label: "시간 부족" },
    ];

  function update(patch: Partial<PracticalAssessment>): void {
    props.onUpdate({ ...(props.assessment || {}), ...patch });
  }

  function nextHint(): void {
    const next = Math.min(3, (props.assessment?.hintLevel || 0) + 1);
    update({
      hintLevel: next,
      firstStartedAt: props.assessment?.firstStartedAt || Date.now(),
    });
  }

  function hintText(): string {
    const level = props.assessment?.hintLevel || 0;
    if (level <= 1)
      return `${practicalCategoryHint(props.prompt)} 첫 글자: ${practicalInitialHint(props.prompt)}`;
    if (level === 2)
      return criteria.map((criterion) => criterion.label).join(" · ");
    return practicalAnswerTemplate(props.prompt);
  }

  function toggleCriterion(id: string): void {
    const remove = effectiveIds.includes(id);
    const next = remove
      ? checkedIds.filter((value) => value !== id)
      : [...checkedIds, id];
    const rejected = remove
      ? [...new Set([...(props.assessment?.rejectedPointIds || []), id])]
      : (props.assessment?.rejectedPointIds || []).filter(
          (value) => value !== id,
        );
    const nextEffective = new Set(
      [...next, ...autoMatchedIds].filter((value) => !rejected.includes(value)),
    );
    const nextScore = criteria.length
      ? Math.round(
          (nextEffective.size / criteria.length) * props.prompt.points * 2,
        ) / 2
      : 0;
    update({
      checkedPointIds: next,
      rejectedPointIds: rejected,
      score: nextScore,
      lastGradedAt: Date.now(),
    });
  }

  function toggleMistake(reason: PracticalMistakeReason): void {
    const current = props.assessment?.mistakeReasons || [];
    update({
      mistakeReasons: current.includes(reason)
        ? current.filter((value) => value !== reason)
        : [...current, reason],
    });
  }

  function setConfidence(confidence: PracticalConfidence): void {
    update({ confidence });
  }

  function insertRetrySheet(): void {
    const lines = missingCriteria.length
      ? missingCriteria.map(
          (criterion, index) => `${index + 1}. ${criterion.label}: `,
        )
      : ["빠진 채점 요소가 없습니다. 전체 답을 보지 않고 한 번 더 작성하세요."];
    props.onInsertTemplate(
      `[오답 수술 · 빠진 부분만 다시 쓰기]\n${lines.join("\n")}`,
    );
  }

  function speakQuestion(): void {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(props.prompt.question);
    utterance.lang = "ko-KR";
    utterance.rate = 0.94;
    speechSynthesis.speak(utterance);
  }

  function startSpeechAnswer(): void {
    type RecognitionCtor = new () => {
      lang: string;
      interimResults: boolean;
      continuous: boolean;
      start: () => void;
      onresult:
        | ((event: {
            results: ArrayLike<{ 0: { transcript: string } }>;
          }) => void)
        | null;
      onend: (() => void) | null;
      onerror: (() => void) | null;
    };
    const speechWindow = window as typeof window & {
      SpeechRecognition?: RecognitionCtor;
      webkitSpeechRecognition?: RecognitionCtor;
    };
    const Recognition =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.lang = "ko-KR";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript || "";
      if (transcript)
        props.onInsertTemplate(
          `${props.draft}${props.draft ? "\n" : ""}[말로 답하기] ${transcript}`,
        );
    };
    recognition.onend = () => {
      setSpeechListening(false);
    };
    recognition.onerror = () => {
      setSpeechListening(false);
    };
    setSpeechListening(true);
    recognition.start();
  }

  return (
    <>
      <section className={"practical-training-tools"}>
        <header>
          <div>
            <strong>{"답안 작성 도우미"}</strong>
            <small>
              {"힌트를 적게 쓰고 직접 작성할수록 실제 시험에 가까워집니다."}
            </small>
          </div>
          <div>
            <button type={"button"} onClick={speakQuestion}>
              {"🔊 문제 읽기"}
            </button>
            <button
              type={"button"}
              disabled={speechListening}
              onClick={startSpeechAnswer}
            >
              {speechListening ? "듣는 중…" : "🎙 말로 답하기"}
            </button>
          </div>
        </header>
        <div className={"practical-requirements"}>
          {requirements.map((line) => (
            <span key={line}>
              {"✓ "}
              {line}
            </span>
          ))}
          <span>
            {"연결된 같은 분야 "}
            {similarCount}
            {"문제"}
          </span>
        </div>
        <div className={"practical-helper-actions"}>
          <button
            type={"button"}
            onClick={() => {
              props.onInsertTemplate(practicalAnswerTemplate(prompt));
            }}
          >
            {"답안 골격 넣기"}
          </button>
          <button
            type={"button"}
            onClick={() => {
              setGuideOpen(!guideOpen);
            }}
          >
            {guideOpen ? "힌트 닫기" : "단계별 힌트"}
          </button>
          {revealed ? (
            <button
              type={"button"}
              onClick={() => {
                setBlankOpen(!blankOpen);
              }}
            >
              {blankOpen ? "빈칸 닫기" : "빈칸 암기"}
            </button>
          ) : null}
          {revealed ? (
            <button
              type={"button"}
              onClick={() => {
                setChecklistOpen(!checklistOpen);
              }}
            >
              {checklistOpen ? "채점표 닫기" : "부분점수 채점"}
            </button>
          ) : null}
        </div>
        <details className={"practical-score-strategy"}>
          <summary>{"시간이 부족할 때 부분점수 확보법"}</summary>
          <ul>
            {scoreTips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </details>
        {guideOpen ? (
          <div className={"practical-hint-panel"}>
            {assessment?.hintLevel ? (
              <p>
                <b>
                  {assessment.hintLevel}
                  {"단계 힌트"}
                </b>
                {hintText()}
              </p>
            ) : (
              <p>{"아직 힌트를 사용하지 않았습니다."}</p>
            )}
            {(assessment?.hintLevel || 0) < 3 ? (
              <button type={"button"} onClick={nextHint}>
                {"힌트 한 단계 열기"}
              </button>
            ) : !revealed ? (
              <button
                type={"button"}
                onClick={() => {
                  props.onReveal();
                }}
              >
                {"모범답안 보기"}
              </button>
            ) : null}
          </div>
        ) : null}
        {revealed && blankOpen ? (
          <div className={"practical-blank-answer"}>
            <strong>{"핵심어 빈칸 복원"}</strong>
            <p>{maskPracticalAnswer(prompt)}</p>
          </div>
        ) : null}
        {revealed && checklistOpen ? (
          <div className={"practical-rubric-panel"}>
            <header>
              <div>
                <strong>
                  {"예상 부분점수 "}
                  {score}
                  {" / "}
                  {prompt.points}
                  {"점"}
                </strong>
                <small>
                  {
                    "학습용 균등 배점이며 공식 채점표가 아닙니다. 자동 감지는 참고만 하고, 같은 뜻의 표현·계산 과정은 직접 체크하거나 해제하세요."
                  }
                </small>
              </div>
            </header>
            <div className={"practical-rubric-list"}>
              {criteria.map((criterion) => (
                <button
                  key={criterion.id}
                  type={"button"}
                  onClick={() => {
                    toggleCriterion(criterion.id);
                  }}
                  className={normalizeClass([
                    {
                      matched: effectiveIds.includes(criterion.id),
                      automatic: autoMatchedIds.includes(criterion.id),
                    },
                  ])}
                >
                  <span>{effectiveIds.includes(criterion.id) ? "✓" : "○"}</span>
                  <b>{criterion.label}</b>
                  <small>
                    {assessment?.rejectedPointIds?.includes(criterion.id)
                      ? "직접 제외함"
                      : autoMatchedIds.includes(criterion.id)
                        ? "내 답에서 감지 · 확인 필요"
                        : "직접 확인"}
                  </small>
                </button>
              ))}
            </div>
            {unitCheck.length || numberCheck.length ? (
              <div className={"practical-value-check"}>
                <strong>{"숫자·단위 원문 표기 확인"}</strong>
                {numberCheck.map((item) => (
                  <span
                    key={`number-${item.number}`}
                    className={normalizeClass([{ found: item.found }])}
                  >
                    {item.found ? "✓" : "○"} {item.number}
                  </span>
                ))}
                {unitCheck.map((item) => (
                  <span
                    key={`unit-${item.unit}`}
                    className={normalizeClass([{ found: item.found }])}
                  >
                    {item.found ? "✓" : "○"} {item.unit}
                  </span>
                ))}
              </div>
            ) : null}
            {quantityCheck.length ? (
              <div className={"practical-value-check"}>
                <strong>{"단위 환산 비교"}</strong>
                {quantityCheck.map((row, index) => (
                  <span
                    key={index}
                    className={normalizeClass([{ found: Boolean(row.match) }])}
                  >
                    {row.match ? "✓" : "○"} {row.expected.text}
                    {row.match
                      ? ` = ${row.match.text}`
                      : " · 아직 감지되지 않음"}
                  </span>
                ))}
                <small>
                  {
                    "같은 물리량의 SI 환산만 비교합니다. 값이 같아도 문제에서 요구한 단위·계산 과정은 직접 확인하세요. 온도 ℃↔K와 압력 기준 변환은 자동 판단하지 않습니다."
                  }
                </small>
              </div>
            ) : null}
            {countWarning || rangeWarning ? (
              <p className={"practical-check-warning"}>
                {countWarning ? (
                  <span>
                    {"요구된 "}
                    {requiredAnswerCount}
                    {"개 중 현재 답안은 약 "}
                    {writtenAnswerCount}
                    {"개로 보입니다."}
                  </span>
                ) : null}
                {rangeWarning ? <span>{rangeWarning}</span> : null}
              </p>
            ) : null}
            <div className={"practical-mistake-picker"}>
              <strong>{"이번에 놓친 부분"}</strong>
              {mistakeOptions.map((option) => (
                <button
                  key={option.key}
                  type={"button"}
                  onClick={() => {
                    toggleMistake(option.key);
                  }}
                  className={normalizeClass([
                    {
                      active: assessment?.mistakeReasons?.includes(option.key),
                    },
                  ])}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className={"practical-confidence-picker"}>
              <strong>{"답안 확신"}</strong>
              <button
                type={"button"}
                onClick={() => {
                  setConfidence("low");
                }}
                className={normalizeClass([
                  { active: assessment?.confidence === "low" },
                ])}
              >
                {"막힘"}
              </button>
              <button
                type={"button"}
                onClick={() => {
                  setConfidence("medium");
                }}
                className={normalizeClass([
                  { active: assessment?.confidence === "medium" },
                ])}
              >
                {"애매"}
              </button>
              <button
                type={"button"}
                onClick={() => {
                  setConfidence("high");
                }}
                className={normalizeClass([
                  { active: assessment?.confidence === "high" },
                ])}
              >
                {"확실"}
              </button>
            </div>
            <button
              type={"button"}
              onClick={insertRetrySheet}
              className={"practical-retry-missing"}
            >
              {"빠진 부분만 다시 작성"}
            </button>
            {prompt.category === "calculation" ||
            criteria.some((item) => item.kind === "formula") ? (
              <details className={"practical-calculation-retry"}>
                <summary>{"막힌 계산 단계만 연습"}</summary>
                <div className={"practical-helper-actions"}>
                  {retryStages.map((stage) => (
                    <button
                      key={stage.key}
                      type={"button"}
                      aria-pressed={retryStage === stage.key}
                      onClick={() => {
                        setRetryStage(stage.key);
                      }}
                    >
                      {stage.label}
                    </button>
                  ))}
                </div>
                <label className={"practical-answer-input"}>
                  <span>
                    {retryStageInfo.label}
                    {" 다시 쓰기"}
                  </span>
                  <textarea
                    value={assessment?.calculationRetry?.[retryStage] || ""}
                    placeholder={retryStageInfo.placeholder}
                    rows={3}
                    onChange={updateRetry}
                  />
                </label>
                <details>
                  <summary>{"기존 해설을 기준으로 비교"}</summary>
                  <p className={"practical-retry-reference"}>
                    {prompt.explanation}
                  </p>
                  <p className={"practical-retry-reference"}>{prompt.answer}</p>
                </details>
                <button type={"button"} onClick={insertCalculationRetry}>
                  {"연습한 네 단계를 내 답안에 넣기"}
                </button>
              </details>
            ) : null}
            <details className={"practical-reverse-drill"}>
              <summary>{"역문제 훈련"}</summary>
              <p>
                <b>{"아래 답이 사용되는 문제 유형을 먼저 말해보세요."}</b>
                {prompt.answer}
              </p>
            </details>
            {assessment?.answerHistory?.length ? (
              <details className={"practical-answer-history"}>
                <summary>
                  {"이전 답안과 성장 비교 · "}
                  {assessment.answerHistory.length}
                  {"회"}
                </summary>
                {assessment.answerHistory.map((entry, index) => (
                  <article key={entry.gradedAt}>
                    <header>
                      <b>
                        {index + 1}
                        {"회 답안"}
                      </b>
                      <span>
                        {entry.score}
                        {"점 · "}
                        {new Date(entry.gradedAt).toLocaleDateString("ko-KR")}
                      </span>
                    </header>
                    <p>{entry.draft}</p>
                  </article>
                ))}
              </details>
            ) : null}
          </div>
        ) : null}
      </section>
    </>
  );
}
