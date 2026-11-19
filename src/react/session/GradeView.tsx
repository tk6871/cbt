import {clsx as normalizeClass} from 'clsx';
import { problemImage } from '../../cbt/problemImages';
import type { GradeViewModel } from '../../cbt/studyController';

export function renderGradeView(m: GradeViewModel) {
  const {
    displayedResultScore,
    examResult,
    leaveSession,
    officialRule,
    openResultWrongAnswers,
    responsiveImageAttrs,
    restoreOriginalImage,
    session,
    simpsonsKingSizeImage,
    simpsonsThemeImage,
    sunjaeGradingImage,
    sunjaeResultDetail,
    sunjaeResultImage,
    sunjaeResultPhase,
    sunjaeResultTitle,
    visualStyle,
  } = m;
  if (!session || !examResult) return null;
  function gradeImageAttrs(source: string, sizes: string) {
    const { srcset, ...attributes } = responsiveImageAttrs(source, sizes);
    return { ...attributes, srcSet: srcset };
  }
  return (
    <>
      <>
        {examResult ? (
          <div className="result-backdrop">
            <section
              className={normalizeClass([
                'result-card',
                {
                  'sunjae-result-card': visualStyle === 'sunjae',
                  'sunjae-result-revealed': visualStyle === 'sunjae' && sunjaeResultPhase === 'reveal',
                },
              ])}
            >
              {visualStyle === 'sunjae' && sunjaeResultPhase === 'grading' ? (
                <div className="sunjae-grading-stage">
                  <div className="sunjae-grading-photo">
                    <img
                      {...gradeImageAttrs(sunjaeGradingImage, 'auto, (max-width: 820px) 80vw, 640px')}
                      onError={restoreOriginalImage}
                      src={problemImage(sunjaeGradingImage)}
                      alt="답안을 채점하는 변우석"
                    />
                    <i />
                    <i />
                    <i />
                  </div>
                  <div className="sunjae-grading-copy">
                    <span>선재가 채점 중 ···</span>
                    <strong>잠깐만, 내가 하나씩 볼게.</strong>
                    <p>네가 끝까지 푼 답안이니까 더 꼼꼼하게 확인하고 있어.</p>
                    <div>
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {visualStyle === 'simpsons' ? (
                    <div className="simpsons-result-message">
                      <img
                        src={problemImage(
                          examResult.score >= 60 ? simpsonsKingSizeImage : simpsonsThemeImage,
                        )}
                        alt={examResult.score >= 60 ? '꽃무늬 옷을 입은 뚱뚱한 호머' : '호머와 바트'}
                      />
                      <p>
                        <strong>
                          {examResult.score >= 60 ? '오늘은 목 조르기 면제!' : '호머가 오기 전에 오답 복습!'}
                        </strong>
                        <span>
                          {examResult.score >= 60
                            ? '바트도 놀랄 만큼 잘 풀었습니다.'
                            : '이번 회차 오답만 다시 풀면 점수가 금방 올라갑니다.'}
                        </span>
                      </p>
                    </div>
                  ) : null}
                  {visualStyle === 'sunjae' ? (
                    <div
                      className={normalizeClass([
                        'sunjae-result-message',
                        { praise: examResult.score >= 60 },
                      ])}
                    >
                      <img
                        {...gradeImageAttrs(
                          sunjaeResultImage(examResult.score),
                          'auto, (max-width: 820px) 80vw, 640px',
                        )}
                        onError={restoreOriginalImage}
                        src={problemImage(sunjaeResultImage(examResult.score))}
                        alt={
                          examResult.score >= 60
                            ? '점수를 칭찬하는 선재·변우석'
                            : '다음 학습을 응원하는 선재·변우석'
                        }
                      />
                      <p>
                        <strong>{sunjaeResultTitle(examResult.score)}</strong>
                        <span>{sunjaeResultDetail(examResult.score)}</span>
                      </p>
                    </div>
                  ) : null}
                  <span>
                    {session.mode === 'exam' ? (examResult.passed ? 'PASS' : 'REVIEW') : 'LEARNING RESULT'}
                  </span>
                  <h2>
                    {session.mode === 'learn'
                      ? '현재 학습 결과입니다'
                      : examResult.passed
                        ? '합격 기준을 통과했습니다'
                        : '조금 더 복습이 필요합니다'}
                  </h2>
                  <div className="result-score">
                    {displayedResultScore}
                    <small>점</small>
                  </div>
                  <p>
                    {examResult.total}
                    {'문제 중 '}
                    {examResult.correct}
                    문제를 맞혔습니다.
                  </p>
                  <p className="result-criteria">
                    <span>{examResult.official ? 'Q-Net 필기 기준' : '기준 확인 필요'}</span>
                    <strong>{examResult.criteria}</strong>
                    {examResult.source ? (
                      <a href={problemImage(examResult.source)} target="_blank" rel="noopener">
                        공식 기준 보기
                      </a>
                    ) : null}
                  </p>
                  <div className="subject-results">
                    {examResult.subjectRows.map((row) => (
                      <div key={row.subject}>
                        <span>{row.subject}</span>
                        <strong>{row.score}점</strong>
                        <small
                          className={normalizeClass([
                            { fail: officialRule?.scoring === 'subject-average' && !row.passed },
                          ])}
                        >
                          {officialRule?.scoring === 'total-only' ? '참고' : row.passed ? '통과' : '과락'}
                        </small>
                      </div>
                    ))}
                  </div>
                  <div className="result-actions">
                    <button
                      type="button"
                      onClick={() => {
                        m.examResult = null;
                        session.finished = false;
                      }}
                    >
                      문제 다시 보기
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        openResultWrongAnswers(false);
                      }}
                    >
                      이번 회차 오답 보기
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        openResultWrongAnswers(true);
                      }}
                    >
                      오답만 다시 풀기
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        leaveSession();
                      }}
                    >
                      시작 화면으로
                    </button>
                  </div>
                </>
              )}
            </section>
          </div>
        ) : null}
      </>
    </>
  );
}
