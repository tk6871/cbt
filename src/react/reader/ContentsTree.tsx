import '../../cbt/textbookContents.css';
import { useEffect, useMemo, useState } from 'react';
import type { QuestionItem } from '../../cbt/types';
import { textbookEntries, textbookStudyId, type TextbookKey } from '../../cbt/textbookPages';
import {
  bookContents,
  contentsRows,
  addContentsQuestionText,
  searchContents,
  examQuery,
  contentsExamples,
  type ContentsRow,
  type BookContentsNode,
} from '../../cbt/textbookContents';

interface Props {
  book: TextbookKey;
  items: QuestionItem[];
  selected: string;
  onSelect: (row: ContentsRow) => void;
}
interface Count {
  ready: number;
  pending: number;
  direct: number;
  examples: number;
}
interface BranchProps {
  node: BookContentsNode;
  counts: Record<string, Count>;
  selected: string;
  select: (id: string) => void;
}

function Branch({ node, counts, selected, select }: BranchProps) {
  const [hasOpened, setHasOpened] = useState(false);
  const count = counts[node.id];
  const suffix =
    (count.direct ? ' · 원문 ' + count.direct + '개' : '') +
    (count.examples ? ' · 풀이 예제 ' + count.examples + '개' : '');
  const note = node.note && <p className="contents-note">{node.note}</p>;
  if (node.children?.length)
    return (
      <details className="contents-branch" onToggle={event => { if (event.currentTarget.open) setHasOpened(true); }}>
        <summary>
          <span>{node.title}</span>
          <small>
            {count.ready}문제 연결{suffix}
          </small>
        </summary>
        {hasOpened && <div className="contents-branch-body">
          {note}
          {node.from && (
            <button type="button" aria-pressed={selected === node.id} onClick={() => select(node.id)}>
              {node.title} · 연결 문제 모아 보기
            </button>
          )}
          {node.children.map((child) => (
            <Branch key={child.id} node={child} counts={counts} selected={selected} select={select} />
          ))}
        </div>}
      </details>
    );
  const status = count.ready
    ? count.ready + '문제 연결'
    : count.direct
      ? '교재 원문으로 보기'
      : count.examples
        ? '객관식 아님'
        : '문제 연결 준비 중';
  return (
    <div className="contents-leaf">
      <button
        type="button"
        disabled={!node.from}
        aria-pressed={selected === node.id}
        onClick={() => select(node.id)}
      >
        <span>
          {node.title}{' '}
          {node.from && (
            <small>
              {node.from}
              {node.to ? '~' + node.to : '쪽부터'}
            </small>
          )}
        </span>
        <small>
          {status}
          {suffix}
          {count.pending ? ' · 대조' + count.pending + '위치' : ''}
        </small>
      </button>
      {note}
    </div>
  );
}

