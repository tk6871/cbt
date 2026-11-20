import {GlassScene} from '../GlassScene';
import {lazy, type ReactNode} from 'react';
import {GlassPicker} from '../GlassPicker';
import {OptionalTool} from '../OptionalTool';
import {settingsHelp,type SettingsValues,type SettingsContext,type SettingsAction,type SettingChange} from '../../cbt/settingsCatalog';
const ThemeStudio = lazy(() => import('./ThemeStudio'));
export function renderSettingsContent(m: ReturnType<typeof settingsModel>) {
  const {
    context,
    displayPreference,
    setDisplayPreference,
    matches,
    dynamicUiEnabled,
    setDynamicUiEnabled,
    experimentalFeaturesEnabled,
    setExperimentalFeatures,
    emit,
    questionJudgmentEnabled,
    setQuestionJudgmentEnabled,
    solveLayoutMode,
    setSolveLayoutMode,
    isJewelry,
    visualStyle,
    setVisualStyle,
    sunjaeRotationLabel,
    sunjaeRotationSeconds,
    setSunjaeRotationSeconds,
    theme,
    change,
    fontScale,
    setFontScale,
    fontFamilyPreference,
    setFontFamilyPreference,
    restoredImageTheme,
    setRestoredImageTheme,
    settingsHelp,
    explanationDisplay,
    answerLayout,
    setAnswerLayout,
    hotspotIndicator,
    setHotspotIndicator,
  } = m;
  return (
    <>
      {matches('glass') && <section className="setting-group glass-setting" data-setting="glass">
        <span>리퀴드 글라스</span><GlassScene/><GlassPicker/>
      </section>}
      <section
        className="setting-group"
        data-setting="mobileModel"
        style={{ display: matches('mobileModel') ? undefined : 'none' }}
      >
        <span>모바일 3D 해설</span>
        <p>휴대폰에서는 기본으로 꺼집니다. 허용하면 관련 문제의 해설에서 눌러 모형을 열 수 있습니다.</p>
        <div>
          <button
            type="button"
            aria-pressed={!m.values.mobileModel}
            className={!m.values.mobileModel ? 'active' : ''}
            onClick={() => change('mobileModel', false)}
          >
            꺼짐
          </button>
          <button
            type="button"
            aria-pressed={m.values.mobileModel}
            className={m.values.mobileModel ? 'active' : ''}
            onClick={() => change('mobileModel', true)}
          >
            눌러서 3D 보기 허용
          </button>
        </div>
      </section>
      <section
        data-setting="display"
        style={{ display: matches('display') ? undefined : 'none' }}
        className="setting-group display-mode-setting"
      >
        <span>기기 화면 모드</span>
        <p className="setting-description">
          자동은 휴대폰·태블릿에서 경량 화면을 사용합니다. 모드를 바꾸면 현재 기록을 저장한 뒤 화면만 다시
          엽니다.
        </p>
        <div className="display-mode-options">
          <button
            aria-pressed={displayPreference === 'auto'}
            onClick={() => {
              setDisplayPreference('auto');
            }}
            className={displayPreference === 'auto' ? 'active' : ''}
          >
            <strong>자동</strong>
            <span>{'현재 ' + context.displayLabel}</span>
            <small>기기 자동 인식</small>
          </button>
          <button
            aria-pressed={displayPreference === 'mobile'}
            onClick={() => {
              setDisplayPreference('mobile');
            }}
            className={displayPreference === 'mobile' ? 'active' : ''}
          >
            <strong>모바일</strong>
            <span>모바일·태블릿</span>
            <small>경량 화면 고정</small>
          </button>
          <button
            aria-pressed={displayPreference === 'desktop'}
            onClick={() => {
              setDisplayPreference('desktop');
            }}
            className={displayPreference === 'desktop' ? 'active' : ''}
          >
            <strong>PC</strong>
            <span>데스크톱 화면</span>
            <small>PC 배치 고정</small>
          </button>
        </div>
      </section>
      <section
        data-setting="dynamic"
        style={{ display: matches('dynamic') ? undefined : 'none' }}
        className="setting-group"
      >
        <span>동적 UI</span>
        <p className="setting-description">
          켜면 새 배치와 자연스러운 화면 전환을 사용합니다. 끄면 v2.4.2 방식의 기존 배치와 즉시 전환으로
          돌아갑니다.
        </p>
        <div className="dynamic-ui-options">
          <button
            aria-pressed={dynamicUiEnabled}
            onClick={() => {
              setDynamicUiEnabled(true);
            }}
            className={dynamicUiEnabled ? 'active' : ''}
          >
            <strong>ON</strong>
            <span>새 동적 UI</span>
            <small>기본 설정</small>
          </button>
          <button
            aria-pressed={!dynamicUiEnabled}
            onClick={() => {
              setDynamicUiEnabled(false);
            }}
            className={!dynamicUiEnabled ? 'active' : ''}
          >
            <strong>OFF</strong>
            <span>기존 UI</span>
            <small>v2.4.2 호환</small>
          </button>
        </div>
      </section>
      <section
        data-setting="experimental"
        style={{ display: matches('experimental') ? undefined : 'none' }}
        className="setting-group experimental-setting"
      >
        <span>실험 기능 전체</span>
        <p className="setting-description">
          확신도·실수 원인·문제 메모·시험 속도 예측을 한 번에 켜고 끕니다. OFF하면 기존 v3.5.4 문제 화면과
          바로 비교할 수 있고 저장한 기록은 지우지 않습니다.
        </p>
        <div className="dynamic-ui-options experimental-options">
          <button
            aria-pressed={experimentalFeaturesEnabled}
            onClick={() => {
              setExperimentalFeatures(true);
            }}
            className={experimentalFeaturesEnabled ? 'active' : ''}
          >
            <strong>β ON</strong>
            <span>베타 기능 사용</span>
            <small>현재 적용</small>
          </button>
          <button
            aria-pressed={!experimentalFeaturesEnabled}
            onClick={() => {
              setExperimentalFeatures(false);
            }}
            className={!experimentalFeaturesEnabled ? 'active' : ''}
          >
            <strong>OFF</strong>
            <span>기존 화면</span>
            <small>v3.5.4 비교</small>
          </button>
        </div>
        {experimentalFeaturesEnabled && !context.session ? (
          <button
            type="button"
            onClick={() => {
              emit('action', 'beta');
            }}
            className="experimental-open-button"
          >
            베타 학습 도구 열기 →
          </button>
        ) : null}
      </section>
      <section
        data-setting="judgment"
        style={{ display: matches('judgment') ? undefined : 'none' }}
        className="setting-group experimental-setting"
      >
        <span>내 판단·메모</span>
        <p className="setting-description">
          문제 아래의 확신도·실수 원인·내 메모만 따로 표시합니다. OFF해도 기존 기록은 삭제하지 않습니다.
        </p>
        <div className="dynamic-ui-options experimental-options">
          <button
            aria-pressed={questionJudgmentEnabled}
            onClick={() => {
              setQuestionJudgmentEnabled(true);
            }}
            className={questionJudgmentEnabled ? 'active' : ''}
          >
            <strong>ON</strong>
            <span>판단·메모 표시</span>
            <small>문제 아래 열기</small>
          </button>
          <button
            aria-pressed={!questionJudgmentEnabled}
            onClick={() => {
              setQuestionJudgmentEnabled(false);
            }}
            className={!questionJudgmentEnabled ? 'active' : ''}
          >
            <strong>OFF</strong>
            <span>숨기기</span>
            <small>기본값</small>
          </button>
        </div>
      </section>
      {matches('studio') ? (
        <OptionalTool title="UI·테마 실험실"><ThemeStudio onStartTour={() => emit('action', 'tour')} /></OptionalTool>
      ) : null}
      <section
        data-setting="solveLayout"
        style={{ display: matches('solveLayout') ? undefined : 'none' }}
        className="setting-group solve-layout-setting"
      >
        <span>문제풀이 화면</span>
        <p className="setting-description">
          세 화면을 언제든 바꿀 수 있습니다. 답안·진도·타이머는 그대로 유지됩니다.
        </p>
        <div className="solve-layout-options">
          <button
            aria-pressed={solveLayoutMode === 'standard'}
            onClick={() => {
              setSolveLayoutMode('standard');
            }}
            className={solveLayoutMode === 'standard' ? 'active' : ''}
          >
            <strong>CBT</strong>
            <span>기본 CBT</span>
            <small>기존 v2.7 화면 · 기본값</small>
          </button>
          <button
            aria-pressed={solveLayoutMode === 'comcbt'}
            onClick={() => {
              setSolveLayoutMode('comcbt');
            }}
            className={solveLayoutMode === 'comcbt' ? 'active' : ''}
          >
            <strong>COM</strong>
            <span>COMCBT 모드</span>
            <small>선택형 · 고밀도 시험지형</small>
          </button>
          <button
            aria-pressed={solveLayoutMode === 'combat'}
            onClick={() => {
              setSolveLayoutMode('combat');
            }}
            className={solveLayoutMode === 'combat' ? 'active' : ''}
          >
            <strong>⚡</strong>
            <span>컴뱃 CBT</span>
            <small>4문제 · 진행 HUD</small>
          </button>
        </div>
      </section>
      <section
        data-setting="visualStyle"
        style={{ display: matches('visualStyle') ? undefined : 'none' }}
        className="setting-group"
      >
        <span>UI 스타일</span>
        <p className="setting-description">
          {isJewelry ? '기본 CBT, 심슨, 선재 테마' : '기본 CBT와 심슨 테마'}는 이 설정 화면에서만 바꿀 수
          있습니다. 동적 UI를 꺼도 선택한 테마는 유지됩니다.
        </p>
        <div className="style-options">
          <button
            aria-pressed={visualStyle === 'default'}
            onClick={() => {
              setVisualStyle('default');
            }}
            className={visualStyle === 'default' ? 'active' : ''}
          >
            <strong>CBT</strong>
            <span>기본 UI</span>
            <small>지금까지 사용한 화면</small>
          </button>
          <button
            aria-pressed={visualStyle === 'simpsons'}
            onClick={() => {
              setVisualStyle('simpsons');
            }}
            className={visualStyle === 'simpsons' ? 'active' : ''}
          >
            <strong>🍩</strong>
            <span>심슨 테마</span>
            <small>스프링필드 코믹 UI</small>
          </button>
          {isJewelry ? (
            <button
              aria-pressed={visualStyle === 'sunjae'}
              onClick={() => {
                setVisualStyle('sunjae');
              }}
              className={visualStyle === 'sunjae' ? 'active' : ''}
            >
              <strong>☂</strong>
              <span>선재 테마</span>
              <small>보석관 전용 팬페이지 UI</small>
            </button>
          ) : null}
        </div>
      </section>
      {isJewelry ? (
        <section
          data-setting="rotation"
          style={{ display: matches('rotation') ? undefined : 'none' }}
          className="setting-group"
        >
          <span>선재 사진 자동 교체</span>
          <p className="setting-description">
            선재 테마의 홈·로고·메뉴 사진이 바뀌는 시간을 고릅니다. 끔을 선택하면 현재 사진을 그대로
            유지합니다.
          </p>
          <div className="sunjae-rotation-options">
            {[0, 5, 10, 30, 60, 180, 300].map((seconds) => (
              <button
                key={seconds}
                aria-pressed={sunjaeRotationSeconds === seconds}
                onClick={() => {
                  setSunjaeRotationSeconds(seconds);
                }}
                className={sunjaeRotationSeconds === seconds ? 'active' : ''}
              >
                {sunjaeRotationLabel(seconds)}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section
        data-setting="theme"
        style={{ display: matches('theme') ? undefined : 'none' }}
        className="setting-group"
      >
        <span>화면 테마</span>
        <div className="theme-options">
          <button
            aria-pressed={theme === 'system'}
            onClick={() => {
              change('theme', 'system');
            }}
            className={theme === 'system' ? 'active' : ''}
          >
            <strong>◐ 자동</strong>
            <small>기기 설정</small>
          </button>
          <button
            aria-pressed={theme === 'light'}
            onClick={() => {
              change('theme', 'light');
            }}
            className={theme === 'light' ? 'active' : ''}
          >
            <strong>☀ 라이트</strong>
            <small>밝은 화면</small>
          </button>
          <button
            aria-pressed={theme === 'dark'}
            onClick={() => {
              change('theme', 'dark');
            }}
            className={theme === 'dark' ? 'active' : ''}
          >
            <strong>☾ 다크</strong>
            <small>어두운 화면</small>
          </button>
        </div>
      </section>
      <section
        data-setting="fontScale"
        style={{ display: matches('fontScale') ? undefined : 'none' }}
        className="setting-group"
      >
        <span>문자 크기</span>
        <p className="setting-description">문제·보기·해설 글씨만 80%부터 160%까지 조절합니다.</p>
        <div className="font-options">
          <button
            aria-pressed={fontScale === 0.8}
            onClick={() => {
              setFontScale(0.8);
            }}
            className={fontScale === 0.8 ? 'active' : ''}
          >
            아주 작게
          </button>
          <button
            aria-pressed={fontScale === 1}
            onClick={() => {
              setFontScale(1);
            }}
            className={fontScale === 1 ? 'active' : ''}
          >
            기본
          </button>
          <button
            aria-pressed={fontScale === 1.3}
            onClick={() => {
              setFontScale(1.3);
            }}
            className={fontScale === 1.3 ? 'active' : ''}
          >
            크게
          </button>
          <button
            aria-pressed={fontScale === 1.6}
            onClick={() => {
              setFontScale(1.6);
            }}
            className={fontScale === 1.6 ? 'active' : ''}
          >
            아주 크게
          </button>
        </div>
      </section>
      <section
        data-setting="fontFamily"
        style={{ display: matches('fontFamily') ? undefined : 'none' }}
        className="setting-group"
      >
        <span>글씨체</span>
        <p className="setting-description">문제·보기·해설과 메뉴 글꼴을 함께 바꿉니다.</p>
        <div className="font-family-options">
          <button
            aria-pressed={fontFamilyPreference === 'regular'}
            onClick={() => {
              setFontFamilyPreference('regular');
            }}
            className={fontFamilyPreference === 'regular' ? 'active' : ''}
          >
            <strong>나눔고딕</strong>
            <small>Regular · 기본</small>
          </button>
          <button
            aria-pressed={fontFamilyPreference === 'bold'}
            onClick={() => {
              setFontFamilyPreference('bold');
            }}
            className={fontFamilyPreference === 'bold' ? 'active' : ''}
          >
            <strong>나눔고딕 Bold</strong>
            <small>굵고 또렷하게</small>
          </button>
          <button
            aria-pressed={fontFamilyPreference === 'd2coding'}
            onClick={() => {
              setFontFamilyPreference('d2coding');
            }}
            className={fontFamilyPreference === 'd2coding' ? 'active' : ''}
          >
            <strong>D2Coding</strong>
            <small>Regular · 고정폭</small>
          </button>
          <button
            aria-pressed={fontFamilyPreference === 'd2coding-bold'}
            onClick={() => {
              setFontFamilyPreference('d2coding-bold');
            }}
            className={fontFamilyPreference === 'd2coding-bold' ? 'active' : ''}
          >
            <strong>D2Coding Bold</strong>
            <small>굵은 고정폭</small>
          </button>
        </div>
      </section>
      {!isJewelry ? (
        <section
          data-setting="imageTheme"
          style={{ display: matches('imageTheme') ? undefined : 'none' }}
          className="setting-group"
        >
          <span>문제 이미지 다크 표시</span>
          <p className="setting-description">
            복원·한솔·일반 문제 그림의 원본 픽셀은 그대로 두고, 다크 모드 표시만 바꿉니다.
          </p>
          <div className="restored-image-options">
            <button
              aria-pressed={restoredImageTheme === 'auto'}
              onClick={() => {
                setRestoredImageTheme('auto');
              }}
              className={restoredImageTheme === 'auto' ? 'active' : ''}
            >
              <strong>◐ 눈부심 완화</strong>
              <small>추천 · 짙은 남색</small>
            </button>
            <button
              aria-pressed={restoredImageTheme === 'original'}
              onClick={() => {
                setRestoredImageTheme('original');
              }}
              className={restoredImageTheme === 'original' ? 'active' : ''}
            >
              <strong>□ 항상 원본</strong>
              <small>흰 문제지 유지</small>
            </button>
          </div>
        </section>
      ) : null}
      <section
        data-setting="explanationDisplay"
        style={{ display: matches('explanationDisplay') ? undefined : 'none' }}
        className="setting-group"
      >
        <span>문제·해설 표시 방식</span>
        <p className="setting-description">{settingsHelp.explanationDisplay}</p>
        <div className="restored-image-options">
          <button
            aria-pressed={explanationDisplay === 'text'}
            onClick={() => {
              change('explanationDisplay', 'text');
            }}
            className={explanationDisplay === 'text' ? 'active' : ''}
          >
            <strong>확인된 텍스트 우선</strong>
            <small>기본 · 수식은 분수로 표시</small>
          </button>
          <button
            aria-pressed={explanationDisplay === 'ocr'}
            onClick={() => {
              change('explanationDisplay', 'ocr');
            }}
            className={explanationDisplay === 'ocr' ? 'active' : ''}
          >
            <strong>OCR 텍스트 · 임시</strong>
            <small>지원하는 이미지 문제·해설 · 오타 시 원문으로 복귀</small>
          </button>
          <button
            aria-pressed={explanationDisplay === 'image'}
            onClick={() => {
              change('explanationDisplay', 'image');
            }}
            className={explanationDisplay === 'image' ? 'active' : ''}
          >
            <strong>원문 이미지</strong>
            <small>이전 방식 그대로</small>
          </button>
        </div>
      </section>
      <section
        data-setting="answerLayout"
        style={{ display: matches('answerLayout') ? undefined : 'none' }}
        className="setting-group standard-solving-setting"
      >
        <span>답안 선택 방식</span>
        <p className="setting-description">
          베타가 아닌 정식 설정입니다. 복원 이미지 문제의 답안 표시만 바뀌며 학습 기록에는 영향을 주지
          않습니다.
        </p>
        <div className="answer-layout-options">
          <button
            aria-pressed={answerLayout === 'hotspot'}
            onClick={() => {
              setAnswerLayout('hotspot');
            }}
            className={answerLayout === 'hotspot' ? 'active' : ''}
          >
            <strong>☝ 이미지 직접 선택</strong>
            <small>원문 속 보기를 바로 누르기</small>
          </button>
          <button
            aria-pressed={answerLayout === 'inline'}
            onClick={() => {
              setAnswerLayout('inline');
            }}
            className={answerLayout === 'inline' ? 'active' : ''}
          >
            <strong>① 답안 문구</strong>
            <small>번호 옆에서 내용을 바로 선택</small>
          </button>
          <button
            aria-pressed={answerLayout === 'classic'}
            onClick={() => {
              setAnswerLayout('classic');
            }}
            className={answerLayout === 'classic' ? 'active' : ''}
          >
            <strong>① ② ③ ④</strong>
            <small>기존 큰 번호 버튼</small>
          </button>
        </div>
        <div data-setting="indicator" className="hotspot-indicator-setting">
          <span>이미지 답안 선택 표시</span>
          <div>
            <button
              aria-pressed={hotspotIndicator === 'marker'}
              onClick={() => {
                setHotspotIndicator('marker');
              }}
              className={hotspotIndicator === 'marker' ? 'active' : ''}
            >
              <strong>✓ 체크 마커</strong>
              <small>기본 · 글자를 가리지 않음</small>
            </button>
            <button
              aria-pressed={hotspotIndicator === 'area'}
              onClick={() => {
                setHotspotIndicator('area');
              }}
              className={hotspotIndicator === 'area' ? 'active' : ''}
            >
              <strong>▰ 영역 색상 박스</strong>
              <small>PaddleOCR · 보기 전체 한 박스</small>
            </button>
          </div>
        </div>
        <div className="standard-solving-list">
          <span>
            <b>✓</b>
            <strong>이미지 잘림 방지</strong>
          </span>
          <span>
            <b>✓</b>
            <strong>OMR 자동 따라가기</strong>
          </span>
        </div>
      </section>
    </>
  );
}
export function renderSettingsContentData(m: ReturnType<typeof settingsModel>) {
  const { isNativeApp, emit, matches, context } = m;
  return (
    <>
      {!isNativeApp ? (
        <section
          data-setting="recovery"
          style={{ display: matches('recovery') ? undefined : 'none' }}
          className="setting-group data-setting pwa-recovery-setting"
        >
          <span>PWA 업데이트 복구</span>
          {context.pwaRegistrationError && <p role="status">오프라인 준비를 마치지 못했습니다. 온라인 문제 풀이는 계속할 수 있습니다.</p>}
          <p>
            업데이트 뒤 화면이 꼬였을 때 학습 기록은 보존하고 이 사이트의 캐시와 서비스워커만 다시 설정합니다.
          </p>
          <div>
            <button
              type="button"
              onClick={() => {
                emit('action', 'recovery');
              }}
            >
              복구 화면 열기
            </button>
          </div>
        </section>
      ) : null}
      <section
        data-setting="backup"
        style={{ display: matches('backup') ? undefined : 'none' }}
        className="setting-group data-setting"
      >
        <span>학습 기록</span>
        <p>이 기기의 오답·진도·시험 기록을 파일로 옮기거나 다시 불러올 수 있습니다.</p>
        <div>
          <button
            onClick={() => {
              emit('action', 'export');
            }}
          >
            기록 내보내기
          </button>
          <button
            onClick={() => {
              emit('action', 'import');
            }}
          >
            기록 불러오기
          </button>
          <button
            onClick={() => {
              emit('action', 'reset');
            }}
            className="danger"
          >
            전체 초기화
          </button>
        </div>
      </section>
      {context.exam && matches('omr') ? (
        <section className="setting-group" data-setting="omr">
          <span>OMR 답안지</span>
          <button
            type="button"
            onClick={() => {
              emit('action', 'omr');
            }}
            className="settings-link-button"
          >
            {context.omr ? 'OMR 닫기' : 'OMR 열기'}
          </button>
        </section>
      ) : null}
    </>
  );
}

function settingsModel({values,context,visible,onChange,onAction,children}:{values:SettingsValues;context:SettingsContext;visible:ReadonlySet<string>;onChange:(c:SettingChange)=>void;onAction:(a:SettingsAction)=>void;children?:ReactNode}){
 function change<K extends keyof SettingsValues>(key:K,value:SettingsValues[K]){onChange({key,value} as SettingChange);}
const setFontScale = (value: SettingsValues['fontScale']) => change('fontScale', value);
const setFontFamilyPreference = (value: SettingsValues['fontFamily']) => change('fontFamily', value);
const setVisualStyle = (value: SettingsValues['visualStyle']) => change('visualStyle', value);
const setDisplayPreference = (value: SettingsValues['display']) => change('display', value);
const setDynamicUiEnabled = (value: SettingsValues['dynamic']) => change('dynamic', value);
const setSolveLayoutMode = (value: SettingsValues['solveLayout']) => change('solveLayout', value);
const setAnswerLayout = (value: SettingsValues['answerLayout']) => change('answerLayout', value);
const setHotspotIndicator = (value: SettingsValues['indicator']) => change('indicator', value);
const setRestoredImageTheme = (value: SettingsValues['imageTheme']) => change('imageTheme', value);
const setExperimentalFeatures = (value: SettingsValues['experimental']) => change('experimental', value);
const setQuestionJudgmentEnabled = (value: SettingsValues['judgment']) => change('judgment', value);
const setSunjaeRotationSeconds = (value: SettingsValues['rotation']) => change('rotation', value);
function matches(key: string) { return visible.has(key); }
function sunjaeRotationLabel(seconds: number) { return !seconds ? '끔' : seconds < 60 ? seconds + '초' : seconds / 60 + '분'; }
 return {values,context,visible,settingsHelp,change,matches,sunjaeRotationLabel,emit:(_event:"action",action:SettingsAction)=>onAction(action),
isJewelry:context.jewelry,
isNativeApp:context.native,
theme:values.theme,
fontScale:values.fontScale,
fontFamilyPreference:values.fontFamily,
visualStyle:values.visualStyle,
displayPreference:values.display,
dynamicUiEnabled:values.dynamic,
solveLayoutMode:values.solveLayout,
answerLayout:values.answerLayout,
hotspotIndicator:values.indicator,
restoredImageTheme:values.imageTheme,
explanationDisplay:values.explanationDisplay,
experimentalFeaturesEnabled:values.experimental,
questionJudgmentEnabled:values.judgment,
sunjaeRotationSeconds:values.rotation,
setFontScale, setFontFamilyPreference, setVisualStyle, setDisplayPreference, setDynamicUiEnabled, setSolveLayoutMode, setAnswerLayout, setHotspotIndicator, setRestoredImageTheme, setExperimentalFeatures, setQuestionJudgmentEnabled, setSunjaeRotationSeconds};
}
export function SettingsControls({values,context,visible,onChange,onAction,children}:{values:SettingsValues;context:SettingsContext;visible:ReadonlySet<string>;onChange:(c:SettingChange)=>void;onAction:(a:SettingsAction)=>void;children?:ReactNode}){
 const model=settingsModel({values,context,visible,onChange,onAction});
 return <div className="legacy-settings-content"><div data-react-view="settings-controls" style={{display:"contents"}}>{renderSettingsContent(model)}</div><section data-setting="data" style={{display:visible.has("data")?undefined:"none"}}>{children}</section><div data-react-view="settings-controls-data" style={{display:"contents"}}>{renderSettingsContentData(model)}</div></div>;
}
