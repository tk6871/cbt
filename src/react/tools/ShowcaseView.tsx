import type { ShowcaseViewModel } from '../../cbt/studyController';
import {clsx as normalizeClass} from 'clsx';
import { createPortal } from 'react-dom';
import { problemImage } from '../../cbt/problemImages';
export function renderShowcaseView(m: ShowcaseViewModel) {
  const {
    answerLayout,
    applyTheme,
    currentVersion,
    darkActive,
    dynamicUiEnabled,
    isJewelry,
    openCalculator,
    openHvacPracticalGuide,
    openQualificationRounds,
    openTextbookPages,
    openView,
    patchEntries,
    pluginExperiences,
    responsiveImageAttrs,
    restoreOriginalImage,
    restoredDarkPreviewImage,
    restoredImageTheme,
    searchBookmarksOnly,
    setAnswerLayout,
    setDynamicUiEnabled,
    setHotspotIndicator,
    setRestoredImageTheme,
    setSolveLayoutMode,
    settingsOpen,
    simpsonsThemeImage,
    solveLayoutMode,
    startFeatureRound,
    theme,
    toggleLightDark,
    upscaleComparison,
    upscalePreview,
    upscalePreviewKind,
  } = m;

  function imageAttrs(source: string, sizes: string) {
    const { srcset, ...rest } = responsiveImageAttrs(source, sizes);
    return { ...rest, srcSet: srcset };
  }
  return (
    <>
      <section className="feature-hero">
        <div className="feature-orb feature-orb-one" />
        <div className="feature-orb feature-orb-two" />
        <div className="feature-hero-copy">
          <span>
            <b>NEW</b>
            {' INTERACTIVE LEARNING LAB · v'}
            {currentVersion}
          </span>
          <h1>
            새 기능을 바로 배우고 눌러보는
            <br />
            <em>신기술 학습관</em>
          </h1>
          <p>정식으로 적용된 문제풀이와 화면 기능을 한곳에서 익힐 수 있습니다.</p>
          <div>
            <button
              type="button"
              onClick={() => {
                openView('rounds');
              }}
            >
              3분 체험 시작 →
            </button>
            <button
              type="button"
              onClick={() => {
                openView('updates');
              }}
            >
              ← 패치노트로
            </button>
          </div>
        </div>
        <div className="feature-pulse">
          <i />
          <i />
          <i />
          <strong>LIVE</strong>
          <span>Vue Motion</span>
        </div>
      </section>
      <section className="feature-layout-lab settings-feature-guide">
        <header>
          <div>
            <span>NEW · v{currentVersion}</span>
            <h2>문제는 그대로, 풀이만 펼쳐 보기</h2>
          </div>
          <p>
            교재 원문에서 실제 문제와 풀이를 나누고 다른 열·쪽의 해설과 공통 그림을 연결했습니다. 본문
            오인식과 번호 오인식 중복은 목록에서 제외하되 원본·기록·화질 개선본은 보존합니다. 다크·라이트·원본
            보기와 기기 내 선택 저장을 지원하며, 화면 경계 검수는 전체 정답 검증·자동채점 완료와 구분합니다.
          </p>
        </header>
        <p>
          같은 지문·보기 순서·정답이 확인된 문제는 기존 등록 해설을 먼저 표시합니다. 원문 해설을 펼쳐 비교할
          수 있고 기존 학습 설명도 보존합니다. 확인된 오타·수치·정답 차이는 교재용 사본에서 구분하며 내부
          불일치나 복수정답은 보류 사유를 표시합니다. CBT 시험 중 정답을 포함한 안내는 숨깁니다. 실시간
          재수집이나 공식 정답 인증은 아닙니다.
        </p>
        <p>
          교재 선택 화면에서는 사이트 메뉴를 그대로 사용합니다. 문제를 펼친 뒤에는 ‘목차·쪽 선택’과 인쇄
          쪽번호를 눌러 이동할 수 있습니다. 연결 현황과 긴 안내는 필요한 경우에만 별도 탭에서 확인하세요.
        </p>
        <button type="button" onClick={openTextbookPages}>
          교재 페이지별 열기 →
        </button>
      </section>
      <section className="feature-layout-lab settings-feature-guide">
        <header>
          <div>
            <span>NEW · v5.4</span>
            <h2>에너지관리산업기사 교재 복원 13회차</h2>
          </div>
          <p>
            회차별 문제에서 에너지관리산업기사를 고르면 2021~2025년 복원문제 1,040개를 추가로 풀 수 있습니다.
            문제·보기를 교재 이미지로 표시하고 정답표와 원문 해설을 연결했습니다.
          </p>
        </header>
        <p>
          설정 → 답안 선택 방식 → 이미지 직접 선택에서 보기 번호와 내용을 누릅니다. 체크 마커·영역 강조,
          다크·라이트·원본 표시를 비교하세요. 해설이 없는3문항은 보충 설명으로 구분합니다. 기존 기출과
          중간고사 기록은 유지하며 기사 추가자료는 산업기사 목록에서 제외했습니다.
        </p>
        <button
          type="button"
          onClick={() => {
            openQualificationRounds('energy');
          }}
        >
          에너지 회차별 문제 열기 →
        </button>
      </section>
      <section className="feature-layout-lab settings-feature-guide">
        <header>
          <div>
            <span>기록 보호·해설 출처</span>
            <h2>서버 저장 단계와 다른 풀이 복구</h2>
          </div>
          <p>
            설정 → 기기 간 학습 기록 동기화에서 읽기·비교·저장·반영 단계와 최근 동기화 시각을 확인합니다. 서로
            다른 풀이 사본은 이 브라우저에 최근 100건까지 보관하며 필요한 풀이만 골라 복구할 수 있습니다.
          </p>
        </header>
        <p>
          해설 아래 출처 표시를 펼치면 COMCBT 이용자 해설, 기존 문항 연결, 학습용 작성·AI 보강 여부를
          확인합니다. 출처 표시는 사실 검증 완료를 뜻하지 않습니다.
        </p>
        <button
          type="button"
          onClick={() => {
            openView('settings');
          }}
        >
          동기화 설정 열기 →
        </button>
      </section>
      <section className="feature-layout-lab settings-feature-guide">
        <header>
          <div>
            <span>기존 설정 복원</span>
            <h2>설명과 선택지를 한눈에 비교하기</h2>
          </div>
          <p>
            기존 설정의 아이콘·이름·설명을 복원했습니다. 작은 설정창과 전체 설정에서 같은 항목을 순서대로 볼
            수 있습니다.
          </p>
        </header>
        <p>
          전체 설정의 목차는 항목을 숨기지 않고 해당 위치로 이동합니다. 검색은 필요한 항목을 찾을 때만
          사용하세요.
        </p>
        <button
          type="button"
          onClick={() => {
            openView('settings');
          }}
        >
          전체 설정 둘러보기 →
        </button>
      </section>
      <section className="feature-layout-lab">
        <header>
          <div>
            <span>LATEST EXPERIENCE · v{currentVersion}</span>
            <h2>시험 직전 공조 도구</h2>
          </div>
          <p>
            이번 버전의 쉬운 계산 암기장, 즐겨찾기 문제 모아보기와 COMCBT 제출 동선을 바로 체험할 수 있습니다.
          </p>
        </header>
        <div>
          <button
            type="button"
            onClick={() => {
              openView('guide');
            }}
          >
            <b>SI</b>
            <strong>초등 계산 암기장</strong>
            <span>열량 · COP · 냉각수 · 송풍기 공식</span>
          </button>
          <button
            type="button"
            onClick={() => {
              m.searchBookmarksOnly = true;
              openView('search');
            }}
          >
            <b>★</b>
            <strong>즐겨찾기만 보기</strong>
            <span>검색어 없이 저장한 문제만 모아보기</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSolveLayoutMode('comcbt');
            }}
            className={normalizeClass([{ active: solveLayoutMode === 'comcbt' }])}
          >
            <b>COM</b>
            <strong>제출 버튼 체험</strong>
            <span>학습 결과 · 시험 제출을 하단에서 바로</span>
          </button>
        </div>
        <footer>
          <strong>문제 해설 보강</strong>
          <span>
            쉬운 핵심 해설을 먼저 읽고, 동일 문항으로 확인된 다른 해설은 아래에서 함께 볼 수 있습니다.
          </span>
        </footer>
      </section>
      {!isJewelry ? (
        <section className="feature-practical-lab">
          <header>
            <div>
              <span>NEW SUBJECT · v5.3</span>
              <h2>설비보전기사 기출 추가</h2>
            </div>
            <p>
              종목 선택에서 설비보전기사를 고르면 2006~2022년27회차·2,660문제를 학습·시험·랜덤으로 풀 수
              있습니다. 산업기사와 별도 기록이며, 그림265장은 원본을 보존하고2배 개선했습니다.
              다크·라이트·원본 표시도 기존 설정을 따릅니다. 상세 해설 미등록 문항과2025년 개편 체계의 차이는
              별도로 안내합니다.
            </p>
          </header>
          <header>
            <div>
              <span>STUDY FLOW</span>
              <h2>필답형과 계산 공부를 더 편하게</h2>
            </div>
            <p>
              공식부터 읽거나 문제 목록으로 바로 이동하세요. 계산식은 분수선으로 보고 분자·분모와 숫자 대입을
              함께 익힙니다. PDF도 같은 수식입니다. 계산 목록은40개씩 끝까지 둘러보고, 검색·오답·계산 목록의
              이미지 문제는 원문으로 미리 봅니다.
            </p>
          </header>
          <details className="feature-history">
            <summary>이전 필답형 화면 개선 기록 보기</summary>
            <p>
              v5.1 모바일 뒤로가기·그림 확대: 닫힌 모바일 메뉴가 PC용 복귀 모션으로 화면을 덮지 않게 했습니다.
              본문과 PC 모션은 유지합니다. 그림 확대창은 여유 있게 줄였고 배율을 바꾸면 고정된 창 안에서
              그림만 커집니다. 그림을 다시 클릭하면 닫힙니다.
            </p>
            <p>
              v5.9.9 필답형 전용 풀이: 회차·자료를 열면 사이트 메뉴와 상·하단 탐색을 숨기고 목록
              복귀·계산기·설정만 남깁니다. 그림 확대창은 화면 대부분을 쓰고 화면 너비 맞춤부터400%까지
              확대합니다. 모바일 메뉴는 전환 영역 밖에서 새로 표시해 모션·흐림 효과의 충돌을 줄입니다. 문제
              아래 풀이·표시 개수 저장과 기존 답안·필기 데이터는 유지합니다.
            </p>
            <p>
              v5.1.5 먼저 외울 한 줄 공식: CGT·CR·COP·BF·상사법칙과 보충5개 공식을 이름으로 모았습니다. 언제
              쓰는지·기호 뜻·암기법을 펼쳐 보세요. PDF는 SI 다음에 공식 요약2쪽을 넣은29쪽 합본이며
              기존36문제의 숫자·함정·조건 설명과 우선13문제 선택을 유지합니다.
            </p>
            <p>
              v5.1.1 복원 비율 실전: 문제별 ‘정답·풀이 보기’로 제출 전에도 답안과 설명을 확인합니다. 미리 본
              문제는 표시하고 이어풀기에도 유지합니다. 시간은 계속 진행하며 자가채점은 제출 후 열립니다.
            </p>
            <p>
              v5.9.6 필답형 답안 보강: 명칭·특징·목적·원리를 함께 묻는 공개 자료의 핵심 답안을 보강하고, 답안
              확인 후 이해용 설명을 기본으로 펼칩니다. 문제 아래 ‘이상 신고’에서 답안 누락·그림 잘림 등을 알릴
              수 있으며 PDF·스캔 그림10개를 원본에서 복구했습니다. 원본 자체의 잘림은 별도 확인이 필요합니다.
            </p>
            <p>
              v5.9.5 비슷한 문제끼리: 회차별 문제 → 냉동공학 중간고사의 ‘문제 배치’에서 같은 목차·주제끼리
              모으거나 기존 순서를 선택하세요. 랜덤은 ‘뽑힌 문제를 비슷한 내용끼리 배치’를 켜면 무작위 선택 후
              순서만 묶습니다. 기존 이어풀기·다시 풀기와 기록은 유지됩니다.
            </p>
            <p>
              v5.9.4 교재 본문 확인 문제: 회차별 문제 → 냉동공학 중간고사에서 ‘교재 본문에서 연결 확인된
              문제만 풀기’를 켜거나 끌 수 있습니다. 확인된 일반316문제·안전24문제와 추가 확인 대장을 제공하며,
              기존 원문·오답·이어풀기 기록을 보존합니다. 교재 전체 수록 완료는 아닙니다.
            </p>
            <p>
              v5.9.3 로딩 최적화: 문제와 해설은 기존 원본 이미지로 표시합니다. 시험 자료실·필답형 자료는
              필요할 때 불러오며, 진행 중인 필답형 풀이와 저장 답안을 유지합니다. PC 읽기 폭 제한·보이는 카드
              중심 모션·테마 아이콘 최적화는 유지합니다.
            </p>
          </details>
          <header>
            <div>
              <span>LATEST EXPERIENCE · v{currentVersion}</span>
              <h2>필답 계산 · 온도차와 절대온도</h2>
            </div>
            <p>
              필답 계산 풀이에서 ‘온도차와 절대온도 구별’을 확인하세요. 비열의 kJ/(kg·K)는 온도차1 K당 열이며,
              31℃-28℃=3 K입니다. 두 온도를 켈빈으로 바꿔 빼도 같은3 K이고, 온도차 자체에273.15를 더하지
              않습니다. 카르노 온도비·이상기체식의 온도 자체와 구별하며, 간단·상세 PDF도 같은 안내로
              보강했습니다. 기존 문제 검색·복원 비율 실전·답안 저장은 유지합니다.
            </p>
          </header>
          <div>
            <article>
              <b>01</b>
              <strong>익숙한 CBT 풀이 흐름</strong>
              <span>하단 이전·답안 확인·다음, 문제 번호·미작성 이동</span>
            </article>
            <article>
              <b>02</b>
              <strong>최대12문제씩 보기</strong>
              <span>1·2·4·6·8·10·12개와 이어보기 · 표시 개수 저장</span>
            </article>
            <article>
              <b>03</b>
              <strong>핵심 답안과 이해용 풀이</strong>
              <span>풀이를 열면 설명도 펼침 · 채점 핵심어와 힌트는 선택 확인</span>
            </article>
            <article>
              <b>04</b>
              <strong>문제 아래 바로 풀이</strong>
              <span>정답·설명은 같은 카드 아래에 · 직접 입력은 선택 펼침</span>
            </article>
            <article>
              <b>05</b>
              <strong>단위 환산 비교</strong>
              <span>부분점수표에서 1 kW와 1000 W처럼 같은 물리량 비교 · 요구 단위는 직접 확인</span>
            </article>
          </div>
          <details className="feature-history">
            <summary>이전 자료 추가·분류 기록 보기 (당시 기준)</summary>
            <p>
              아래 문항 수와 기본값은 해당 업데이트 당시 기록입니다. 현재 선택 화면의 수량·설정이 우선합니다.
            </p>
            <p>
              v5.2 필답 화면: 회차별 기출·추가 자료·복습을 먼저 고르고, 연도별 회차에서 작성 진도와 이어풀기를
              확인합니다. 풀이에 들어가면 문제와 답안 중심 화면으로 전환되고 회차·자료 목록으로 바로
              돌아갑니다.
            </p>
            <p>
              v5.9.1 에너지 출처 선택: ‘에너지 교재 문제’는 교재 원문140문제, ‘CBT + 에너지 교재’는 이전 CBT
              목록154문제를 기존 방식으로 풉니다. 교재 이미지191장의 보기에도 직접 선택 영역을 연결했습니다.
              설정 → 답안 선택 방식에서 이미지 직접 선택을 켜고 체크 마커 또는 영역 색상 박스를 비교하세요.
              원문 해설·다크·라이트 표시와 기존 풀이 기록은 유지됩니다.
            </p>
            <p>
              v5.8.3 냉동공학 중간고사: 교재의 장·세부 목차로 일반1108문제를 정리하고,
              안전관리·보호장치·누설검사56문제는 별도 선택합니다. ‘전체·랜덤’에서 계산5개 포함을 켜면
              계산5개와 나머지 이론을 뽑습니다. 부족하면 범위를 바꾸도록 안내하며 기존 랜덤과 이어풀기 기록은
              유지합니다.
            </p>
            <p>
              v5.8.4 에너지 원문73문제: 설정 → 답안 배치 → 이미지 직접 선택으로①②③④와 보기 내용을 눌러
              답합니다. 여러 줄 보기·분수도 한 박스로 표시하고, 체크 마커 또는 영역 색상을 고를 수 있습니다.
              기존 답안 버튼 설정·179문제·풀이 기록은 유지합니다.
            </p>
            <p>
              v5.8.5 중간고사: 에너지의 같은 질문·정답은 최신 회차로 정리해154문제를 출제하며 계산 수치·정답이
              다른 변형은 유지합니다. 기본 계산 체크는2번·6번, ‘계산 문제만 보기’에서는22개 전체 원문을
              확인합니다. 냉동도 같은 문장·정답은 최신 회차로 묶고 ‘나왔던 회차’를 표시합니다. 기존 기록과
              일반 기출은 보존합니다.
            </p>
            <p>
              v5.8.6 에너지 계산 기본값 정정: 6번 상당증발량·11번 스케줄번호만 기본On입니다. 랜덤20은 각1개를
              계산으로 뽑고 전체·주제별 새 풀이에도 적용합니다. ‘기본6번·11번’으로 언제든 복원하며 개별 선택과
              이어풀기 기록은 유지합니다.
            </p>
            <p>
              v5.4 중간고사: 전용 오답 기록, 연도·회차별 학습과 6개 소과목 필터를 제공합니다. 소과목은 자동
              참고 분류이고 미확인 문제도 전체에 포함합니다. 랜덤은 이미 나온 문제를 제외하며 풀이 기록에서
              이전 묶음의 답안·위치를 이어 풉니다.
            </p>
            <p>
              v5.4.5: 교재 목차에서 냉동이론 → 냉매와 브라인처럼 세부 범위를 골라 학습·CBT·오답·이어풀기를
              선택합니다. 전체·랜덤도 세부 목차로 고르며 반복 소과목 표시는 제거했습니다. 애매한 문항은 세부
              분류 미확인에 남기고 기존 답안·점수는 유지합니다.
            </p>
            <p>
              v5.6: 2018~2020년 공개 원문의 사진90개와15개 회로·평면도 선택 답안 설명을 보강했습니다. 정답이
              인쇄된2개 사진은 답안에만 표시하며, 공개 원문192문항은 문제 아래 ‘원문 동작 영상 보기’로 해당
              장면을 열 수 있습니다. 2023년1회2번의 다른 보기 그림은 원문 동작에 맞춰 제어부를 재작성했습니다.
              책95개 대응·기존 기록·원본은 유지하며, 전체312문항의 정답 검증 완료를 뜻하지 않습니다.
            </p>
            <p>
              v5.1.5 자료 보관함: 회차가 있는 기출312문제는 연도·회차로 바로 고르고, 따로 받은 공개
              자료47·필답문제2 PDF42·사진·기기 PDF123은 추가 자료 모음에서 서로 섞지 않고 선택합니다.
            </p>
            <p>
              v5.1.4 이미지 보완: 2026년 1·2회 24문항은 영상 캡처를 새 해설 PDF의 문제18·답안7 그림으로 완전
              교체했습니다. 회로·타임차트·계통도를 잘림 없이 다시 분리했고, 2회11번 원문과 표시등·스크롤
              압축기 풀이도 보강했습니다. 문제 ID와 학습 기록은 그대로 유지됩니다.
            </p>
            <p>
              새 필답문제2 42문항도 추가했습니다. 훈련관의 자료·범위에서 추가 자료42를 선택하면 이 자료만 풀이
              확인·직접 입력·암기로 풀 수 있습니다. 그림2개와 답안 보완 근거를 함께 제공하며 기존407문제와
              기록은 유지합니다.
            </p>
            <p>
              9월17일 제공된 가지1 123문항은 사진·기기 자료123에서 따로 풀 수 있습니다. 원본 사진95개와 학습
              답안·설명을 연결했으며 정답 표기가 있는 비교 사진2개는 문제용과 답안용을 분리했습니다.
            </p>
            <p>
              복원 자료 구분: 필답형 상단에서 전체 기간 / 2023년 2회 이후 / 2023년 1회 이전을 선택합니다. 회차
              목록과 랜덤 실전에도 같은 범위를 적용합니다. 원본 영상 보유 시점을 기준으로 한 구분이며 전체
              수정 완료 표시는 아닙니다.
            </p>
            <p>
              2023년 2회1번의 주회로·제어회로 전체와 3회1번의 우측 PB2/X2 회로도 원본 영상으로 보완했습니다.
              기존 잘린 이미지는 삭제하지 않았습니다.
            </p>
          </details>
          <footer>
            <strong>기기 간 이어하기</strong>
            <span>
              입력 답안, 채점표, 실수 원인과 최근 답안 이력을 로그인한 PC·태블릿·휴대폰에서 합칩니다.
            </span>
            <button type="button" onClick={openHvacPracticalGuide}>
              필답형 훈련관 열기 →
            </button>
          </footer>
        </section>
      ) : null}
      <section className="feature-theme-preview">
        <div>
          <span>LATEST EXPERIENCE · v{currentVersion}</span>
          <h2>테마와 동적 UI를 직접 바꿔보세요</h2>
          <p>
            동적 UI는 기본으로 켜지며 화면이 움직이고 카드 배치가 달라집니다. 끄면 v2.4.2 방식의 기존 배치로
            돌아가고, 심슨 테마는 학습 기록을 건드리지 않은 채 유지됩니다.
          </p>
          <div>
            <button
              type="button"
              onClick={() => {
                m.settingsOpen = true;
              }}
            >
              ⚙ 테마 설정 열기
            </button>
            <button
              type="button"
              onClick={() => {
                setDynamicUiEnabled(true);
              }}
              className={normalizeClass([{ active: dynamicUiEnabled }])}
            >
              동적 UI ON
            </button>
            <button
              type="button"
              onClick={() => {
                setDynamicUiEnabled(false);
              }}
              className={normalizeClass([{ active: !dynamicUiEnabled }])}
            >
              기존 UI로
            </button>
          </div>
        </div>
        <figure>
          <img
            {...imageAttrs(simpsonsThemeImage, 'auto, (max-width: 820px) 80vw, 640px')}
            onError={restoreOriginalImage}
            src={problemImage(simpsonsThemeImage)}
            alt="호머 심슨이 바트 심슨의 목을 조르는 장면"
            loading="lazy"
            decoding="async"
          />
        </figure>
      </section>
      <section className="feature-layout-lab">
        <header>
          <div>
            <span>LATEST EXPERIENCE · v{currentVersion}</span>
            <h2>세 가지 문제풀이 화면</h2>
          </div>
          <p>선택한 화면은 다음 학습과 CBT부터 적용되며 풀이 중 설정에서도 바로 바꿀 수 있습니다.</p>
        </header>
        <div>
          <button
            type="button"
            onClick={() => {
              setSolveLayoutMode('standard');
            }}
            className={normalizeClass([{ active: solveLayoutMode === 'standard' }])}
          >
            <b>CBT</b>
            <strong>기본 CBT</strong>
            <span>기존 v2.7 카드형 · 기본값</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSolveLayoutMode('comcbt');
            }}
            className={normalizeClass([{ active: solveLayoutMode === 'comcbt' }])}
          >
            <b>COM</b>
            <strong>COMCBT 모드</strong>
            <span>고밀도 2열 · 고정 OMR · 빠른 이동</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSolveLayoutMode('combat');
            }}
            className={normalizeClass(['combat', { active: solveLayoutMode === 'combat' }])}
          >
            <b>⚡</b>
            <strong>컴뱃 CBT</strong>
            <span>진행 HUD · 4문제 연속 · 미션형 화면</span>
          </button>
        </div>
        <footer>
          <strong>COMCBT 전용 키보드</strong>
          <span>1~4 답 선택 · ←/→ 이동 · K 킵 · B 북마크 · E 해설</span>
        </footer>
      </section>
      <section className="feature-upscale-compare">
        <header>
          <div>
            <span>LATEST EXPERIENCE · v{currentVersion}</span>
            <h2>원본과 업스케일링 후를 직접 비교하세요</h2>
          </div>
          <p>Real-ESRGAN 4배 처리 후 2배 bicubic 축소 · Mac M4 Pro · 256px 타일</p>
        </header>
        <div className="upscale-compare-grid">
          <button
            type="button"
            aria-label={`${upscaleComparison.subject} 원본 크게 보기`}
            onClick={() => {
              m.upscalePreviewKind = 'original';
            }}
            className="upscale-compare-card original"
          >
            <div>
              <span>BEFORE</span>
              <strong>원본</strong>
              <small>{upscaleComparison.originalSize}</small>
            </div>
            <figure>
              <img
                src={problemImage(upscaleComparison.original)}
                alt={`${upscaleComparison.subject} 업스케일링 전 원본`}
              />
            </figure>
            <b>눌러서 크게 보기 ⌕</b>
          </button>
          <button
            type="button"
            aria-label={`${upscaleComparison.subject} 업스케일링 후 크게 보기`}
            onClick={() => {
              m.upscalePreviewKind = 'improved';
            }}
            className="upscale-compare-card improved"
          >
            <div>
              <span>AFTER</span>
              <strong>업스케일링 후</strong>
              <small>{upscaleComparison.improvedSize}</small>
            </div>
            <figure>
              <img
                src={problemImage(upscaleComparison.improved)}
                alt={`${upscaleComparison.subject} 업스케일링 후`}
              />
            </figure>
            <b>눌러서 크게 보기 ⌕</b>
          </button>
        </div>
        <footer>
          <strong>{upscaleComparison.subject}</strong>
          <span>
            {upscaleComparison.count}에 같은 처리 기준을 적용했으며, 기존 원본 파일은 그대로 보존했습니다.
          </span>
        </footer>
      </section>
      {!isJewelry ? (
        <section className="feature-restored-dark">
          <header>
            <div>
              <span>LATEST EXPERIENCE · v{currentVersion}</span>
              <h2>복원문제 다크 이미지를 눈으로 비교하세요</h2>
            </div>
            <p>원본 파일과 답안 좌표는 바꾸지 않고 화면 색상만 전환합니다.</p>
          </header>
          <div className="restored-dark-preview-grid">
            <button
              type="button"
              onClick={() => {
                setRestoredImageTheme('original');
              }}
              className={normalizeClass([
                'restored-dark-preview original',
                { active: restoredImageTheme === 'original' },
              ])}
            >
              <figure>
                <img
                  src={problemImage(restoredDarkPreviewImage)}
                  alt="원본 흰색 복원문제 수식 예시"
                  loading="lazy"
                  decoding="async"
                />
              </figure>
              <strong>항상 원본</strong>
              <small>흰 문제지 그대로</small>
            </button>
            <button
              type="button"
              onClick={() => {
                setRestoredImageTheme('auto');
              }}
              className={normalizeClass([
                'restored-dark-preview comfort',
                { active: restoredImageTheme === 'auto' },
              ])}
            >
              <figure>
                <img
                  src={problemImage(restoredDarkPreviewImage)}
                  alt="눈부심을 줄인 남색 복원문제 수식 예시"
                  loading="lazy"
                  decoding="async"
                />
              </figure>
              <strong>눈부심 완화</strong>
              <small>추천 · 짙은 남색</small>
            </button>
          </div>
          <footer>
            <strong>설정 위치</strong>
            <span>
              화면·데이터 설정과 풀이 중 설정에서 언제든 바꿀 수 있습니다. 선택한 방식은 다크 모드에서
              적용됩니다.
            </span>
          </footer>
        </section>
      ) : null}
      <>
        {' '}
        {createPortal(
          <>
            {upscalePreview ? (
              <div
                role="dialog"
                aria-modal="true"
                aria-label={`${upscalePreview.title} 확대`}
                onClick={() => {
                  m.upscalePreviewKind = null;
                }}
                className="question-image-lightbox"
              >
                <header
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  <strong>{upscalePreview.title}</strong>
                  <span>
                    {upscalePreview.size}
                    {' · 문제 풀이 화면과 같은 크게 보기'}
                  </span>
                  <button
                    type="button"
                    aria-label="확대 이미지 닫기"
                    onClick={() => {
                      m.upscalePreviewKind = null;
                    }}
                  >
                    ×
                  </button>
                </header>
                <div
                  onClick={(event) => {
                    if (event.target !== event.currentTarget) return;
                    m.upscalePreviewKind = null;
                  }}
                >
                  <img src={problemImage(upscalePreview.src)} alt={`${upscalePreview.title} 확대`} />
                </div>
              </div>
            ) : null}
          </>,
          document.body,
        )}{' '}
      </>
      <section className="feature-tour">
        <header>
          <div>
            <span>3-MINUTE TOUR</span>
            <h2>이번에 정식 적용된 기능 네 가지</h2>
          </div>
          <p>베타 전환 없이 실제 문제풀이에서 바로 사용할 수 있습니다.</p>
        </header>
        <div className="feature-tour-grid">
          <article className="feature-tour-card blue">
            <b>01</b>
            <span>PADDLE OCR</span>
            <h3>여러 줄 보기도 한 박스로 선택</h3>
            <p>두 줄·세 줄 답안의 전체 글자를 하나의 정확한 박스로 묶어 누릅니다.</p>
            <button
              type="button"
              onClick={() => {
                setAnswerLayout('hotspot');
                setHotspotIndicator('area');
              }}
            >
              이미지 답안 강조 켜기 →
            </button>
          </article>
          <article className="feature-tour-card violet">
            <b>02</b>
            <span>IN-SESSION SETTINGS</span>
            <h3>풀이 중에도 설정</h3>
            <p>답안과 타이머를 유지하면서 테마·글씨·답안 배치·OMR을 바로 바꿉니다.</p>
            <button
              type="button"
              onClick={() => {
                startFeatureRound('learn');
              }}
            >
              학습 화면에서 체험 →
            </button>
          </article>
          <article className="feature-tour-card mint">
            <b>03</b>
            <span>SMART OMR</span>
            <h3>현재 문제 자동 따라가기</h3>
            <p>CBT에서 다음 문제로 이동하면 OMR도 필요한 때만 부드럽게 따라옵니다.</p>
            <button
              type="button"
              onClick={() => {
                startFeatureRound('exam');
              }}
            >
              실전 CBT에서 체험 →
            </button>
          </article>
          {!isJewelry ? (
            <article className="feature-tour-card midnight">
              <b>04</b>
              <span>RESTORED IMAGE DARK</span>
              <h3>복원문제까지 편안한 다크</h3>
              <p>원본 이미지와 답안 좌표는 보존하고 눈부심 완화·원본 중 원하는 표시를 고릅니다.</p>
              <button
                type="button"
                onClick={() => {
                  m.theme = 'dark';
                  applyTheme(theme);
                  setRestoredImageTheme('auto');
                }}
              >
                눈부심 완화 체험 →
              </button>
            </article>
          ) : null}
        </div>
      </section>
      <section className="feature-action-section">
        <header>
          <div>
            <span>QUICK EXPERIENCE</span>
            <h2>한 번 눌러 바로 체감하기</h2>
          </div>
        </header>
        <div className="feature-action-grid">
          <button
            type="button"
            onClick={() => {
              m.settingsOpen = true;
            }}
            className="feature-action-card simpsons"
          >
            <span>⚙</span>
            <div>
              <strong>테마 설정 열기</strong>
              <small>{isJewelry ? '기본·심슨·선재 UI 선택' : '기본·심슨 UI 선택'}</small>
            </div>
            <b>›</b>
          </button>
          <button
            type="button"
            onClick={() => {
              setDynamicUiEnabled(!dynamicUiEnabled);
            }}
            className="feature-action-card motion"
          >
            <span>{dynamicUiEnabled ? 'ON' : 'OFF'}</span>
            <div>
              <strong>{dynamicUiEnabled ? '기존 UI로 돌아가기' : '동적 UI 켜기'}</strong>
              <small>새 배치와 모션 한 번에 전환</small>
            </div>
            <b>›</b>
          </button>
          <button
            type="button"
            onClick={() => {
              setAnswerLayout('hotspot');
            }}
            className="feature-action-card exam"
          >
            <span>☝</span>
            <div>
              <strong>
                {answerLayout === 'hotspot' ? '이미지 직접 선택 사용 중' : '이미지에서 답 고르기'}
              </strong>
              <small>원문 속 ①·②·③·④를 바로 선택</small>
            </div>
            <b>›</b>
          </button>
          <button
            type="button"
            onClick={() => {
              setAnswerLayout('hotspot');
              setHotspotIndicator('area');
            }}
            className="feature-action-card coach"
          >
            <span>▰</span>
            <div>
              <strong>PaddleOCR 답안 박스</strong>
              <small>여러 줄 답안도 한 박스로 선택</small>
            </div>
            <b>›</b>
          </button>
          <button type="button" onClick={toggleLightDark} className="feature-action-card sun">
            <span>{darkActive ? '☀' : '☾'}</span>
            <div>
              <strong>{darkActive ? '라이트 모드로' : '다크 모드로'}</strong>
              <small>전체 테마 즉시 전환</small>
            </div>
            <b>›</b>
          </button>
          {!isJewelry ? (
            <button
              type="button"
              onClick={() => {
                m.settingsOpen = true;
              }}
              className="feature-action-card midnight"
            >
              <span>◐</span>
              <div>
                <strong>복원 이미지 다크 설정</strong>
                <small>눈부심 완화·원본 중 선택</small>
              </div>
              <b>›</b>
            </button>
          ) : null}
          <button type="button" onClick={openCalculator} className="feature-action-card calc">
            <span>▦</span>
            <div>
              <strong>공학용 계산기</strong>
              <small>별도 팝업으로 실행</small>
            </div>
            <b>›</b>
          </button>
          <button
            type="button"
            onClick={() => {
              openView('coach');
            }}
            className="feature-action-card coach"
          >
            <span>✦</span>
            <div>
              <strong>합격 엔진</strong>
              <small>예상 점수와 취약 과목</small>
            </div>
            <b>›</b>
          </button>
          <button
            type="button"
            onClick={() => {
              startFeatureRound('exam');
            }}
            className="feature-action-card exam"
          >
            <span>OMR</span>
            <div>
              <strong>실전 CBT</strong>
              <small>최신 회차 시험 화면</small>
            </div>
            <b>›</b>
          </button>
        </div>
      </section>
      <section className="feature-plugin-guide">
        <header>
          <div>
            <span>PLUGIN GUIDE · v{currentVersion}</span>
            <h2>이번 플러그인이 바꾼 기능</h2>
          </div>
          <p>
            이름만 나열하지 않고 실제로 어디에 쓰였는지 펼쳐서 확인할 수 있습니다. 무거운 도구는 해당 기능을
            열 때만 내려받습니다.
          </p>
        </header>
        <div className="feature-plugin-grid">
          {pluginExperiences.map((plugin) => (
            <details key={plugin.name}>
              <summary>
                <span>{plugin.area}</span>
                <strong>{plugin.name}</strong>
                <b>{plugin.loading}</b>
              </summary>
              <p>{plugin.role}</p>
              <small>
                <b>바뀐 점</b>
                {plugin.change}
              </small>
            </details>
          ))}
        </div>
        <footer>
          <strong>안전장치</strong>
          <span>
            {'선택 기능에서 오류가 나면 해당 카드만 멈추고 기존 CBT는 유지합니다. 주소에 '}
            <code>?safe=1</code>을 붙이면 UI 실험 기능만 임시로 끌 수 있습니다.
          </span>
        </footer>
      </section>
      <section className="feature-latest">
        <header>
          <div>
            <span>LATEST CHANGES</span>
            <h2>
              v{patchEntries[0]?.version}
              {' 핵심 변경점'}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              openView('updates');
            }}
          >
            전체 패치노트 →
          </button>
        </header>
        <ul>
          {(patchEntries[0]?.changes || []).map((change) => (
            <li key={change}>{change}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
