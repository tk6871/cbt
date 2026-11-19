import "./PracticalSearchLibrary.css";
import {
  practicalCategoryLabels,
  type PracticalPrompt,
} from "../../cbt/hvacPracticalTypes";
import { practicalSourceLabel } from "../../cbt/practicalLabels";
import {
  createPracticalSearchIndex,
  practicalSearchGroupLabels,
  searchPracticalPrompts,
  type PracticalSearchOptions,
} from "../../cbt/practicalSearch";
import { useState, useMemo } from "react";
const storageKey = "cbt-practical-library-search-v1";
function readOptions() {
  const options: PracticalSearchOptions = {
    query: "",
    group: "all",
    category: "all",
    field: "all",
  };
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (saved && typeof saved === "object") {
      if (typeof saved.query === "string")
        options.query = saved.query.slice(0, 200);
      if (
        saved.group === "all" ||
        Object.hasOwn(practicalSearchGroupLabels, saved.group)
      )
        options.group = saved.group;
      if (
        saved.category === "all" ||
        Object.hasOwn(practicalCategoryLabels, saved.category)
      )
        options.category = saved.category;
      if (["all", "question", "answer", "explanation"].includes(saved.field))
        options.field = saved.field;
    }
  } catch {
    /* Invalid search preferences must not affect saved answers. */
  }
  return options;
}
export default function PracticalSearchLibrary({
  prompts,
  onOpen,
}: {
  prompts: PracticalPrompt[];
  onOpen: (ids: string[], selectedId?: string) => void;
}) {
  const [options, setOptions] = useState(readOptions),
    [limit, setLimit] = useState(40);
  const index = useMemo(() => createPracticalSearchIndex(prompts), [prompts]);
  const results = useMemo(
    () => searchPracticalPrompts(index, options),
    [index, options],
  );
  const visible = results.slice(0, limit);
  const fieldLabels = { question: "문제", answer: "정답", explanation: "해설" };
  function change(diff: Partial<PracticalSearchOptions>) {
    const next = { ...options, ...diff };
    setOptions(next);
    setLimit(40);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
  }
  function open(id?: string) {
    if (results.length)
      onOpen(
        results.map((r) => r.prompt.id),
        id,
      );
  }

  return (
    <>
      <section
        aria-label={"필답형 문제 검색"}
        className={"practical-search-library"}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
          }}
          className={"practical-search-form"}
        >
          <label className={"practical-search-query"}>
            <span>{"찾을 내용"}</span>
            <input
              value={options.query}
              onChange={(event) => {
                change({
                  query: event.currentTarget
                    .value as PracticalSearchOptions["query"],
                });
              }}
              maxLength={200}
              type={"search"}
              placeholder={"예: 압축기, COP, 냉매 순환량, 2024 3회"}
              aria-label={"필답형 검색어"}
            />
            <small>
              {
                "띄어쓰기·영문 대소문자와 관계없이 검색합니다. 여러 단어는 모두 포함된 문제를 찾습니다."
              }
            </small>
          </label>
          <label>
            <span>{"검색 위치"}</span>
            <select
              value={options.field}
              onChange={(event) => {
                change({
                  field: event.currentTarget
                    .value as PracticalSearchOptions["field"],
                });
              }}
            >
              <option value={"all"}>{"문제·정답·해설·회차 전체"}</option>
              <option value={"question"}>{"문제 내용만"}</option>
              <option value={"answer"}>{"정답만"}</option>
              <option value={"explanation"}>{"해설·핵심 답안만"}</option>
            </select>
          </label>
          <label>
            <span>{"자료"}</span>
            <select
              value={options.group}
              onChange={(event) => {
                change({
                  group: event.currentTarget
                    .value as PracticalSearchOptions["group"],
                });
              }}
            >
              <option value={"all"}>{"모든 자료"}</option>
              {Object.entries(practicalSearchGroupLabels).map(
                ([group, label]) => (
                  <option key={group} value={group}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </label>
          <label>
            <span>{"분야"}</span>
            <select
              value={options.category}
              onChange={(event) => {
                change({
                  category: event.currentTarget
                    .value as PracticalSearchOptions["category"],
                });
              }}
            >
              <option value={"all"}>{"모든 분야"}</option>
              {Object.entries(practicalCategoryLabels).map(
                ([category, label]) => (
                  <option key={category} value={category}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </label>
        </form>
        {options.query.trim() ? (
          <div aria-live={"polite"} className={"practical-search-status"}>
            <span>
              <strong>{results.length}</strong>
              {"문제 · 목록에는 정답을 표시하지 않습니다."}
            </span>
            <button
              type={"button"}
              disabled={!results.length}
              onClick={() => {
                open();
              }}
            >
              {"검색 결과 모아 풀기 →"}
            </button>
          </div>
        ) : null}
        {!options.query.trim() ? (
          <p className={"practical-search-empty"}>
            {
              "검색어를 입력하면 회차별 기출과 PDF·사진·연습 자료를 함께 찾습니다. 이미지 안 글자는 등록된 문제·정답·해설 텍스트 기준으로 찾습니다."
            }
          </p>
        ) : !results.length ? (
          <p className={"practical-search-empty"}>
            {
              "일치하는 문제가 없습니다. 검색어를 짧게 하거나 자료·분야·검색 위치를 ‘전체’로 바꿔 보세요."
            }
          </p>
        ) : (
          <ol className={"practical-search-results"}>
            {visible.map((result) => (
              <li key={result.prompt.id}>
                <button
                  type={"button"}
                  onClick={() => {
                    open(result.prompt.id);
                  }}
                >
                  <small>
                    {practicalSearchGroupLabels[result.prompt.group]}
                    {" · "}
                    {practicalSourceLabel(result.prompt)}
                    {" · "}
                    {practicalCategoryLabels[result.prompt.category]}
                    {result.prompt.image || result.prompt.images?.length ? (
                      <>{" · 그림 있음"}</>
                    ) : null}
                  </small>
                  <strong>{result.prompt.question}</strong>
                  <span>
                    {result.matchedIn.length
                      ? result.matchedIn
                          .map((field) => fieldLabels[field])
                          .join("·")
                      : "회차·분류"}
                    {"에서 일치 · 문제 열기 →"}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
        {results.length > limit ? (
          <button
            type={"button"}
            onClick={() => {
              setLimit(limit + 40);
            }}
            className={"practical-search-more"}
          >
            {"40문제 더 보기 ("}
            {visible.length}
            {" / "}
            {results.length}
            {")"}
          </button>
        ) : null}
      </section>
    </>
  );
}
