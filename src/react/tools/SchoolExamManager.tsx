import {useState,useMemo,useLayoutEffect,useEffect,useRef,lazy} from 'react';
import {OptionalTool} from '../OptionalTool';
import './school-exams.css';
import { z } from 'zod';
import type { CardInput } from 'ts-fsrs';
import { mergeSchoolExamData, normalizeSchoolExamData, type SchoolExamData, type SchoolExamKind, type SchoolMemoryCard } from '../../cbt/schoolExam';
import { generalChatPatchPrompt, schoolPhotoJsonPrompt } from '../../cbt/schoolExamPrompts';
import type { Round, StudyMode } from '../../cbt/types';

const schoolImportSchema = z.object({
  rounds: z.array(z.unknown()).optional(),
  scopes: z.array(z.unknown()).optional(),
  memoryCards: z.array(z.unknown()).optional(),
  questionSets: z.array(z.unknown()).optional(),
}).passthrough().refine(data => [data.rounds, data.scopes, data.memoryCards, data.questionSets].some(Array.isArray));

const SchoolSourcePrep=lazy(()=>import('./SchoolSourcePrep'));
export interface SchoolExamProps {
 data:SchoolExamData;
 onUpdate:(data:SchoolExamData)=>void;
 onStart:(payload:{round:Round;mode:StudyMode})=>void;
 onStartSet:(payload:{id:string;mode:StudyMode})=>void;
 onSearch:(id:string)=>void;
}
export default function SchoolExamManager({data,onUpdate,onStart,onStartSet,onSearch}:SchoolExamProps) {
 const latest=useRef(data);
 useLayoutEffect(()=>{latest.current=data;},[data]);
 const importInput=useRef<HTMLInputElement>(null),mergeInput=useRef<HTMLInputElement>(null);
 const copyTimer=useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
 useEffect(()=>()=>clearTimeout(copyTimer.current),[]);
const [copiedPrompt,setCopiedPrompt] = useState<'photo' | 'patch' | ''>('');
const [sourcePrepOpen,setSourcePrepOpen] = useState(false);
const [selectedRoundId,setSelectedRoundId] = useState(data.rounds[0]?.id || '');
const [memoryOpenId,setMemoryOpenId] = useState('');
const [subject,setSubject] = useState('');
const [year,setYear] = useState(new Date().getFullYear());
const [semester,setSemester] = useState<1 | 2>(1);
const [examKind,setExamKind] = useState<SchoolExamKind>('midterm');
const [textbook,setTextbook] = useState('');
const [pages,setPages] = useState('');
const [note,setNote] = useState('');
const [questionText,setQuestionText] = useState('');
const [choices,setChoices] = useState(['', '', '', '']);
const [answer,setAnswer] = useState(1);
const [explanation,setExplanation] = useState('');
const [questionPage,setQuestionPage] = useState('');
const [teacherHint,setTeacherHint] = useState('');
const [memoryPrompt,setMemoryPrompt] = useState('');
const [memoryAnswer,setMemoryAnswer] = useState('');
const [memoryPage,setMemoryPage] = useState('');
const [memoryHint,setMemoryHint] = useState('');

const selectedRound = data.rounds.find((round) => round.id === selectedRoundId) || null;
const sortedMemoryCards = useMemo(() => [...data.memoryCards].sort((a, b) => {
  const left = a.nextReviewAt || 0;
  const right = b.nextReviewAt || 0;
  if (!left && !right) return 0;
  if (!left) return -1;
  if (!right) return 1;
  return left - right;
}),[data.memoryCards]);
const kindLabel: Record<SchoolExamKind, string> = { midterm: '중간고사', final: '기말고사', quiz: '쪽지시험', other: '기타 시험' };
function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function commit(next: SchoolExamData): void {
  latest.current = normalizeSchoolExamData(next);
  onUpdate(latest.current);
}

function scopeFor(round: Round) {
  return latest.current.scopes.find((scope) => scope.id === round.id);
}

function removeQuestionSet(id: string): void {
  if (!confirm('이 학교 시험지의 문제 목록을 삭제할까요? 원래 기출문제와 학습 기록은 유지됩니다.')) return;
  commit({ ...latest.current, questionSets: latest.current.questionSets?.filter(set => set.id !== id) });
}

async function copyPrompt(prompt: string, kind: 'photo' | 'patch'): Promise<void> {
  try {
    await navigator.clipboard.writeText(prompt);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = prompt;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
  setCopiedPrompt(kind);
  clearTimeout(copyTimer.current);
  copyTimer.current=setTimeout(()=>setCopiedPrompt(''),1800);
}

function addScopeAndRound(): void {
  const cleanSubject = subject.trim();
  if (!cleanSubject) return;
  const id = uid('school-round');
  const round: Round = {
    id,
    qualificationKey: 'school-exams',
    qualification: '학교 중간·기말고사',
    shortQualification: '학교 시험',
    year: year,
    semester: semester,
    examKind: examKind,
    textbook: textbook.trim() || undefined,
    session: `${semester}학기 ${kindLabel[examKind]}`,
    title: `${year}년 ${semester}학기 ${cleanSubject} ${kindLabel[examKind]}`,
    subjects: [cleanSubject],
    questions: [],
    kind: 'school-exam',
  };
  commit({
    ...latest.current,
    rounds: [round, ...latest.current.rounds],
    scopes: [{
      id, subject: cleanSubject, year: year, semester: semester,
      examKind: examKind, textbook: textbook.trim() || undefined,
      pages: pages.trim() || undefined, note: note.trim() || undefined,
    }, ...latest.current.scopes],
  });
  setSelectedRoundId(id);
  setNote('');
}

function addQuestion(): void {
  const round = selectedRound;
  const cleanChoices = choices.map((choice) => choice.trim());
  if (!round || !questionText.trim() || cleanChoices.some((choice) => !choice)) return;
  const updated: Round = {
    ...round,
    subjects: round.subjects.length ? round.subjects : [subject.trim() || '학교 과목'],
    questions: [...round.questions, {
      number: round.questions.length + 1,
      text: questionText.trim(),
      choices: cleanChoices.map((text) => ({ text })),
      answer: answer,
      explanation: explanation.trim() || undefined,
      sourcePage: questionPage.trim() || undefined,
      teacherHint: teacherHint.trim() || undefined,
      source: 'school-user',
      _subject: round.subjects[0] || subject.trim() || '학교 과목',
    }],
  };
  commit({ ...latest.current, rounds: latest.current.rounds.map((item) => item.id === round.id ? updated : item) });
  setQuestionText('');
  setChoices(['', '', '', '']);
  setExplanation('');
  setQuestionPage('');
  setTeacherHint('');
  setAnswer(1);
}

function addMemoryCard(): void {
  if (!memoryPrompt.trim() || !memoryAnswer.trim()) return;
  const card: SchoolMemoryCard = {
    id: uid('school-memory'),
    subject: selectedRound?.subjects[0] || subject.trim() || '학교 과목',
    prompt: memoryPrompt.trim(),
    answer: memoryAnswer.trim(),
    sourcePage: memoryPage.trim() || undefined,
    teacherHint: memoryHint.trim() || undefined,
    important: Boolean(memoryHint.trim()),
    reviewCount: 0,
    knownCount: 0,
  };
  commit({ ...latest.current, memoryCards: [card, ...latest.current.memoryCards] });
  setMemoryPrompt('');
  setMemoryAnswer('');
  setMemoryPage('');
  setMemoryHint('');
}

async function reviewCard(card: SchoolMemoryCard, known: boolean): Promise<void> {
  const { Rating, createEmptyCard, fsrs, generatorParameters } = await import('ts-fsrs');
  const current = latest.current.memoryCards.find(item=>item.id===card.id);
  if(!current)return;
  card=current;
  const now = new Date();
  const stored: CardInput = card.fsrs ? {
    ...card.fsrs,
    due: new Date(card.fsrs.due),
    last_review: card.fsrs.last_review ? new Date(card.fsrs.last_review) : undefined,
  } : createEmptyCard(now);
  const scheduled = fsrs(generatorParameters({ maximum_interval: 365 })).next(
    stored,
    now,
    known ? Rating.Good : Rating.Again,
  ).card;
  const serializedFsrs: NonNullable<SchoolMemoryCard['fsrs']> = {
    ...scheduled,
    due: scheduled.due.toISOString(),
    last_review: scheduled.last_review?.toISOString(),
  };
  commit({
    ...latest.current,
    memoryCards: latest.current.memoryCards.map((item) => item.id === card.id ? {
      ...item,
      reviewCount: (item.reviewCount || 0) + 1,
      knownCount: (item.knownCount || 0) + (known ? 1 : 0),
      lastReviewedAt: Date.now(),
      nextReviewAt: scheduled.due.getTime(),
      fsrs: serializedFsrs,
    } : item),
  });
  setMemoryOpenId('');
}

function removeRound(round: Round): void {
  if (!confirm(`'${round.title}' 시험지를 삭제할까요?`)) return;
  commit({
    ...latest.current,
    rounds: latest.current.rounds.filter((item) => item.id !== round.id),
    scopes: latest.current.scopes.filter((scope) => scope.id !== round.id),
  });
  setSelectedRoundId(latest.current.rounds.find((item) => item.id !== round.id)?.id || '');
}

function removeMemoryCard(card: SchoolMemoryCard): void {
  if (!confirm('이 주관식 암기카드를 삭제할까요?')) return;
  commit({ ...latest.current, memoryCards: latest.current.memoryCards.filter((item) => item.id !== card.id) });
}

function exportData(): void {
  const blob = new Blob([JSON.stringify(latest.current, null, 2)], { type: 'application/json' });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = `학교시험-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(href);
}

async function importData(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const normalized = normalizeSchoolExamData(schoolImportSchema.parse(JSON.parse(await file.text())));
    commit(normalized);
    setSelectedRoundId(normalized.rounds[0]?.id || '');
  } catch {
    alert('학교 시험 JSON 파일을 읽지 못했습니다.');
  }
  (event.target as HTMLInputElement).value = '';
}

async function mergeData(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const incoming = normalizeSchoolExamData(schoolImportSchema.parse(JSON.parse(await file.text())));
    if (!incoming.rounds.length && !incoming.memoryCards.length && !incoming.scopes.length && !incoming.questionSets?.length) {
      throw new Error('empty school data');
    }
    const merged = mergeSchoolExamData(latest.current, incoming);
    commit(merged);
    setSelectedRoundId(incoming.rounds[0]?.id || selectedRoundId);
  } catch {
    alert('학교 시험 정리본을 읽지 못했습니다. JSON 파일인지 확인해 주세요.');
  }
  (event.target as HTMLInputElement).value = '';
}
  return (
    <div style={{display:"contents"}} data-react-view="school-exams">
      <section className="school-hero">
        <div>
          <span>SCHOOL EXAM LAB</span>
          <h1>학교 중간·기말고사 준비</h1>
          <p>찍은 사진은 이 채팅에 보내 주세요. 문제·정답을 대조한 정리본을 받아 앱에 추가하면 됩니다.</p>
        </div>
        <div>
          <button
            type="button"
            onClick={() => {
              mergeInput.current?.click();
            }}
            className="school-import"
          >
            사진 정리본 추가
          </button>
          <button
            type="button"
            onClick={() => {
              setSourcePrepOpen(!sourcePrepOpen);
            }}
          >
            사진·PDF 자르기
          </button>
          <button type="button" onClick={exportData}>
            백업 저장
          </button>
          <button
            type="button"
            onClick={() => {
              importInput.current?.click();
            }}
          >
            백업 복원
          </button>
          <input
            ref={mergeInput}
            type="file"
            accept="application/json"
            hidden={true}
            onChange={(event) => mergeData(event.nativeEvent)}
          />
          <input
            ref={importInput}
            type="file"
            accept="application/json"
            hidden={true}
            onChange={(event) => importData(event.nativeEvent)}
          />
        </div>
      </section>
      {sourcePrepOpen ? (
        <OptionalTool title="사진·PDF 자르기"><SchoolSourcePrep onClose={() => {setSourcePrepOpen(false);}}/></OptionalTool>
      ) : null}
      <section aria-label="사진 문제 등록 순서" className="school-photo-workflow">
        <strong>사진으로 준비하는 순서</strong>
        <ol>
          <li>객관식·주관식 사진과 시험 범위를 이 채팅에 보냅니다.</li>
          <li>제가 글자·보기·정답·쪽수를 대조해 정리합니다.</li>
          <li>
            {'받은 JSON을 '}
            <b>사진 정리본 추가</b>로 넣으면 기존 자료와 합쳐집니다.
          </li>
        </ol>
        <p>사진 속 도표나 그림이 필요한 문제는 원본 사진 위치도 함께 연결할 수 있습니다.</p>
      </section>
      <details className="school-photo-prompt">
        <summary>
          <span>
            <b>학교 사진 → CBT JSON 요청문</b>
            <small>일반 ChatGPT에서도 정확한 가져오기 파일을 만들도록 형식을 지정합니다.</small>
          </span>
          <strong>열기</strong>
        </summary>
        <div>
          <textarea
            value={schoolPhotoJsonPrompt}
            rows={18}
            readOnly={true}
            aria-label="학교 시험 사진 JSON 정리 요청문"
            onFocus={(event) => {
              (event.target as HTMLTextAreaElement).select();
            }}
          />
          <button
            type="button"
            onClick={() => {
              copyPrompt(schoolPhotoJsonPrompt, 'photo');
            }}
          >
            {copiedPrompt === 'photo' ? '✓ 복사했습니다' : 'JSON 요청문 전체 복사'}
          </button>
          <p aria-live="polite">
            사진을 첨부한 뒤 과목·시험·교재·범위만 바꾸세요. 불확실한 정답은 가져오기 파일에서 자동으로
            분리하도록 요청합니다.
          </p>
        </div>
      </details>
      <details className="school-photo-prompt school-code-prompt">
        <summary>
          <span>
            <b>Codex 한도 부족 시 수정안 요청문</b>
            <small>일반 ChatGPT에서 안전한 코드 패치를 받은 뒤 Codex에 전달할 때 사용합니다.</small>
          </span>
          <strong>열기</strong>
        </summary>
        <div>
          <textarea
            value={generalChatPatchPrompt}
            rows={14}
            readOnly={true}
            aria-label="일반 ChatGPT 코드 수정안 요청문"
            onFocus={(event) => {
              (event.target as HTMLTextAreaElement).select();
            }}
          />
          <button
            type="button"
            onClick={() => {
              copyPrompt(generalChatPatchPrompt, 'patch');
            }}
          >
            {copiedPrompt === 'patch' ? '✓ 복사했습니다' : '수정안 요청문 전체 복사'}
          </button>
          <p aria-live="polite">
            일반 ChatGPT가 실제 파일을 고쳤다고 가정하지 않고, 적용 가능한 diff와 검증 명령을 만들게 합니다.
          </p>
        </div>
      </details>
      <div className="school-layout">
        <section className="school-panel">
          <header>
            <span>01</span>
            <div>
              <h2>
                {'시험 범위 직접 만들기 '}
                <small>선택</small>
              </h2>
              <p>사진 정리본을 쓰지 않을 때 직접 입력할 수 있습니다.</p>
            </div>
          </header>
          <div className="school-form scope-form">
            <label>
              <span>과목</span>
              <input
                value={subject}
                onChange={(event) => {
                  setSubject(event.currentTarget.value);
                }}
                placeholder="예: 냉동공학"
              />
            </label>
            <label>
              <span>연도</span>
              <input
                value={year}
                onChange={(event) => {
                  setYear(Number(event.currentTarget.value));
                }}
                type="number"
                min="2000"
                max="2100"
              />
            </label>
            <label>
              <span>학기</span>
              <select
                value={semester}
                onChange={(event) => {
                  setSemester(event.currentTarget.value === '2' ? 2 : 1);
                }}
              >
                <option value={1}>1학기</option>
                <option value={2}>2학기</option>
              </select>
            </label>
            <label>
              <span>시험</span>
              <select
                value={examKind}
                onChange={(event) => {
                  setExamKind(event.currentTarget.value as typeof examKind);
                }}
              >
                <option value="midterm">중간고사</option>
                <option value="final">기말고사</option>
                <option value="quiz">쪽지시험</option>
                <option value="other">기타</option>
              </select>
            </label>
            <label>
              <span>교재</span>
              <input
                value={textbook}
                onChange={(event) => {
                  setTextbook(event.currentTarget.value);
                }}
                placeholder="교재 이름"
              />
            </label>
            <label>
              <span>페이지</span>
              <input
                value={pages}
                onChange={(event) => {
                  setPages(event.currentTarget.value);
                }}
                placeholder="예: 32~58쪽"
              />
            </label>
            <label className="wide">
              <span>선생님 강조·예상 범위</span>
              <textarea
                value={note}
                onChange={(event) => {
                  setNote(event.currentTarget.value);
                }}
                rows={3}
                placeholder="예: 42쪽 표 암기, 3장 계산문제 출제"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={!subject.trim()}
            onClick={addScopeAndRound}
            className="school-primary"
          >
            시험지 만들기
          </button>
        </section>
        <section className="school-panel">
          <header>
            <span>02</span>
            <div>
              <h2>
                {'객관식 기출 직접 입력 '}
                <small>선택</small>
              </h2>
              <p>저장한 문제는 기존 학습모드와 CBT모드로 풉니다.</p>
            </div>
          </header>
          <label className="school-select">
            <span>입력할 시험지</span>
            <select
              value={selectedRoundId}
              onChange={(event) => {
                setSelectedRoundId(event.currentTarget.value);
              }}
            >
              <option value="">시험지를 먼저 만드세요</option>
              {data.rounds.map((round) => (
                <option key={round.id} value={round.id}>
                  {round.title}
                  {' · '}
                  {round.questions.length}
                  문제
                </option>
              ))}
            </select>
          </label>
          <div className="school-form question-form">
            <label className="wide">
              <span>문제</span>
              <textarea
                value={questionText}
                onChange={(event) => {
                  setQuestionText(event.currentTarget.value);
                }}
                rows={3}
                placeholder="객관식 문제를 입력하세요"
              />
            </label>
            {choices.map((_, index) => (
              <label key={index}>
                <span>
                  {'보기 '}
                  {index + 1}
                </span>
                <input
                  value={choices[index]}
                  onChange={(event) => {
                    const value=event.currentTarget.value;
                    setChoices(previous=>previous.map((choice,i)=>i===index?value:choice));
                  }}
                  placeholder={`${index + 1}번 보기`}
                />
              </label>
            ))}
            <label>
              <span>정답</span>
              <select
                value={answer}
                onChange={(event) => {
                  setAnswer(Number(event.currentTarget.value));
                }}
              >
                {[1, 2, 3, 4].map((number) => (
                  <option key={number} value={number}>
                    {number}번
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>교재 쪽</span>
              <input
                value={questionPage}
                onChange={(event) => {
                  setQuestionPage(event.currentTarget.value);
                }}
                placeholder="예: 43쪽"
              />
            </label>
            <label className="wide">
              <span>해설</span>
              <textarea
                value={explanation}
                onChange={(event) => {
                  setExplanation(event.currentTarget.value);
                }}
                rows={2}
                placeholder="없어도 저장할 수 있습니다"
              />
            </label>
            <label className="wide">
              <span>선생님 강조사항</span>
              <input
                value={teacherHint}
                onChange={(event) => {
                  setTeacherHint(event.currentTarget.value);
                }}
                placeholder="예: 서술형으로도 출제"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={!selectedRound || !questionText.trim() || choices.some((choice) => !choice.trim())}
            onClick={addQuestion}
            className="school-primary"
          >
            객관식 문제 추가
          </button>
        </section>
      </div>
      <section className="school-panel school-rounds">
        <header>
          <span>03</span>
          <div>
            <h2>내 시험지</h2>
            <p>문제 번호는 입력 순서대로 1, 2, 3…으로 표시됩니다.</p>
          </div>
        </header>
        {data.rounds.length ? (
          <div className="school-round-grid">
            {data.rounds.map((round) => (
              <article key={round.id}>
                <span>{round.subjects.join(' · ')}</span>
                <h3>{round.title}</h3>
                <p>
                  {round.textbook || '교재 미지정'}
                  {' · '}
                  {round.questions.length}
                  문제
                </p>
                {scopeFor(round)?.pages ? (
                  <p className="school-scope-note">
                    {'범위 '}
                    {scopeFor(round)?.pages}
                  </p>
                ) : null}
                {scopeFor(round)?.note ? (
                  <p className="school-scope-note">
                    {'강조 '}
                    {scopeFor(round)?.note}
                  </p>
                ) : null}
                <div>
                  <button
                    type="button"
                    disabled={!round.questions.length}
                    onClick={() => {
                      onStart({ round, mode: 'learn' });
                    }}
                  >
                    학습모드
                  </button>
                  <button
                    type="button"
                    disabled={!round.questions.length}
                    onClick={() => {
                      onStart({ round, mode: 'exam' });
                    }}
                  >
                    CBT모드
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      removeRound(round);
                    }}
                    className="danger"
                  >
                    삭제
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : !data.questionSets?.length ? (
          <p className="school-empty">아직 만든 시험지가 없습니다.</p>
        ) : null}
        {data.questionSets?.length ? (
          <div className="school-round-grid">
            {data.questionSets.map((set) => (
              <article key={set.id}>
                <span>{set.subject}</span>
                <h3>{set.title}</h3>
                <p>
                  {'통합 검색에서 담은 '}
                  {set.itemIds.length}
                  문제 · 원래 그림과 해설 유지
                </p>
                <div>
                  <button
                    type="button"
                    disabled={!set.itemIds.length}
                    onClick={() => {
                      onStartSet({ id: set.id, mode: 'learn' });
                    }}
                  >
                    학습모드
                  </button>
                  <button
                    type="button"
                    disabled={!set.itemIds.length}
                    onClick={() => {
                      onStartSet({ id: set.id, mode: 'exam' });
                    }}
                  >
                    CBT모드
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSearch(set.id);
                    }}
                  >
                    문제 더 담기
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      removeQuestionSet(set.id);
                    }}
                    className="danger"
                  >
                    삭제
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
      <section className="school-panel school-memory">
        <header>
          <span>04</span>
          <div>
            <h2>주관식 암기카드</h2>
            <p>질문을 보고 답을 떠올린 뒤 펼쳐서 확인합니다.</p>
          </div>
        </header>
        <div className="school-form memory-form">
          <label className="wide">
            <span>질문</span>
            <textarea
              value={memoryPrompt}
              onChange={(event) => {
                setMemoryPrompt(event.currentTarget.value);
              }}
              rows={2}
              placeholder="예: 증발기의 역할을 쓰시오."
            />
          </label>
          <label className="wide">
            <span>정답</span>
            <textarea
              value={memoryAnswer}
              onChange={(event) => {
                setMemoryAnswer(event.currentTarget.value);
              }}
              rows={2}
              placeholder="외워야 할 답을 입력하세요."
            />
          </label>
          <label>
            <span>교재 쪽</span>
            <input
              value={memoryPage}
              onChange={(event) => {
                setMemoryPage(event.currentTarget.value);
              }}
              placeholder="예: 51쪽"
            />
          </label>
          <label>
            <span>강조사항</span>
            <input
              value={memoryHint}
              onChange={(event) => {
                setMemoryHint(event.currentTarget.value);
              }}
              placeholder="예: 정의 그대로 암기"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={!memoryPrompt.trim() || !memoryAnswer.trim()}
          onClick={addMemoryCard}
          className="school-primary"
        >
          암기카드 추가
        </button>
        <div className="memory-card-grid">
          {sortedMemoryCards.map((card) => (
            <article key={card.id} className={card.important ? 'important' : ''}>
              <span>
                {card.subject}
                {card.sourcePage ? <small>{card.sourcePage}</small> : null}
              </span>
              <h3>{card.prompt}</h3>
              {memoryOpenId !== card.id ? (
                <button
                  type="button"
                  onClick={() => {
                    setMemoryOpenId(card.id);
                  }}
                >
                  정답 펼치기
                </button>
              ) : (
                <div className="memory-answer">
                  <strong>{card.answer}</strong>
                  {card.teacherHint ? (
                    <small>
                      {'선생님 강조: '}
                      {card.teacherHint}
                    </small>
                  ) : null}
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        reviewCard(card, true);
                      }}
                    >
                      외웠어요
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        reviewCard(card, false);
                      }}
                    >
                      다시 보기
                    </button>
                  </div>
                </div>
              )}
              <footer>
                {'확인 '}
                {card.reviewCount || 0}
                {'회 · 외움 '}
                {card.knownCount || 0}회
                {card.nextReviewAt ? (
                  <span>
                    {' · 다음 '}
                    {new Date(card.nextReviewAt).toLocaleDateString('ko-KR')}
                  </span>
                ) : null}{' '}
                <button
                  type="button"
                  onClick={() => {
                    removeMemoryCard(card);
                  }}
                >
                  삭제
                </button>
              </footer>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