export function ContentsTree({ book, items, selected, onSelect }: Props) {
  const [query, setQuery] = useState(''),
    [debounced, setDebounced] = useState(''),
    [limit, setLimit] = useState(20);
  const [ocr, setOcr] = useState<Record<string, string>>(),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(false),
    [attempt, retry] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(query.trim());
      setLimit(20);
    }, 180);
    return () => clearTimeout(timer);
  }, [query]);
  const exam = examQuery(debounced);
  const needsIndex = !exam && !!debounced && book === 'energy' && !ocr;
  useEffect(() => {
    if (!needsIndex) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(false);
    import('../../../data/energy-textbook-search.json',{with:{type:'json'}})
      .then(
        (data) => {
          if (active) setOcr(data.default.texts);
        },
        () => {
          if (active) setError(true);
        },
      )
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [needsIndex, attempt]);
  const rows = useMemo(() => contentsRows(bookContents[book], textbookEntries), [book]);
  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const counts = useMemo(
    () =>
      Object.fromEntries(
        rows.map((row) => [
          row.node.id,
          {
            ready: new Set(row.entries.filter((e) => itemMap.has(textbookStudyId(e))).map((e) => e.sourceId))
              .size,
            direct: row.entries.filter((e) => e.directSourceId).length,
            pending: row.entries.filter((e) => !e.directSourceId && !e.workedExampleId && !itemMap.has(textbookStudyId(e))).length,
            examples: contentsExamples(row.node).length,
          },
        ]),
      ),
    [rows, itemMap],
  );
  const results = useMemo(() => {
    if (!debounced) return [];
    if (examQuery(debounced)) return searchContents(rows, debounced);
    const text = { ...ocr };
    for (const entry of textbookEntries) {
      const item = itemMap.get(textbookStudyId(entry));
      if (!item || !entry.sourceId) continue;
      const q = item.question;
      text[entry.sourceId] = [
        q.text,
        q.ocrText,
        ...q.choices.map((c) => c.text || c.html),
        text[entry.sourceId],
      ]
        .filter(Boolean)
        .join(' ');
    }
    return searchContents(addContentsQuestionText(rows, text), debounced);
  }, [rows, itemMap, ocr, debounced]);
  function select(id: string) {
    const row = rows.find((r) => r.node.id === id);
    if (row?.node.from) onSelect(row);
  }
  return (
    <section className="book-contents" aria-label="교재 목차" data-react-view="contents-tree">
      <header>
        <h2>목차에서 골라 풀기</h2>
        <p>
          장 → 절 → 핵심·실전예상문제 순서로 고릅니다. 채점 가능한 연결 문제와 바로 읽는 교재 원문을
          구분합니다.
        </p>
      </header>
      <label className="contents-search-label">
        목차·문제 내용 검색
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="예: 냉동 대용량 급속동결 / 몰리엘 / 집진"
          autoComplete="off"
        />
      </label>
      <p className="contents-help">
        단어 일부·띄어쓰기·순서가 달라도 찾습니다. 여러 단어는 일치 개수가 많은 순서로 보여 주며, 연관어와
        가벼운 오타도 참고합니다. 검색 보조 OCR은 오타가 있을 수 있고 원문 문제 이미지는 그대로입니다.
      </p>
      {loading && <p role="status">에너지 교재 내용 검색 자료를 불러오는 중…</p>}
      {error && (
        <p role="status">
          내용 검색 보조자료를 읽지 못해 목차·등록 문장만 검색합니다.{' '}
          <button onClick={() => retry((v) => v + 1)}>다시 불러오기</button>
        </p>
      )}
      {debounced ? (
        <>
          <p role="status" className="contents-result-count">
            관련 목차 {results.length}개{results.length > limit ? ' · ' + limit + '개 표시' : ''}
          </p>
          {results.length > 0 ? (
            <ul className="contents-results">
              {results.slice(0, limit).map((row) => (
                <li key={row.node.id}>
                  <button
                    type="button"
                    disabled={!row.node.from}
                    aria-pressed={selected === row.node.id}
                    onClick={() => select(row.node.id)}
                  >
                    <small>{row.path.join(' › ')}</small>
                    <strong>{row.node.title}</strong>
                    <span>
                      {row.node.from || '쪽번호 대조 중'}
                      {row.node.to ? '~' + row.node.to : ''} · {counts[row.node.id].ready}문제 연결
                      {counts[row.node.id].direct ? ' · 교재 원문 ' + counts[row.node.id].direct + '개' : ''}
                      {counts[row.node.id].examples
                        ? ' · 풀이 예제 ' + counts[row.node.id].examples + '개'
                        : ''}
                    </span>
                    <small>
                      맞은 검색어: {row.matched.map((m) => m.term).join(' · ')}
                      {row.matched.some((m) => m.kind === '비슷한 단어') ? ' · 비슷한 단어 참고' : ''}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            !loading && (
              exam ? <div className="contents-results">
                <p>{debounced}에 해당하는 회차는 이 교재에 없습니다.</p>
                {searchContents(rows, exam.year+'년').map(row =>
                  <button type="button" key={row.node.id} onClick={() => select(row.node.id)}>{row.node.title}</button>
                )}
              </div> : <p>일치하는 목차를 찾지 못했습니다. 단어를 줄여 보세요. 예: ‘급속동결’ 또는 ‘압축기’.</p>
            )
          )}
          {results.length > limit && (
            <button type="button" onClick={() => setLimit((v) => v + 20)}>
              검색 결과 더 보기
            </button>
          )}
        </>
      ) : (
        <div className="contents-tree">
          {bookContents[book].map((node) => (
            <Branch key={node.id} node={node} counts={counts} selected={selected} select={select} />
          ))}
        </div>
      )}
    </section>
  );
}
