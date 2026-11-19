import "./PracticalIssueReport.css";
import type { PracticalPrompt } from "../../cbt/hvacPracticalTypes";
import {
  submitQuestionIssue,
  type QuestionIssueType,
} from "../../cbt/cloudSync";
import { practicalIssueSnapshot } from "../../cbt/practicalIssue";
import { useState, useRef } from "react";
const options: Array<[QuestionIssueType, string]> = [
  ["answer", "답안 오류·누락"],
  ["explanation", "설명 오류·부족"],
  ["wrong-image", "그림 잘림·잘못된 그림"],
  ["missing-image", "그림 없음"],
  ["text-ocr", "문제·수식 오류"],
  ["layout", "화면 배치"],
  ["other", "기타"],
];

export default function PracticalIssueReport({
  prompt,
  displayNumber,
}: {
  prompt: PracticalPrompt;
  displayNumber: number;
}) {
  const [open, setOpen] = useState(false),
    [sending, setSending] = useState(false),
    [submitted, setSubmitted] = useState(false);
  const busy = useRef(false);
  const [types, setTypes] = useState<QuestionIssueType[]>([]),
    [details, setDetails] = useState(""),
    [error, setError] = useState("");
  const [imageIndex, setImageIndex] = useState(0);
  const images = [
    ...new Set(
      [
        prompt.image,
        ...(prompt.images || []),
        ...(prompt.answerImages || []),
      ].filter((s): s is string => !!s),
    ),
  ];
  function toggle(value: QuestionIssueType) {
    setTypes(
      types.includes(value)
        ? types.filter((t) => t !== value)
        : [...types, value],
    );
    setError("");
  }
  async function send() {
    if (busy.current) return;
    if (!types.length || details.trim().length < 3) {
      setError("문제 유형을 고르고 내용을 3자 이상 적어 주세요.");
      return;
    }
    busy.current = true;
    setSending(true);
    setError("");
    try {
      const error = await submitQuestionIssue({
        ...practicalIssueSnapshot(prompt, displayNumber, images[imageIndex]),
        space: window.CBT_APP_SPACE === "jewelry" ? "jewelry" : "industrial",
        issue_types: types,
        details,
        page_url: location.href,
        app_version: window.CBT_CHANGELOG?.currentVersion,
        device_info:
          navigator.platform + " · " + navigator.userAgent.slice(0, 300),
      });
      if (error) setError(error);
      else {
        setSubmitted(true);
        setOpen(false);
      }
    } catch {
      setError(
        "신고를 저장하지 못했습니다. 입력 내용은 유지됩니다. 다시 시도해 주세요.",
      );
    } finally {
      busy.current = false;
      setSending(false);
    }
  }

  return (
    <>
      <section
        aria-label={"필답형 문제 이상 신고"}
        className={"practical-issue"}
      >
        <button
          type={"button"}
          aria-expanded={open}
          onClick={() => {
            setOpen(!open);
          }}
        >
          {submitted ? "✓ 신고 접수됨" : "☐ 이상 신고"}
        </button>
        {open ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            <header>
              <strong>{"이 문제의 이상한 점을 알려주세요"}</strong>
              <button
                type={"button"}
                aria-label={"필답형 신고창 닫기"}
                onClick={() => {
                  setOpen(false);
                }}
              >
                {"닫기"}
              </button>
            </header>
            <div className={"issue-types"}>
              {options.map(([value, label]) => (
                <button
                  key={value}
                  type={"button"}
                  aria-pressed={types.includes(value)}
                  onClick={() => {
                    toggle(value);
                  }}
                >
                  {types.includes(value) ? "✓ " : ""}
                  {label}
                </button>
              ))}
            </div>
            {images.length > 1 ? (
              <label>
                {"문제가 있는 이미지"}
                <select
                  value={imageIndex}
                  onChange={(event) => {
                    setImageIndex(Number(event.currentTarget.value));
                  }}
                >
                  {images.map((image, i) => (
                    <option key={image} value={i}>
                      {i + 1}
                      {"번째 이미지 · "}
                      {image.split("/").at(-1)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label>
              {"무엇이 문제인가요?"}
              <textarea
                value={details}
                onChange={(event) => {
                  setDetails(event.currentTarget.value);
                }}
                rows={3}
                maxLength={1500}
                placeholder={
                  "예: 오른쪽 배관 그림이 잘렸습니다. / 특징 답안이 빠졌습니다."
                }
                disabled={sending}
              />
            </label>
            {error ? <p role={"alert"}>{error}</p> : null}
            <footer>
              <small>
                {details.length}
                {"/1500자 · 관리자 확인용으로만 저장됩니다."}
              </small>
              <button type={"submit"} disabled={sending}>
                {sending ? "저장 중…" : "이상 문제 저장"}
              </button>
            </footer>
          </form>
        ) : null}
      </section>
    </>
  );
}
