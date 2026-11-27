import {useEffect, useState} from 'react';
import {ensureCatalogLoaded, loadCatalogs, questionId, subjectFor} from '../../cbt/catalog';
import {explanationSource} from '../../cbt/explanationSource';
import {assetReading, hasPrintedInline, printedQuestion, printedSolutionHtml} from '../../cbt/printedStudy';
import {textbookNames, textbookSourceKeys, type TextbookKey} from '../../cbt/textbookRoutes';
import type {Catalog, QuestionItem} from '../../cbt/types';
import {usePrintedStudy} from '../session/usePrintedStudy';
import './patch-sources.css';

type Citation = {label: string; detail?: string; url?: string};
type Entry = {version: string; title: string; sources?: Citation[]};
type SourceQuestion = {id: string; number: number; item?: QuestionItem; directAnswer?: number};
type SourceRound = {id: string; title: string; questions: SourceQuestion[]};

function publicUrl(value?: string) {
  if (!value || !/^https?:\/\//i.test(value)) return;
  try {
    const url = new URL(value);
    if (url.username || url.password || /(?:^|\/)tk6871\/cbt-ocr(?:\/|$)/i.test(url.pathname)) return;
    return url.href;
  } catch { return; }
}

function CitationList({sources}: {sources: Citation[]}) {
  return <ul className="patch-source-list">{sources.map(({label, detail, url}, i) => {
    const href = publicUrl(url);
    return <li key={label+i}><strong>{label}</strong>{detail && <p>{detail}</p>}
      {href && <a href={href} target="_blank" rel="noopener noreferrer">{new URL(href).hostname} 열기 ↗</a>}
    </li>;
  })}</ul>;
}

function bankItems(bank: Catalog): QuestionItem[] {
  return bank.rounds.flatMap(round => round.questions.map(question => ({
    id: questionId(round, question), subject: subjectFor(round, question), round, question,
  })));
}

async function bookRounds(book: TextbookKey): Promise<SourceRound[]> {
  const [pages, {fetchTextbookSources}, {textbookDirectAnswer}] = await Promise.all([
    import('../../cbt/textbookPages'), import('../../cbt/staticTextbookSources'), import('../../cbt/textbookDirectAnswer'),
  ]);
  async function localItems() {
    const {loadTextbookSupplement} = await import('../../cbt/textbookSupplement');
    const [supplement, catalogs] = await Promise.all([
      loadTextbookSupplement(book), Promise.all(textbookSourceKeys(book).map(ensureCatalogLoaded)),
    ]);
    return [...catalogs.flatMap(bankItems), ...supplement];
  }
  const items = location.protocol === 'file:' ? await localItems() : await fetchTextbookSources(book).catch(localItems);
  const entries = pages.textbookEntries.filter(e => e.book === book);
  const graded = new Map(pages.textbookStudyItems(items, entries).map(i => [i.id, i]));
  const direct = new Map(pages.textbookDirectSources.map(d => [d.id, d]));
  const rounds = new Map<string, SourceRound>();
  for (const entry of entries) {
    const item = graded.get(pages.textbookStudyId(entry));
    const scan = entry.directSourceId && direct.get(entry.directSourceId);
    if (!item && !scan) continue;
    let round = rounds.get(entry.page);
    if (!round) {
      round = {id: entry.page, title: entry.page+'쪽', questions: []};
      rounds.set(entry.page, round);
    }
    if (item) round.questions.push({id: item.id, number: entry.number, item});
    else if (scan) {
      const page = pages.textbookDirectPageMap.get(scan.page);
      round.questions.push({id: scan.id, number: entry.number, directAnswer: page && textbookDirectAnswer(scan, page)});
    }
  }
  return [...rounds.values()];
}

async function loadRounds(key: string): Promise<SourceRound[]> {
  if (key === 'book-hansol') return bookRounds('hansol');
  if (key === 'book-energy') return bookRounds('energy');
  const bank = await ensureCatalogLoaded(key);
  return bank.rounds.map(round => ({id: round.id, title: round.title,
    questions: round.questions.map(question => {
      const id = questionId(round, question);
      return {id, number: question.number, item: {id, question, round, subject: subjectFor(round, question)}};
    }),
  }));
}

// Review notes can mix bibliographic references with solutions. Keep the source tokens only.
function reviewCitations(note: string): Citation[] {
  const references = [
    /(?:COMCBT|한솔아카데미|한솔 공조|안전과장)(?:\s+[가-힣]+(?:산업기사|기사|기능사))?(?:\s+(?:이용자 해설|공개 기출|복원 PDF|교재))?/gi,
    /(?:19|20)\d{2}[./-]\s*\d{1,2}[./-]\s*\d{1,2}\.?\s*(?:원문\s*)?\d{1,3}\s*번/g,
    /(?:19|20)\d{2}년\s*(?:제\s*)?\d+(?:[·/-]\d+)?회(?:\s*통합)?(?:\s*[·,]?\s*(?:원문\s*)?\d{1,3}\s*번)?/g,
    /(?:(?:교재(?:\s*정답표)?|인쇄|PDF)\s*)?\d+(?:-\d+)?\s*(?:쪽|페이지)(?:\s*[·,]?\s*(?:원문\s*)?\d{1,3}\s*번)?/g,
    /[a-z][a-z\d]*(?:-[a-z\d·가-힣]+)+:\d{1,3}\b/gi,
    /해설작성자\s*[:：]?\s*[가-힣A-Za-z\d_]{1,20}/g,
  ];
  const refs = new Set(references.flatMap(re => note.match(re) || []));
  const rows: Citation[] = refs.size ? [{label: '해설 대조 기록', detail: [...refs].join(' · ')}] : [];
  const urls = new Set(note.match(/https?:\/\/[^\s<>"']+/gi) || []);
  for (const url of urls) if (publicUrl(url)) rows.push({label: '해설 참고 자료', url});
  for (const doc of new Set(note.match(/\bdocs\/[\w/-]+\.(?:md|json|pdf)\b/g) || [])) {
    rows.push({label: '공개 검수 기록', detail: doc, url: 'https://github.com/tk6871/cbt/blob/main/'+doc});
  }
  return rows;
}

function QuestionSources({record, bankKey, bankName, round}: {record: SourceQuestion; bankKey: string; bankName: string; round: SourceRound}) {
  const study = usePrintedStudy();
  const {item} = record;
  const q = item?.question;
  const direct = study?.books[record.id];
  const print = item ? printedQuestion(item) : direct?.choices.length === 4 && (!record.directAnswer || record.directAnswer === direct.answerKey) ? direct : undefined;
  const book = bankKey.startsWith('book-');
  const source = book ? bankName
    : q?.source && q.source !== 'local-source' && !/^https?:/i.test(q.source) ? q.source
    : q?.visualSource || bankName;
  const refs = new Set(q?.sourcePage?.match(/(?:교재\s*|PDF\s*)?\d+(?:-\d+)?\s*쪽/g) || []);
  const detail = [round.title, record.number+'번', ...(!book ? refs : [])].join(' · ');
  // Free-form review notes sometimes include the correct choice or a worked solution.
  const origin = q && explanationSource({...q, explanationBasis: undefined});
  const url = [q?.problemUrl, origin?.url, q?.source, q?.sourcePage].map(publicUrl).find(Boolean);
  const citations: Citation[] = [{label: source, detail, url}];
  const partialReading = q && ([...(q.images || []), ...(q.explanationImages || []), ...q.choices.flatMap(c => c.images || [])]
    .some(src => assetReading(src)?.html) || hasPrintedInline(q.html) || q.choices.some(c => hasPrintedInline(c.html)));
  if (print) {
    citations.push({label: print.sourceLabel || (print.partial ? '원문 부분 판독' : '원문 대조 전사'),
      detail: printedSolutionHtml(print) ? '인쇄된 문제와 해설의 판독 기록이 있습니다.' : '인쇄된 문제의 지문과 보기 판독 기록이 있습니다.'});
  } else if (partialReading) citations.push({label: '이미지 전사', detail: '문항에 연결된 이미지의 판독 기록이 있습니다.'});
  if (origin && (origin.label !== '해설 미등록' || !printedSolutionHtml(print))) {
    citations.push({label: origin.label, detail: origin.detail || '문제은행에 기록된 자료 대조 해설입니다.'});
  }
  if (q?.explanationBasis) citations.push(...reviewCitations(q.explanationBasis));
  for (const additional of q?.additionalExplanations || []) {
    const url = publicUrl(additional.source);
    citations.push({label: additional.label, detail: url ? undefined : additional.source, url});
  }
  if (print?.learningSolution) {
    const {label, source: detail, url} = print.learningSolution;
    citations.push({label, detail, url});
  }
  return <CitationList sources={citations}/>;
}

export default function PatchSources({entries, version, selectVersion}: {entries: Entry[]; version: string; selectVersion: (v: string) => void}) {
  const releases = entries.filter(e => e.sources?.length);
  const release = releases.find(e => e.version === version) || releases[0];
  const [catalogs] = useState(() => {
    const options = loadCatalogs().filter(b => !b.isVirtual).map(({key,name}) => ({key,name}));
    if (window.CBT_APP_SPACE !== 'jewelry') options.push({key:'book-hansol', name:textbookNames.hansol}, {key:'book-energy', name:textbookNames.energy});
    return options;
  });
  const [bank, setBank] = useState('');
  const [roundId, setRound] = useState('');
  const [questionId, setQuestion] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{key: string; rounds?: SourceRound[]; error?: boolean}>();
  useEffect(() => {
    if (!bank) return;
    let current = true;
    loadRounds(bank).then(rounds => { if (current) setLoaded({key: bank, rounds}); })
      .catch(() => { if (current) setLoaded({key: bank, error: true}); });
    return () => { current = false; };
  }, [bank, attempt]);
  const ready = loaded?.key === bank ? loaded : undefined;
  const round = ready?.rounds?.find(r => r.id === roundId);
  const record = round?.questions.find(q => q.id === questionId);
  const repeated = new Set<number>();
  const numbers = new Set<number>();
  for (const q of round?.questions || []) {
    if (numbers.has(q.number)) repeated.add(q.number);
    numbers.add(q.number);
  }
  const bankName = catalogs.find(c => c.key === bank)?.name || '';
  const roundLabel = bank.startsWith('book-') ? '교재 쪽' : '회차';

  return <section className="patch-sources" aria-label="출처">
    {release && <section><h2>버전별 자료 출처</h2>
      {releases.length > 1 ? <label><span id="patch-source-version">버전</span><select aria-labelledby="patch-source-version" value={release.version} onChange={e => selectVersion(e.target.value)}>
        {releases.map(r => <option key={r.version} value={r.version}>v{r.version} · {r.title}</option>)}
      </select></label> : <p>v{release.version} · {release.title}</p>}
      <CitationList sources={release.sources!}/>
    </section>}
    <section><h2>문항별 출처</h2><div className="patch-source-selects">
      <label><span id="patch-source-bank">종목</span><select aria-labelledby="patch-source-bank" value={bank} onChange={e => {setBank(e.target.value); setRound(''); setQuestion('');}}>
        <option value="">종목 선택</option>{catalogs.map(c => <option key={c.key} value={c.key}>{c.name}</option>)}
      </select></label>
      <label><span id="patch-source-round">{roundLabel}</span><select aria-labelledby="patch-source-round" disabled={!ready?.rounds?.length} value={roundId} onChange={e => {setRound(e.target.value); setQuestion('');}}>
        <option value="">{roundLabel} 선택</option>{ready?.rounds?.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
      </select></label>
      <label><span id="patch-source-number">문제 번호</span><select aria-labelledby="patch-source-number" disabled={!round} value={questionId} onChange={e => setQuestion(e.target.value)}>
        <option value="">번호 선택</option>{round?.questions.map(q => <option key={q.id} value={q.id}>{q.number}번{repeated.has(q.number) && ' · '+(q.item?.question.sourceQualification || q.id)}</option>)}
      </select></label>
    </div>
    {bank && !ready && <p role="status">문항 목록을 불러오는 중…</p>}
    {ready?.error && <p role="status">문항 목록을 불러오지 못했습니다. <button type="button" onClick={() => {setLoaded(undefined); setAttempt(n => n+1);}}>다시 시도</button></p>}
    {record && round && <QuestionSources record={record} bankKey={bank} bankName={bankName} round={round}/>}
    </section>
  </section>;
}
