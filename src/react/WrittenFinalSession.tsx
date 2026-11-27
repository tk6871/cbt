import {useEffect, useRef, useState, type ReactNode} from 'react';

interface WrittenQuestion {
  prompt: string;
  answer: string;
  explanation: string;
  points?: number;
}

interface Props {
  title: string;
  backLabel: string;
  questions: readonly WrittenQuestion[];
  answers: string[];
  onAnswer: (index: number, answer: string) => void;
  onBack: () => void;
  children?: ReactNode;
}

export function WrittenFinalSession({title, backLabel, questions, answers, onAnswer, onBack, children}: Props) {
  const [index, setIndex] = useState(0);
  const [checked, setChecked] = useState<number[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [finished, setFinished] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const focusOnMove = useRef(false);
  const question = questions[index];
  const completed = answers.filter(answer => answer.trim()).length;

  useEffect(() => {
    if (focusOnMove.current) {
      heading.current?.focus();
      focusOnMove.current = false;
    }
  }, [index, finished]);

  function move(next: number, done = false) {
    focusOnMove.current = true;
    setIndex(next);
    setRevealed(false);
    setFinished(done);
  }

  function toggleAnswer() {
    if (!revealed && !checked.includes(index)) setChecked(rows => [...rows, index]);
    setRevealed(!revealed);
  }

  return <section className="final-written" aria-label={title}>
    <header className="written-header">
      <button type="button" className="final-back" onClick={onBack}>← {backLabel}</button>
      <h1>{title}</h1>
      <div className="written-progress">
        <span aria-live="polite">답안 작성 {completed}/{questions.length}</span>
        <progress aria-label="답안 작성 진도" value={completed} max={questions.length}/>
      </div>
    </header>
    {finished ? <article className="written-card">
      <h2 ref={heading} tabIndex={-1}>연습 결과</h2>
      <p>{questions.length}문제 중 {completed}문제 답안 작성</p>
      <p>예시 답안 확인 {checked.length}/{questions.length}</p>
      <div className="written-actions">
        <button type="button" onClick={() => move(0)}>첫 문제로 돌아가기</button>
        <button type="button" className="written-primary" onClick={onBack}>과목 목록</button>
      </div>
    </article> : question && <article className="written-card">
      <div className="written-position">
        <span>문제 {index + 1} / {questions.length}</span>
        {question.points !== undefined && <small>{question.points}점</small>}
      </div>
      <h2 ref={heading} tabIndex={-1}>{question.prompt}</h2>
      <label className="written-answer">
        <span>내 답안</span>
        <textarea key={index} aria-label={`${index + 1}번 답안`} value={answers[index]} onChange={e => onAnswer(index, e.target.value)}/>
      </label>
      <button type="button" className="written-check" aria-expanded={revealed} aria-controls="written-example"
        onClick={toggleAnswer}>
        {revealed ? '답안 접기' : '답안 확인'}
      </button>
      <section id="written-example" className="written-example" hidden={!revealed}>
        <h3>예시 답안</h3><p>{question.answer}</p>
        <h3>{question.points === undefined ? '핵심 해설' : '채점 기준'}</h3><p>{question.explanation}</p>
      </section>
      <nav className="written-actions" aria-label="주관식 문제 이동">
        <button type="button" disabled={index === 0} onClick={() => move(index - 1)}>이전 문제</button>
        {index + 1 < questions.length
          ? <button type="button" className="written-primary" onClick={() => move(index + 1)}>다음 문제</button>
          : <button type="button" className="written-primary" onClick={() => move(index, true)}>풀이 마치기</button>}
      </nav>
    </article>}
    {children}
  </section>;
}
