import type { CalculationViewModel } from '../../cbt/studyController';
import {clsx as normalizeClass} from 'clsx';
import QuestionLibraryPreview from '../QuestionLibraryPreview';
import { problemImage } from '../../cbt/problemImages';
import {lazy,Suspense} from 'react';
import {OptionalTool} from '../OptionalTool';
const MathFormula=lazy(()=>import('../practical/MathFormula'));
const FormulaWorkbench=lazy(()=>import('./FormulaWorkbench'));
export function renderCalculationView(m: CalculationViewModel) {
  const {
    beginSession,
    calculationPage,
    calculationPagination,
    calculationResultFilter,
    calculationRoundFilter,
    calculationRounds,
    calculationRows,
    calculationSubjectFilter,
    calculationSubjects,
    calculationWrongRows,
    filteredCalculationRows,
    formulaRenderSamples,
    formulaWorkbenchOpen,
    hvacCalculatorMemory,
    hvacCalculatorMemoryGroups,
    hvacCalculatorSheetNotes,
    hvacFrequentFormulas,
    restoredImageTheme,
    selectedCatalog,
    startCalculationLearning,
    stripMarkup,
  } = m;

  return (
    <>
      <section className="tool-hero calculation-hero">
        <div>
          <span>FORMULA PRACTICE</span>
          <h1>계산이 필요한 문제만 골라 푸세요</h1>
          <p>
            {selectedCatalog.name}
            {' · 현재 범위에서 '}
            {calculationRows.length.toLocaleString()}
            문제 감지
          </p>
        </div>
        <div>
          <button
            type="button"
            onClick={() => {
              m.formulaWorkbenchOpen = !formulaWorkbenchOpen;
            }}
          >
            {formulaWorkbenchOpen ? '수식 실험실 닫기' : '수식 계산 실험'}
          </button>
          <button
            type="button"
            disabled={!filteredCalculationRows.length}
            onClick={() => {
              startCalculationLearning(20);
            }}
          >
            취약순 20문제 시작
          </button>
        </div>
      </section>
      {formulaWorkbenchOpen ? (
        <OptionalTool title="수식 계산 실험실"><FormulaWorkbench onClose={()=>{m.formulaWorkbenchOpen=false;}}/></OptionalTool>
      ) : null}
      {selectedCatalog.key === 'hvac' || selectedCatalog.key === 'hvac-hansol' ? (
        <section className="calculator-memory-sheet">
          <header>
            <div>
              <span>FX-991EX MEMORY MAP</span>
              <h2>전체 단위·공식 전에 보는 계산기 저장표</h2>
              <p>AB 공기 · CD 물 · EF 온도와 습도 · XY 냉동톤 · M 힘과 수두</p>
            </div>
            <strong>9개 저장</strong>
          </header>
          <div className="calculator-memory-groups">
            {hvacCalculatorMemoryGroups.map((group) => (
              <article key={group.key} className={normalizeClass([`memory-group-${group.key}`])}>
                <h3>{group.title}</h3>
                <div>
                  {hvacCalculatorMemory
                    .filter((entry) => entry.group === group.key)
                    .map((item) => (
                      <section key={item.variable}>
                        <b>{item.variable}</b>
                        <strong>{item.value}</strong>
                        <span>{item.name}</span>
                        <small>
                          {item.unit}
                          {' · '}
                          {item.use}
                        </small>
                      </section>
                    ))}
                </div>
              </article>
            ))}
          </div>
          <details className="calculator-formula-sheet">
            <summary>
              <span>
                <b>∑</b>
                <strong>저장한 A~M으로 자주 나온 공식 보기</strong>
                <small>
                  {'실제 공조 계산문제에서 반복된 유형 '}
                  {hvacFrequentFormulas.length}개
                </small>
              </span>
              <em>열기</em>
            </summary>
            <div className="calculator-formula-grid">
              {hvacFrequentFormulas.map((formula) => (
                <article key={formula.title}>
                  <header>
                    <span>{formula.frequency}</span>
                    <h3>{formula.title}</h3>
                  </header>
                  <p>
                    <b>구하는 것</b>
                    {formula.target}
                  </p>
                  <strong className="formula-line">{formula.formula}</strong>
                  {formula.calculatorFormula ? (
                    <strong className="stored-formula-line">
                      {'저장값 사용: '}
                      {formula.calculatorFormula}
                    </strong>
                  ) : null}
                  <ol>
                    {formula.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  {formula.caution ? (
                    <small>
                      {'주의 · '}
                      {formula.caution}
                    </small>
                  ) : null}
                </article>
              ))}
            </div>
          </details>
          <details className="formula-render-compare">
            <summary>
              <span>
                <b>ƒ</b>
                <strong>계산식 텍스트 표시 비교</strong>
                <small>기존 글자와 KaTeX 수식을 직접 비교</small>
              </span>
              <em>열기</em>
            </summary>
            <div className="formula-render-grid">
              {formulaRenderSamples.map((sample) => (
                <article key={sample.title}>
                  <h3>{sample.title}</h3>
                  {sample.sourceImage ? (
                    <img
                      src={problemImage(sample.sourceImage)}
                      alt="PP-FormulaNet으로 인식한 공조 원문 수식"
                      className="formula-source-image restored-image-original"
                    />
                  ) : null}
                  <section>
                    <span>{sample.sourceImage ? 'PP-FormulaNet-plus-M 인식 LaTeX' : '기존 텍스트'}</span>
                    <p>{sample.plain}</p>
                  </section>
                  <section className="is-katex">
                    <span>KaTeX</span>
                    <Suspense fallback={null}><MathFormula {...{ tex: sample.tex, label: `${sample.title} 수식` }}/></Suspense>
                  </section>
                </article>
              ))}
            </div>
            <p>
              PP-FormulaNet-plus-M을 Mac M4 Pro의 arm64 CPU로 실행한 실제 원문 샘플입니다. 자동 전수 적용은
              오인식 검수 방식까지 비교한 뒤 결정합니다.
            </p>
          </details>
          <ul className="calculator-memory-notes">
            {hvacCalculatorSheetNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="calculation-filter-panel">
        <header>
          <div>
            <span>FILTER</span>
            <h2>과목과 회차 선택</h2>
          </div>
          <strong>
            {filteredCalculationRows.length.toLocaleString()}
            문제
          </strong>
        </header>
        <div role="group" aria-label="계산문제 학습 종류 선택" className="problem-kind-filter">
          <button
            type="button"
            onClick={() => {
              m.calculationResultFilter = 'all';
            }}
            className={normalizeClass([{ active: calculationResultFilter === 'all' }])}
          >
            {'전체 계산문제 '}
            <strong>{calculationRows.length.toLocaleString()}</strong>
          </button>
          <button
            type="button"
            onClick={() => {
              m.calculationResultFilter = 'wrong';
            }}
            className={normalizeClass([{ active: calculationResultFilter === 'wrong' }])}
          >
            {'계산 오답 '}
            <strong>{calculationWrongRows.length.toLocaleString()}</strong>
          </button>
        </div>
        <div className="calculation-filter-grid">
          <label>
            <span>과목</span>
            <select
              value={calculationSubjectFilter}
              onChange={(event) => {
                m.calculationSubjectFilter = event.currentTarget.value as typeof calculationSubjectFilter;
              }}
            >
              <option value="all">전체 과목</option>
              {calculationSubjects.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>회차</span>
            <select
              value={calculationRoundFilter}
              onChange={(event) => {
                m.calculationRoundFilter = event.currentTarget.value as typeof calculationRoundFilter;
              }}
            >
              <option value="all">
                {'전체 회차 · '}
                {calculationResultFilter === 'wrong' ? calculationWrongRows.length : calculationRows.length}
                문제
              </option>
              {calculationRounds.map((round) => (
                <option key={round.id} value={round.id}>
                  {round.label}
                  {' · '}
                  {calculationResultFilter === 'wrong' ? round.wrongCount : round.count}
                  문제
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!filteredCalculationRows.length}
            onClick={() => {
              startCalculationLearning();
            }}
          >
            {calculationResultFilter === 'wrong' ? '선택한 계산 오답 풀기 →' : '선택한 계산문제 전체 풀기 →'}
          </button>
        </div>
        <p>
          문제 문장과 보기의 계산 키워드를 기준으로 자동 분류합니다. 계산 전용 학습에서는 정답 뒤에 공식과
          숫자 출처, 계산 순서를 간단히 확인할 수 있습니다.
        </p>
      </section>
      {filteredCalculationRows.length ? (
        <div className="question-library calculation-library">
          {calculationPagination.rows.map((item) => (
            <article key={item.id}>
              <header>
                <span>
                  {item.round.year}
                  {'년 · '}
                  {item.subject}
                </span>
                <b>{item.question.number}번</b>
              </header>
              <QuestionLibraryPreview
                item={item}
                text={stripMarkup(item.question.text || item.question.html)}
                imageTheme={restoredImageTheme}
              />
              <footer>
                <span>{item.round.session || item.round.title}</span>
                <button
                  type="button"
                  onClick={() => {
                    beginSession(
                      'learn',
                      `${item.round.year}년 ${item.question.number}번 계산 풀이`,
                      [item],
                      {},
                      { calculationMode: true },
                    );
                  }}
                >
                  풀어보기 →
                </button>
              </footer>
            </article>
          ))}
        </div>
      ) : null}
      {filteredCalculationRows.length ? (
        <nav aria-label="계산문제 목록 페이지" className="library-pagination">
          <button
            type="button"
            disabled={calculationPagination.page <= 1}
            onClick={() => {
              m.calculationPage = calculationPagination.page - 1;
            }}
          >
            ← 이전 목록
          </button>
          <span role="status">
            {calculationPagination.first}~{calculationPagination.last}
            {' / '}
            {filteredCalculationRows.length}
            {'문제 · '}
            {calculationPagination.page}/{calculationPagination.pages}쪽
          </span>
          <button
            type="button"
            disabled={calculationPagination.page >= calculationPagination.pages}
            onClick={() => {
              m.calculationPage = calculationPagination.page + 1;
            }}
          >
            다음 목록 →
          </button>
        </nav>
      ) : (
        <section className="empty-state">
          <span>∑</span>
          <h2>조건에 맞는 계산문제가 없습니다</h2>
          <p>과목 또는 회차를 전체로 바꿔 보세요.</p>
          <button
            type="button"
            onClick={() => {
              m.calculationSubjectFilter = 'all';
              m.calculationRoundFilter = 'all';
              m.calculationResultFilter = 'all';
            }}
          >
            계산 필터 초기화
          </button>
        </section>
      )}
    </>
  );
}
