import {clsx as normalizeClass} from 'clsx';
import QuestionLibraryPreview from '../QuestionLibraryPreview';
import type { WrongViewModel } from '../../cbt/studyController';

export function renderWrongView(m: WrongViewModel) {
  const {
    beginSession,
    displayedWrongItems,
    isCalculationItem,
    openView,
    restoredImageTheme,
    selectedCatalog,
    selectedWrongCalculationCount,
    studyStore,
    wrongAnswerDetailMap,
    wrongItems,
    wrongRoundFilter,
    wrongRoundGroups,
    wrongTypeFilter,
  } = m;
  return (
    <>
      <section className="tool-hero wrong-hero">
        <div>
          <span>WRONG ANSWERS BY ROUND</span>
          <h1>회차별 오답만 골라 복습하세요</h1>
          <p>
            {selectedCatalog.name}
            {' · 선택한 회차 '}
            {displayedWrongItems.length}
            문제
          </p>
        </div>
        {displayedWrongItems.length ? (
          <button
            type="button"
            onClick={() => {
              beginSession(
                'learn',
                `${selectedCatalog.shortName || selectedCatalog.name} ${wrongTypeFilter === 'calculation' ? '계산 오답' : '회차별 오답'} 복습`,
                displayedWrongItems,
                {},
                { calculationMode: wrongTypeFilter === 'calculation' },
              );
            }}
          >
            {wrongTypeFilter === 'calculation' ? '계산 오답 다시 풀기' : '이 회차 오답 다시 풀기'}
          </button>
        ) : null}
      </section>
      {wrongRoundGroups.length ? (
        <div role="group" aria-label="오답 회차 선택" className="wrong-round-filter">
          {wrongRoundGroups.map((group) => (
            <button
              key={group.roundId}
              type="button"
              onClick={() => {
                m.wrongRoundFilter = group.roundId;
              }}
              className={normalizeClass([{ active: wrongRoundFilter === group.roundId }])}
            >
              <strong>
                {group.year}
                {'년 '}
                {group.session || group.title.replace(/^.*?:\s*/, '')}
              </strong>
              <span>
                {group.items.length}
                {'문제 · 계산 오답 '}
                {group.items.filter(isCalculationItem).length}
                {' · 기록 '}
                {group.attempts}회
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {wrongItems.length ? (
        <div role="group" aria-label="오답 종류 선택" className="problem-kind-filter">
          <button
            type="button"
            onClick={() => {
              m.wrongTypeFilter = 'all';
            }}
            className={normalizeClass([{ active: wrongTypeFilter === 'all' }])}
          >
            {'전체 오답 '}
            <strong>{wrongItems.length}</strong>
          </button>
          <button
            type="button"
            onClick={() => {
              m.wrongTypeFilter = 'calculation';
            }}
            className={normalizeClass([{ active: wrongTypeFilter === 'calculation' }])}
          >
            {'계산 오답 '}
            <strong>{selectedWrongCalculationCount}</strong>
          </button>
        </div>
      ) : null}
      {displayedWrongItems.length ? (
        <div className="question-library">
          {displayedWrongItems.map((item) => (
            <article key={item.id}>
              <header>
                <span>
                  {item.round.year}
                  {'년 · '}
                  {item.subject}
                </span>
                <b>{item.question.number}번</b>
              </header>
              <QuestionLibraryPreview {...{
                  text: item.question.text || '',
                  image: item.question.sourceImage,
                  imageTheme: restoredImageTheme,
                }}
              />
              <footer>
                {wrongAnswerDetailMap.get(item.id) ? (
                  <span>
                    {'내 답 '}
                    {wrongAnswerDetailMap.get(item.id)?.selected}
                    {'번 · 정답 '}
                    {wrongAnswerDetailMap.get(item.id)?.answer}번
                  </span>
                ) : (
                  <span>{studyStore.attempts[item.id]?.wrongCount || 1}회 오답</span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    beginSession(
                      'learn',
                      `${item.round.year}년 ${item.question.number}번 복습`,
                      [item],
                      {},
                      { calculationMode: isCalculationItem(item) },
                    );
                  }}
                >
                  다시 풀기 →
                </button>
              </footer>
            </article>
          ))}
        </div>
      ) : (
        <section className="empty-state">
          <span>✓</span>
          <h2>
            {wrongTypeFilter === 'calculation' ? '이 회차에는 계산 오답이 없습니다' : '현재 오답이 없습니다'}
          </h2>
          <p>
            {wrongTypeFilter === 'calculation'
              ? '다른 회차를 선택하거나 전체 오답으로 바꿔 보세요.'
              : '학습모드에서 틀린 문제가 생기면 이곳에 자동으로 모입니다.'}
          </p>
          {wrongTypeFilter === 'calculation' ? (
            <button
              onClick={() => {
                m.wrongTypeFilter = 'all';
              }}
            >
              전체 오답 보기
            </button>
          ) : (
            <button
              onClick={() => {
                openView('home');
              }}
            >
              학습 시작하기
            </button>
          )}
        </section>
      )}
    </>
  );
}
