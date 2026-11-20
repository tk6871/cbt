import { subjectPhoto } from './subjectPhotos';
import { problemImage } from '../cbt/problemImages';
import {
  responsiveImageAttrs,
  restoreOriginalImage,
} from '../cbt/responsiveImages';
import './theme-cover.css';
interface Props {
  styleName: 'simpsons' | 'sunjae';
  subject: string;
  subjectName: string;
  portrait: string;
  jewelry: boolean;
  answered: number;
  accuracy: number;
  onResume?: () => void;
  onRounds: () => void;
  onSecondary: () => void;
  onSettings: () => void;
}
export default function ThemeStudyCover({
  styleName,
  subject,
  subjectName,
  portrait,
  jewelry,
  answered,
  accuracy,
  onResume,
  onRounds,
  onSecondary,
  onSettings,
}: Props) {
  const simpsons = styleName === 'simpsons';
  const { srcset, ...imageAttrs } = responsiveImageAttrs(
    portrait,
    '(max-width:650px) 94vw, (max-width:1400px) 46vw, 680px',
  );
  return (
    <section className={'fan-cover cover-' + styleName} data-subject={subject}>
      <div className="fan-cover-copy">
        <p>{simpsons ? '스프링필드 학습 클럽' : '선재와 함께하는 학습 노트'}</p>
        <h1>
          {simpsons ? '오늘의' : '오늘도,'}
          <br />
          <em>{simpsons ? '공부 한 컷' : '같이 달릴래?'}</em>
        </h1>
        <div className="fan-cover-actions">
          {onResume && <button onClick={onResume}>이어서 풀기</button>}
          <button onClick={onRounds}>
            회차별 기출 고르기 <span aria-hidden="true">→</span>
          </button>
          <button onClick={onSecondary}>
            {jewelry ? '오답 다시 풀기' : '교재에서 풀기'}
          </button>
        </div>
        <small>
          누적 {answered.toLocaleString()}문제 · 정답률 {accuracy}%
        </small>
      </div>
      <div className="fan-art">
        <img
          src={problemImage(portrait)}
          srcSet={srcset}
          {...imageAttrs}
          onError={restoreOriginalImage}
          alt={simpsons ? '스프링필드의 환영 표지판' : '변우석 테마 사진'}
        />
        <figure>
          <img src={subjectPhoto(subject)} alt="" />
          <figcaption>{subjectName}</figcaption>
        </figure>
      </div>
      <button
        className="fan-cover-settings"
        aria-label="테마 설정"
        onClick={onSettings}
      >
        ⚙
      </button>
    </section>
  );
}
