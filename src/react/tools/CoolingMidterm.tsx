import { useEffect, useMemo, useState } from 'react';
import type { QuestionItem, StudyMode } from '../../cbt/types';
import type { ExamRecord } from '../../cbt/storage';
import {
  uniqueSchoolItems,
  coolingTopics,
  coolingTopicGroups,
  coolingBookChapters,
  coolingSectionGroups,
} from '../../cbt/schoolQuestionBank';
import { coolingCalculation } from '../../cbt/coolingPractice';
import { coolingSafetyKind } from '../../cbt/coolingScope';
import {
  coolingBookConfirmed,
  coolingBookReview,
} from '../../cbt/coolingBookScope';
import { orderCoolingSimilar } from '../../cbt/coolingSimilarOrder';

import './cooling-midterm.css';
type SavedSet = {
  id?: string;
  title: string;
  mode?: StudyMode;
  savedAt: number;
  itemIds: string[];
  answers: Record<string, number>;
};
export interface CoolingMidtermFields {
  items: QuestionItem[];
  safetyItems: QuestionItem[];
  wrongIds: string[];
  attemptedIds: string[];
  unusedIds: string[];
  sessions: SavedSet[];
  history: ExamRecord[];
  loading: boolean;
  error: string;
}
export type CoolingSelection = {
  items: QuestionItem[];
  mode: StudyMode;
  randomCount: number;
  calculationCount?: number;
  groupRandom?: boolean;
  label?: string;
};
interface CoolingMidtermProps extends CoolingMidtermFields {
  onStart: (payload: CoolingSelection) => void;
  onSearch: () => void;
  onRetry: () => void;
  onResetDraws: () => void;
  onResume: (id: string) => void;
  onReplay: (id: string) => void;
}
const preferenceKey = 'school-cooling-selection-v1';
function initialPreferences() {
  let savedPreferences: Record<string, unknown> = {};
  try {
    savedPreferences =
      JSON.parse(localStorage.getItem(preferenceKey) || '{}') || {};
  } catch {
    /* defaults */
  }
  return {
    source: ['all', 'hvac', 'hvac-hansol'].includes(
      String(savedPreferences.source),
    )
      ? String(savedPreferences.source)
      : 'all',
    topic:
      savedPreferences.layoutVersion === 3 &&
      [...coolingTopics, '분류 미확인'].includes(
        savedPreferences.topic as string,
      )
        ? String(savedPreferences.topic)
        : 'all',
    tab:
      savedPreferences.layoutVersion === 3 &&
      ['all', 'topics', 'sections', 'wrong', 'history'].includes(
        String(savedPreferences.tab),
      )
        ? String(savedPreferences.tab)
        : 'topics',
    section:
      typeof savedPreferences.section === 'string'
        ? savedPreferences.section
        : 'all',
    count: [10, 20, 40, 60].includes(Number(savedPreferences.count))
      ? Number(savedPreferences.count)
      : 20,
    excludeSeen: savedPreferences.excludeSeen !== false,
    includeFiveCalculations: savedPreferences.includeFiveCalculations === true,
    bookOnly:
      savedPreferences.bookScopeVersion === 1
        ? savedPreferences.bookOnly !== false
        : true,
    questionOrder:
      savedPreferences.questionOrder === 'original' ? 'original' : 'similar',
    groupRandom: savedPreferences.groupRandom === true,
  };
}
export default function CoolingMidterm(props: CoolingMidtermProps) {
  const { sessions, history, error, loading } = props;
  const [prefs, setPreferences] = useState(initialPreferences);
  const {
    source,
    topic,
    tab,
    section,
    count,
    excludeSeen,
    includeFiveCalculations,
    bookOnly,
    questionOrder,
    groupRandom,
  } = prefs;
  function update(changes: Partial<typeof prefs>) {
    setPreferences((previous) => ({ ...previous, ...changes }));
  }
  useEffect(() => {
    localStorage.setItem(
      preferenceKey,
      JSON.stringify({ layoutVersion: 3, bookScopeVersion: 1, ...prefs }),
    );
  }, [prefs]);
  const sourceItems = useMemo(
    () =>
      props.items.filter(
        (item) =>
          (source === 'all' || item.round.qualificationKey === source) &&
          (!bookOnly || coolingBookConfirmed(item)),
      ),
    [props.items, source, bookOnly],
  );
  const groups = useMemo(() => coolingTopicGroups(sourceItems), [sourceItems]);
  type TopicGroup = ReturnType<typeof coolingTopicGroups>[number];
  const selectedGroup = groups.find((group) => group.label === topic);
  const sections = useMemo(
    () => (selectedGroup ? coolingSectionGroups(selectedGroup) : []),
    [selectedGroup],
  );
  const selectedSection = sections.find((group) => group.label === section);
  const scopeGroup = selectedSection || selectedGroup;
  const displayedGroups = tab === 'sections' ? sections : groups;
  const chapterInfo = (label: string) =>
    coolingBookChapters.find((chapter) => chapter.title === label);
  const topicCount = (value: string) =>
    groups.find((group) => group.label === value)?.items.length || 0;
  const filtered = scopeGroup?.aliases || sourceItems;
  const pool = useMemo(
    () => scopeGroup?.items || uniqueSchoolItems(sourceItems),
    [scopeGroup, sourceItems],
  );
  const totalCount = groups.reduce(
    (total, group) => total + group.items.length,
    0,
  );
  const safetyPool = useMemo(
    () =>
      uniqueSchoolItems(
        props.safetyItems.filter(
          (item) => !bookOnly || coolingBookConfirmed(item),
        ),
      ),
    [props.safetyItems, bookOnly],
  );
  const safetyCounts = useMemo(
    () =>
      ['management', 'protection', 'leak'].map(
        (kind) =>
          safetyPool.filter((item) => coolingSafetyKind(item) === kind).length,
      ),
    [safetyPool],
  );
  const unused = useMemo(() => new Set(props.unusedIds), [props.unusedIds]);
  const randomPool = useMemo(
    () => (excludeSeen ? pool.filter((item) => unused.has(item.id)) : pool),
    [excludeSeen, pool, unused],
  );
  const calculationAvailable = useMemo(
    () => randomPool.filter(coolingCalculation).length,
    [randomPool],
  );
  const theoryAvailable = randomPool.length - calculationAvailable;
  const calculationShortage =
    includeFiveCalculations &&
    (calculationAvailable < 5 || theoryAvailable < count - 5);
  const wrongItems = (items: QuestionItem[]) =>
    uniqueSchoolItems(items.filter((item) => props.wrongIds.includes(item.id)));
  const wrongPool = wrongItems(filtered);
  const wrongGroups = (
    selectedSection
      ? [selectedSection]
      : groups.filter((group) => topic === 'all' || group.label === topic)
  ).filter((group) => wrongItems(group.aliases).length);
  const sourceCount = (key: string) =>
    props.items.filter(
      (item) =>
        item.round.qualificationKey === key &&
        (!bookOnly || coolingBookConfirmed(item)),
    ).length;
  const answered = (group: TopicGroup) =>
    uniqueSchoolItems(
      group.aliases.filter((item) => props.attemptedIds.includes(item.id)),
    ).length;
  const wrongCount = (group: TopicGroup) => wrongItems(group.aliases).length;
  const sourceLabel =
    source === 'all'
      ? '구 기출 + 한솔'
      : source === 'hvac'
        ? '2006년3회~2016년 공조'
        : '한솔 공조';
  const scopeLabel = `${bookOnly ? '교재 본문 확인 · ' : ''}${topic === 'all' ? '냉동냉장설비 전체' : topic}${selectedSection ? ` · ${selectedSection.label}` : ''} · ${sourceLabel}`;
  function openChapter(group: TopicGroup): void {
    update({ topic: group.label, section: 'all', tab: 'sections' });
  }
  function startGroup(group: TopicGroup, mode: StudyMode, wrong = false): void {
    startOrdered(
      wrong ? wrongItems(group.aliases) : group.items,
      mode,
      `${tab === 'sections' ? `${topic} · ` : ''}${group.label} · ${sourceLabel}${wrong ? ' 오답' : ''}`,
    );
  }
  function startOrdered(
    items: QuestionItem[],
    mode: StudyMode,
    label: string,
  ): void {
    props.onStart({
      items:
        questionOrder === 'similar'
          ? orderCoolingSimilar(items)
          : items.slice(),
      mode,
      randomCount: 0,
      label: `${label} · ${questionOrder === 'similar' ? '비슷한 문제순' : '기존 순서'}`,
    });
  }
  function startRandom(mode: StudyMode): void {
    if (calculationShortage || !randomPool.length) return;
    props.onStart({
      items: randomPool,
      mode,
      randomCount: count,
      calculationCount: includeFiveCalculations ? 5 : undefined,
      groupRandom: groupRandom,
      label: `${scopeLabel}${includeFiveCalculations ? ' · 계산5개 포함' : ''}${groupRandom ? ' · 비슷한 문제순' : ''}`,
    });
  }
  function resumeForGroup(group: TopicGroup): SavedSet | undefined {
    const ids = new Set(group.aliases.map((item) => item.id));
    return props.sessions.find(
      (saved) =>
        saved.itemIds.length && saved.itemIds.every((id) => ids.has(id)),
    );
  }
  function latestResult(group: TopicGroup): ExamRecord | undefined {
    const ids = new Set(group.aliases.map((item) => item.id));
    return props.history.find(
      (record) =>
        record.mode === 'exam' &&
        record.itemIds?.length &&
        record.itemIds.every((id) => ids.has(id)),
    );
  }
  return (
    <>
      <section aria-label={'냉동공학 중간고사'} className={'cooling-midterm'}>
        <header className={'rounds-heading midterm-heading'}>
          <div>
            <h1>{'냉동공학 중간고사'}</h1>
            <p>
              {'교재 목차별 학습 · '}
              {totalCount.toLocaleString()}
              {'문제 · 일반 기출과 기록 분리'}
            </p>
          </div>
          <button
            type={'button'}
            aria-label={'통합 검색으로 문제 찾기'}
            onClick={() => {
              props.onSearch();
            }}
          >
            <span className={'wide-label'}>{'통합 검색으로 문제 찾기'}</span>
            <span className={'compact-label'}>{'문제 찾기'}</span>
          </button>
        </header>
        <nav aria-label={'중간고사 문제 선택 방식'} className={'midterm-tabs'}>
          {[
            ['topics', '교재 목차', '교재 목차'],
            ['all', '전체·랜덤', '전체·랜덤'],
            ['wrong', '중간고사 오답', '오답'],
            ['history', '풀이 기록', '풀이 기록'],
          ].map(([key, label, shortLabel]) => (
            <button
              key={key}
              aria-label={label}
              aria-pressed={
                tab === key || (key === 'topics' && tab === 'sections')
              }
              onClick={() => {
                update({ tab: key });
              }}
              className={
                tab === key || (key === 'topics' && tab === 'sections')
                  ? 'active'
                  : ''
              }
            >
              <span className={'wide-label'}>{label}</span>
              <span className={'compact-label'}>{shortLabel}</span>
            </button>
          ))}
        </nav>
        {tab !== 'history' ? (
          <div className={'midterm-controls'}>
            <label>
              {'문제 출처'}
              <select
                value={source}
                onChange={(event) => {
                  update({ source: event.currentTarget.value });
                }}
              >
                <option value={'all'}>{'구 기출 + 한솔 전체'}</option>
                <option value={'hvac'}>
                  {'2006년3회~2016년 공조 · '}
                  {sourceCount('hvac')}
                  {'문제'}
                </option>
                <option value={'hvac-hansol'}>
                  {'한솔 공조 · '}
                  {sourceCount('hvac-hansol')}
                  {'문제'}
                </option>
              </select>
            </label>
            <label>
              {'문제 배치'}
              <select
                value={questionOrder}
                onChange={(event) => {
                  update({ questionOrder: event.currentTarget.value });
                }}
              >
                <option value={'similar'}>{'비슷한 문제끼리 · 기본'}</option>
                <option value={'original'}>{'기존 순서'}</option>
              </select>
            </label>
            {tab === 'all' || tab === 'wrong' ? (
              <label>
                {'교재 장'}
                <select
                  value={topic}
                  onChange={(event) => {
                    update({
                      topic: event.currentTarget.value,
                      section: 'all',
                    });
                  }}
                >
                  <option value={'all'}>{'냉동냉장설비 전체'}</option>
                  {[...coolingTopics, '분류 미확인'].map((value) => (
                    <option key={value} value={value}>
                      {value}
                      {' · '}
                      {topicCount(value)}
                      {'문제'}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {(tab === 'all' || tab === 'wrong') && sections.length ? (
              <label>
                {'세부 목차'}
                <select
                  value={section}
                  onChange={(event) => {
                    update({ section: event.currentTarget.value });
                  }}
                >
                  <option value={'all'}>{'이 장 전체'}</option>
                  {sections.map((group) => (
                    <option key={group.label} value={group.label}>
                      {group.label}
                      {' · '}
                      {group.items.length}
                      {'문제'}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {source !== 'all' ||
            ((tab === 'all' || tab === 'wrong') && topic !== 'all') ? (
              <button
                onClick={() => {
                  update({ source: 'all' });
                  update({ topic: 'all' });
                  update({ section: 'all' });
                  if (tab === 'sections') update({ tab: 'topics' });
                }}
                className={'filter-reset'}
              >
                {'전체 범위 보기'}
              </button>
            ) : null}
          </div>
        ) : null}
        {tab !== 'history' ? (
          <div className={'topic-warning'}>
            <p>
              {
                '목차·전체·오답의 새 풀이는 선택한 문제 배치를 따릅니다. 랜덤은 아래 별도 옵션으로 배치만 바꿀 수 있습니다. 이어풀기·같은 문제 다시 풀기는 저장된 순서를 유지합니다.'
              }
            </p>
            <label className={'check'}>
              <input
                checked={bookOnly}
                onChange={(event) => {
                  update({
                    bookOnly: event.currentTarget.checked,
                    topic: 'all',
                    section: 'all',
                    tab: tab === 'sections' ? 'topics' : tab,
                  });
                }}
                type={'checkbox'}
              />
              {'교재 본문에서 연결 확인된 문제만 풀기'}
            </label>
            <p>
              {bookOnly
                ? '켜짐: 본문 문제와 지문·보기·등록 정답을 대조한 원문만 선택합니다.'
                : '꺼짐: 기존 중간고사 전체 목록입니다.'}
              {' 기존 오답·진행 중 풀이·기록은 그대로 보관합니다.'}
            </p>
            <p>
              {'대조 '}
              {coolingBookReview.locations}
              {'위치 중 연결 확인 '}
              {coolingBookReview.confirmed}
              {'위치 · 추가 확인 '}
              {coolingBookReview.pending}
              {'위치. 교재 전체 수록 완료를 뜻하지 않습니다.'}
            </p>
          </div>
        ) : null}
        {tab !== 'history' ? (
          <p className={'topic-warning'}>
            {
              '같은 질문·조건·정답 내용은 최신 회차로 묶고 ‘나왔던 회차’를 표시합니다. 수치·단위·질문 대상·정답이 다르거나 그림 동일성이 불확실한 문제는 유지합니다.'
            }
          </p>
        ) : null}
        {error ? (
          <p role={'alert'}>
            {error}{' '}
            <button
              type={'button'}
              onClick={() => {
                props.onRetry();
              }}
            >
              {'다시 불러오기'}
            </button>
          </p>
        ) : loading ? (
          <p role={'status'}>{'공조·한솔 문제를 불러오는 중입니다…'}</p>
        ) : null}
        {tab === 'topics' || tab === 'sections' ? (
          <>
            {tab === 'sections' ? (
              <div className={'chapter-heading'}>
                <button
                  onClick={() => {
                    update({ tab: 'topics' });
                  }}
                >
                  {'← 전체 목차'}
                </button>
                <h2>{topic}</h2>
                <button
                  onClick={() => {
                    update({ section: 'all' });
                    update({ tab: 'all' });
                  }}
                >
                  {'이 장 전체·랜덤 풀기'}
                </button>
              </div>
            ) : null}
            <div className={'round-grid midterm-rounds'}>
              {displayedGroups
                .filter((group) => group.items.length)
                .map((group) => (
                  <article
                    key={group.label}
                    data-topic={group.label}
                    data-section={tab === 'sections' ? group.label : undefined}
                    className={'round-card'}
                  >
                    <header>
                      <b>{sourceLabel}</b>
                    </header>
                    {latestResult(group) ? (
                      <div className={'round-record-badge'}>
                        <span>{'최근 중간고사 CBT'}</span>
                        <strong>
                          {latestResult(group)!.score}
                          {'점'}
                        </strong>
                        <small>
                          {new Date(
                            latestResult(group)!.finishedAt,
                          ).toLocaleDateString('ko-KR')}
                        </small>
                      </div>
                    ) : null}
                    <h2>{group.label}</h2>
                    <p>
                      {group.items.length.toLocaleString()}
                      {'문제 · 중복 문항 제외'}
                    </p>
                    {tab === 'topics' && chapterInfo(group.label) ? (
                      <p className={'chapter-summary'}>
                        {chapterInfo(group.label)!.summary}
                      </p>
                    ) : null}
                    {tab === 'topics' && chapterInfo(group.label) ? (
                      <button
                        aria-label={`세부 목차 보기 · ${group.label}`}
                        onClick={() => {
                          openChapter(group);
                        }}
                        className={'chapter-open'}
                      >
                        {'세부 목차 '}
                        {chapterInfo(group.label)!.sections.length}
                        {'개 보기 →'}
                      </button>
                    ) : null}
                    <div className={'round-progress'}>
                      <span>
                        <i
                          style={{
                            width: `${group.items.length ? Math.round((answered(group) / group.items.length) * 100) : 0}%`,
                          }}
                        />
                      </span>
                    </div>
                    <small className={'round-progress-copy'}>
                      {'풀이 '}
                      {answered(group)}
                      {'/'}
                      {group.items.length}
                      {' · 오답 '}
                      {wrongCount(group)}
                    </small>
                    <footer>
                      {resumeForGroup(group) ? (
                        <button
                          onClick={() => {
                            props.onResume(resumeForGroup(group)!.id!);
                          }}
                        >
                          {'이어서 풀기'}
                        </button>
                      ) : null}
                      <button
                        disabled={loading || !group.items.length}
                        className="round-mode-button"
                        aria-label={`학습모드 · ${group.label}`}
                        onClick={() => {
                          startGroup(group, 'learn');
                        }}
                      >
                        {'학습모드'}
                      </button>
                      {wrongCount(group) ? (
                        <button
                          onClick={() => {
                            startGroup(group, 'learn', true);
                          }}
                          className={'round-wrong-button'}
                        >
                          {'오답 '}
                          {wrongCount(group)}
                          {'개'}
                        </button>
                      ) : null}
                      <button
                        disabled={loading || !group.items.length}
                        className="round-mode-button"
                        aria-label={`CBT 시험모드 · ${group.label}`}
                        onClick={() => {
                          startGroup(group, 'exam');
                        }}
                      >
                        {'CBT 시험모드'}
                      </button>
                    </footer>
                  </article>
                ))}
            </div>
          </>
        ) : tab === 'all' ? (
          <section className={'selection-panel'}>
            <h2>{'선택 범위를 한 번에 풀기'}</h2>
            <p className={'muted'}>
              {scopeLabel}
              {' · '}
              {pool.length.toLocaleString()}
              {'문제'}
            </p>
            <div className={'midterm-actions'}>
              <button
                disabled={loading || !pool.length}
                onClick={() => {
                  startOrdered(pool, 'learn', scopeLabel);
                }}
              >
                {'전체 문제 학습'}
              </button>
              <button
                disabled={loading || !pool.length}
                onClick={() => {
                  startOrdered(pool, 'exam', scopeLabel);
                }}
              >
                {'전체 문제 CBT'}
              </button>
            </div>
            <hr />
            <h2>{'랜덤으로 골라 풀기'}</h2>
            <div className={'random-options'}>
              <label>
                {'랜덤 문제 수'}
                <select
                  value={count}
                  onChange={(event) => {
                    update({ count: Number(event.currentTarget.value) });
                  }}
                >
                  {[10, 20, 40, 60].map((size) => (
                    <option key={size} value={size}>
                      {size}
                      {'문제'}
                    </option>
                  ))}
                </select>
              </label>
              <label className={'check'}>
                <input
                  checked={excludeSeen}
                  onChange={(event) => {
                    update({ excludeSeen: event.currentTarget.checked });
                  }}
                  type={'checkbox'}
                />
                {'이미 나온 문제 제외'}
              </label>
              <label className={'check'}>
                <input
                  checked={includeFiveCalculations}
                  onChange={(event) => {
                    update({
                      includeFiveCalculations: event.currentTarget.checked,
                    });
                  }}
                  type={'checkbox'}
                />
                {'계산 5개 포함'}
              </label>
              <label className={'check'}>
                <input
                  checked={groupRandom}
                  onChange={(event) => {
                    update({ groupRandom: event.currentTarget.checked });
                  }}
                  type={'checkbox'}
                />
                {'뽑힌 문제를 비슷한 내용끼리 배치'}
              </label>
              <span className={'muted'}>
                {excludeSeen ? '새로 풀 수 있는' : '반복 포함'}{' '}
                {randomPool.length.toLocaleString()}
                {'문제'}
              </span>
            </div>
            <p className={'muted'}>
              {
                '문제 선택은 항상 랜덤입니다. 배치 옵션을 켜면 뽑힌 문제 안에서만 같은 목차·주제끼리 모으고, 끄면 순서도 무작위입니다.'
              }
            </p>
            {includeFiveCalculations ? (
              <p className={'muted calculation-quota'}>
                {'계산5개 + 이론'}
                {count - 5}
                {'개 · 선택 범위에 남은 계산'}
                {calculationAvailable}
                {'개 / 이론'}
                {theoryAvailable}
                {'개. 숫자·공식 암기는 계산으로 세지 않습니다.'}
              </p>
            ) : null}
            {calculationShortage ? (
              <p role={'status'} className={'topic-warning'}>
                {'계산5개 또는 이론'}
                {count - 5}
                {
                  '개가 부족합니다. 범위를 넓히거나 ‘이미 나온 문제 제외’ 또는 ‘계산 5개 포함’을 꺼 주세요.'
                }
              </p>
            ) : null}
            <div className={'midterm-actions'}>
              <button
                disabled={loading || !randomPool.length || calculationShortage}
                onClick={() => {
                  startRandom('learn');
                }}
              >
                {'랜덤 '}
                {Math.min(count, randomPool.length)}
                {'문제 학습'}
              </button>
              <button
                disabled={loading || !randomPool.length || calculationShortage}
                onClick={() => {
                  startRandom('exam');
                }}
              >
                {'랜덤 '}
                {Math.min(count, randomPool.length)}
                {'문제 CBT'}
              </button>
            </div>
            <button
              onClick={() => {
                props.onResetDraws();
              }}
              className={'cycle-reset'}
            >
              {'랜덤 출제 순환 다시 시작'}
            </button>
            {!loading && !randomPool.length && excludeSeen ? (
              <p className={'muted'}>
                {
                  '선택 범위가 모두 출제됐습니다. 풀이 기록에서 이어 풀거나 출제 순환을 다시 시작하세요. 오답 기록은 지워지지 않습니다.'
                }
              </p>
            ) : null}
          </section>
        ) : tab === 'wrong' ? (
          <section className={'selection-panel'}>
            <h2>
              {'중간고사 전용 오답 '}
              {wrongPool.length}
              {'문제'}
            </h2>
            <p className={'muted'}>
              {'기존 공조·한솔 오답과 섞이지 않습니다.'}
            </p>
            <div className={'midterm-actions'}>
              <button
                disabled={!wrongPool.length}
                onClick={() => {
                  startOrdered(wrongPool, 'learn', '오답 복습');
                }}
              >
                {'오답 '}
                {wrongPool.length}
                {'문제 복습'}
              </button>
            </div>
            <div className={'record-grid'}>
              {wrongGroups.map((group) => (
                <article key={group.label}>
                  <h3>{group.label}</h3>
                  <p>
                    {'오답 '}
                    {wrongCount(group)}
                    {'문제'}
                  </p>
                  <button
                    onClick={() => {
                      startOrdered(
                        wrongItems(group.aliases),
                        'learn',
                        `${group.label} · ${sourceLabel} 오답`,
                      );
                    }}
                  >
                    {'이 범위 오답 풀기'}
                  </button>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <section className={'selection-panel'}>
            <h2>
              {'진행 중인 문제 묶음 '}
              {sessions.length}
              {'개'}
            </h2>
            <p className={'muted'}>
              {
                '이전 문제·답안·위치를 보관합니다. 새 풀이는2006년3회~2016년 기존 공조, 2017년부터 한솔 자료를 사용합니다.'
              }
            </p>
            <div className={'record-grid'}>
              {sessions.map((saved) => (
                <article key={saved.id} data-session-id={saved.id}>
                  <h3>{saved.title}</h3>
                  <p>
                    {Object.keys(saved.answers).length}
                    {'/'}
                    {saved.itemIds.length}
                    {'문제 · '}
                    {new Date(saved.savedAt).toLocaleString('ko-KR')}
                  </p>
                  <button
                    onClick={() => {
                      props.onResume(saved.id!);
                    }}
                  >
                    {'이 묶음 이어풀기'}
                  </button>
                </article>
              ))}
            </div>
            <h2>
              {'완료한 중간고사 '}
              {history.length}
              {'개'}
            </h2>
            <div className={'record-grid'}>
              {history.map((record) => (
                <article key={record.id}>
                  <h3>{record.title}</h3>
                  <p>
                    {record.mode === 'exam' ? 'CBT' : '학습'}
                    {' · '}
                    {record.score}
                    {'점 · '}
                    {new Date(record.finishedAt).toLocaleString('ko-KR')}
                  </p>
                  <button
                    onClick={() => {
                      props.onReplay(record.id);
                    }}
                  >
                    {'같은 문제 다시 풀기'}
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}
        <details className={'classification-help safety-separate'}>
          <summary>
            {'안전관리·법규 별도 '}
            {safetyPool.length}
            {'문제'}
          </summary>
          <p>
            {
              '일반 전체·랜덤·목차 풀이에서는 제외했습니다. 필요한 경우에만 이 묶음을 따로 풉니다.'
            }
          </p>
          <p>
            {'법규·운전안전 '}
            {safetyCounts[0]}
            {'개 · 보호장치 '}
            {safetyCounts[1]}
            {'개 · 냉매 누설검사 '}
            {safetyCounts[2]}
            {'개'}
          </p>
          <div className={'midterm-actions'}>
            <button
              disabled={loading || !safetyPool.length}
              onClick={() => {
                startOrdered(safetyPool, 'learn', '안전관리·법규 별도');
              }}
            >
              {'안전관리 별도 학습'}
            </button>
            <button
              disabled={loading || !safetyPool.length}
              onClick={() => {
                startOrdered(safetyPool, 'exam', '안전관리·법규 별도');
              }}
            >
              {'안전관리 별도 CBT'}
            </button>
          </div>
        </details>
        <details className={'classification-help'}>
          <summary>{'시험 범위·목차 분류 안내'}</summary>
          <p>
            {
              '2006년3회~2016년은 기존 공조, 2017~2023년3회는 한솔 공조를 사용합니다. 교재 본문의 핵심·실전·예제를 대조하며 맨 뒤 회차별 기출 부록은 제외합니다. 안전관리·법규는 계속 별도입니다. 미연결 예제·수치 변형·정답 차이는 확인 목록에 남기며 기존 자료를 임의 변경하지 않습니다.'
            }
          </p>
          <p>
            {
              '보내주신 교재의6개 장과 세부 목차를 반영했습니다. 본문에서 묻는 원리·운전·부품을 우선하고 모호한 문항은 보기·원문 그림을 추가 확인했습니다. 목차 배치가 교재에 실제 수록됐다는 뜻은 아닙니다. ‘분류 미확인’ '
            }
            {topicCount('분류 미확인')}
            {'문제는 판정이 어려울 때 별도 유지됩니다.'}
          </p>
          <p>
            {
              '원래 문제 그림·정답·해설과 기존 기록은 유지됩니다. 완전히 같은 문항은 한 번만 출제하지만 다른 그림의 유사문제까지 모두 같은 문제로 판정한 것은 아닙니다.'
            }
          </p>
        </details>
      </section>
    </>
  );
}
