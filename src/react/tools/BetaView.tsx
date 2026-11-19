import type { BetaViewModel } from '../../cbt/studyController';
import {clsx as normalizeClass} from 'clsx';
export function renderBetaView(m: BetaViewModel) {
  const {
    betaFalseConfidenceRows,
    betaLowConfidenceRows,
    betaMemoRows,
    betaModeFilter,
    betaModeSummaries,
    betaReasonRows,
    betaWeakRows,
    settingsOpen,
    startBetaReview,
    startBetaTrial,
  } = m;

  return (
    <>
      <section className="beta-lab-hero">
        <div>
          <span>
            <b>β</b>
            {' OPTIONAL LEARNING TOOLS'}
          </span>
          <h1>
            기존 CBT와 바로 비교하는
            <br />
            <em>베타 학습 도구</em>
          </h1>
          <p>
            문제와 정답 데이터는 건드리지 않고 확신도·실수 원인·내 메모만 별도로 저장합니다. 설정에서 전체
            OFF하면 기존 화면으로 즉시 돌아갑니다.
          </p>
          <div>
            <button type="button" onClick={startBetaTrial}>
              5문제로 비교하기
            </button>
            <button
              type="button"
              onClick={() => {
                m.settingsOpen = true;
              }}
              className="secondary"
            >
              전체 ON/OFF 설정
            </button>
          </div>
        </div>
        <aside>
          <strong>실험 기능 전체 ON</strong>
          <span>기존 학습 기록 유지</span>
          <small>OFF해도 베타 기록은 삭제하지 않습니다.</small>
        </aside>
      </section>
      <section aria-label="학습모드와 CBT모드 기록 선택" className="beta-mode-compare">
        {betaModeSummaries.map((summary) => (
          <button
            key={summary.mode}
            type="button"
            onClick={() => {
              m.betaModeFilter = summary.mode;
            }}
            className={normalizeClass([{ active: betaModeFilter === summary.mode }])}
          >
            <span>{summary.mode === 'learn' ? 'LEARNING MODE' : 'CBT MODE'}</span>
            <strong>{summary.mode === 'learn' ? '학습모드 기록' : 'CBT모드 기록'}</strong>
            <div>
              <small>
                {'확신 '}
                <b>{summary.sure}</b>
              </small>
              <small>
                {'애매 '}
                <b>{summary.unsure}</b>
              </small>
              <small>
                {'찍음 '}
                <b>{summary.guess}</b>
              </small>
              <small>
                {'자동 취약 '}
                <b>{summary.weak}</b>
              </small>
            </div>
          </button>
        ))}
      </section>
      <section className="beta-summary-grid">
        <article>
          <span>
            {betaModeFilter === 'learn' ? '학습' : 'CBT'}
            {' 애매·찍음'}
          </span>
          <strong>{betaLowConfidenceRows.length}</strong>
          <small>확신 낮은 문제</small>
        </article>
        <article>
          <span>내 메모</span>
          <strong>{betaMemoRows.length}</strong>
          <small>동기화되는 문제 메모</small>
        </article>
        <article>
          <span>확신 오답</span>
          <strong>{betaFalseConfidenceRows.length}</strong>
          <small>알았다고 생각했지만 틀림</small>
        </article>
        <article>
          <span>자동 취약</span>
          <strong>{betaWeakRows.length}</strong>
          <small>오답·확신도를 함께 분석</small>
        </article>
      </section>
      <section className="beta-review-grid">
        <button
          type="button"
          disabled={!betaLowConfidenceRows.length}
          onClick={() => {
            startBetaReview('confidence');
          }}
        >
          <span>01 · CONFIDENCE</span>
          <strong>애매·찍음 다시 풀기</strong>
          <p>정답 여부와 별개로 확신이 없었던 문제를 최대 20개 다시 냅니다.</p>
          <b>
            {betaLowConfidenceRows.length}
            문제 →
          </b>
        </button>
        <button
          type="button"
          disabled={!betaFalseConfidenceRows.length}
          onClick={() => {
            startBetaReview('false-confidence');
          }}
        >
          <span>02 · BLIND SPOT</span>
          <strong>확신했지만 틀린 문제</strong>
          <p>잘못 알고 있던 개념을 일반 오답보다 먼저 찾아냅니다.</p>
          <b>
            {betaFalseConfidenceRows.length}
            문제 →
          </b>
        </button>
        <button
          type="button"
          disabled={!betaMemoRows.length}
          onClick={() => {
            startBetaReview('memo');
          }}
        >
          <span>03 · MY NOTE</span>
          <strong>메모한 문제 모아 풀기</strong>
          <p>문제마다 적은 공식·주의점을 유지한 채 다시 학습합니다.</p>
          <b>
            {betaMemoRows.length}
            문제 →
          </b>
        </button>
        <button
          type="button"
          disabled={!betaWeakRows.length}
          onClick={() => {
            startBetaReview('weak');
          }}
        >
          <span>04 · WEAKNESS ENGINE</span>
          <strong>
            {betaModeFilter === 'learn' ? '학습' : 'CBT'}
            {' 취약 문제 자동 검출'}
          </strong>
          <p>오답률, 최근 오답, 애매·찍음, 확신 오답을 합쳐 약한 문제부터 냅니다.</p>
          <b>
            {betaWeakRows.length}
            문제 →
          </b>
        </button>
      </section>
      <section className="beta-reason-panel">
        <header>
          <div>
            <span>MISTAKE MAP</span>
            <h2>실수 원인별 복습</h2>
          </div>
          <p>풀이 화면에서 이유를 눌러야 이곳에 모입니다.</p>
        </header>
        <div>
          {betaReasonRows.map((row) => (
            <button
              key={row.key}
              type="button"
              disabled={!row.count}
              onClick={() => {
                startBetaReview(row.key);
              }}
            >
              <span>{row.label}</span>
              <strong>{row.count}</strong>
              <small>문제 다시 풀기 →</small>
            </button>
          ))}
        </div>
      </section>
      <section className="beta-compare-panel">
        <div>
          <b>ON</b>
          <strong>문제 아래에 확신도·실수 원인·내 메모가 표시됩니다.</strong>
          <span>시험모드에서는 답안 속도를 계산해 완료 예상과 시간 여유를 보여 줍니다.</span>
        </div>
        <div>
          <b>OFF</b>
          <strong>v3.5.4와 같은 기존 문제풀이 화면으로 돌아갑니다.</strong>
          <span>추가 버튼과 베타 메뉴만 숨고 답안·오답·메모 기록은 보존됩니다.</span>
        </div>
      </section>
    </>
  );
}
