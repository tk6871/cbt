<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import OptionalFeatureBoundary from '../components/OptionalFeatureBoundary.vue';
import { settingGroups, settingsHelp, type SettingsValues, type SettingsContext, type SettingChange, type SettingsAction } from './settingsCatalog';
const ThemeStudio = defineAsyncComponent(() => import('./ThemeStudio.vue'));
const props = withDefaults(defineProps<{ values: SettingsValues; context: SettingsContext; query?: string }>(), { query: '' });
const emit = defineEmits<{ change: [change: SettingChange]; action: [action: SettingsAction] }>();
const isJewelry = computed(() => props.context.jewelry);
const isNativeApp = computed(() => props.context.native);
const theme = computed(() => props.values.theme);
const fontScale = computed(() => props.values.fontScale);
const fontFamilyPreference = computed(() => props.values.fontFamily);
const visualStyle = computed(() => props.values.visualStyle);
const displayPreference = computed(() => props.values.display);
const dynamicUiEnabled = computed(() => props.values.dynamic);
const solveLayoutMode = computed(() => props.values.solveLayout);
const answerLayout = computed(() => props.values.answerLayout);
const hotspotIndicator = computed(() => props.values.indicator);
const restoredImageTheme = computed(() => props.values.imageTheme);
const experimentalFeaturesEnabled = computed(() => props.values.experimental);
const questionJudgmentEnabled = computed(() => props.values.judgment);
const sunjaeRotationSeconds = computed(() => props.values.rotation);
function change<K extends keyof SettingsValues>(key: K, value: SettingsValues[K]) { emit('change', { key, value } as SettingChange); }
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
const needle = computed(() => props.query.trim().toLowerCase());
function matches(key: string): boolean {
 if (!needle.value) return true;
 if (key === 'answerLayout' && matches('indicator')) return true;
 const extra: Record<string,string> = {studio:'UI 테마 실험실 강조색 밀도 모션 고급 플러그인',recovery:'PWA 업데이트 복구 캐시',backup:'학습 기록 백업 내보내기 불러오기 초기화'};
 if (extra[key]) return extra[key].toLowerCase().includes(needle.value);
 const group = settingGroups.find(g => g.key === key);
 return !!group && [group.title,group.description,settingsHelp[group.key],...group.options.filter(o => props.context.jewelry || o.value !== 'sunjae').map(o=>o.label)].join(' ').toLowerCase().includes(needle.value);
}
const matchesData = computed(() => !needle.value || '기록 동기화 로그인 계정 백업'.includes(needle.value));
function sunjaeRotationLabel(seconds: number) { return !seconds ? '끔' : seconds < 60 ? seconds + '초' : seconds / 60 + '분'; }
</script>
<template><div class="legacy-settings-content">

        <section class="setting-group display-mode-setting" data-setting="display" v-show="matches('display')"><span>기기 화면 모드</span>
          <p class="setting-description">자동은 휴대폰·태블릿에서 경량 화면을 사용합니다. 모드를 바꾸면 현재 기록을 저장한 뒤 화면만 다시 엽니다.</p>
          <div class="display-mode-options">
            <button :class="{ active: displayPreference === 'auto' }" :aria-pressed="displayPreference === 'auto'" @click="setDisplayPreference('auto')"><strong>자동</strong><span>{{ '현재 ' + context.displayLabel }}</span><small>기기 자동 인식</small></button>
            <button :class="{ active: displayPreference === 'mobile' }" :aria-pressed="displayPreference === 'mobile'" @click="setDisplayPreference('mobile')"><strong>모바일</strong><span>모바일·태블릿</span><small>경량 화면 고정</small></button>
            <button :class="{ active: displayPreference === 'desktop' }" :aria-pressed="displayPreference === 'desktop'" @click="setDisplayPreference('desktop')"><strong>PC</strong><span>데스크톱 화면</span><small>PC 배치 고정</small></button>
          </div>
        </section>
        <section class="setting-group" data-setting="dynamic" v-show="matches('dynamic')"><span>동적 UI</span>
          <p class="setting-description">켜면 새 배치와 자연스러운 화면 전환을 사용합니다. 끄면 v2.4.2 방식의 기존 배치와 즉시 전환으로 돌아갑니다.</p>
          <div class="dynamic-ui-options">
            <button :class="{ active: dynamicUiEnabled }" :aria-pressed="dynamicUiEnabled" @click="setDynamicUiEnabled(true)"><strong>ON</strong><span>새 동적 UI</span><small>기본 설정</small></button>
            <button :class="{ active: !dynamicUiEnabled }" :aria-pressed="!dynamicUiEnabled" @click="setDynamicUiEnabled(false)"><strong>OFF</strong><span>기존 UI</span><small>v2.4.2 호환</small></button>
          </div>
        </section>
        <section class="setting-group experimental-setting" data-setting="experimental" v-show="matches('experimental')"><span>실험 기능 전체</span>
          <p class="setting-description">확신도·실수 원인·문제 메모·시험 속도 예측을 한 번에 켜고 끕니다. OFF하면 기존 v3.5.4 문제 화면과 바로 비교할 수 있고 저장한 기록은 지우지 않습니다.</p>
          <div class="dynamic-ui-options experimental-options">
            <button :class="{ active: experimentalFeaturesEnabled }" :aria-pressed="experimentalFeaturesEnabled" @click="setExperimentalFeatures(true)"><strong>β ON</strong><span>베타 기능 사용</span><small>현재 적용</small></button>
            <button :class="{ active: !experimentalFeaturesEnabled }" :aria-pressed="!experimentalFeaturesEnabled" @click="setExperimentalFeatures(false)"><strong>OFF</strong><span>기존 화면</span><small>v3.5.4 비교</small></button>
          </div>
          <button v-if="experimentalFeaturesEnabled && !context.session" type="button" class="experimental-open-button" @click="emit('action', 'beta')">베타 학습 도구 열기 →</button>
        </section>
        <section class="setting-group experimental-setting" data-setting="judgment" v-show="matches('judgment')"><span>내 판단·메모</span>
          <p class="setting-description">문제 아래의 확신도·실수 원인·내 메모만 따로 표시합니다. OFF해도 기존 기록은 삭제하지 않습니다.</p>
          <div class="dynamic-ui-options experimental-options">
            <button :class="{ active: questionJudgmentEnabled }" :aria-pressed="questionJudgmentEnabled" @click="setQuestionJudgmentEnabled(true)"><strong>ON</strong><span>판단·메모 표시</span><small>문제 아래 열기</small></button>
            <button :class="{ active: !questionJudgmentEnabled }" :aria-pressed="!questionJudgmentEnabled" @click="setQuestionJudgmentEnabled(false)"><strong>OFF</strong><span>숨기기</span><small>기본값</small></button>
          </div>
        </section>
        <OptionalFeatureBoundary v-if="matches('studio')" label="UI·테마 실험실" compact>
          <ThemeStudio @start-tour="emit('action', 'tour')" />
        </OptionalFeatureBoundary>
        <section class="setting-group solve-layout-setting" data-setting="solveLayout" v-show="matches('solveLayout')"><span>문제풀이 화면</span>
          <p class="setting-description">세 화면을 언제든 바꿀 수 있습니다. 답안·진도·타이머는 그대로 유지됩니다.</p>
          <div class="solve-layout-options">
            <button :class="{ active: solveLayoutMode === 'standard' }" :aria-pressed="solveLayoutMode === 'standard'" @click="setSolveLayoutMode('standard')"><strong>CBT</strong><span>기본 CBT</span><small>기존 v2.7 화면 · 기본값</small></button>
            <button :class="{ active: solveLayoutMode === 'comcbt' }" :aria-pressed="solveLayoutMode === 'comcbt'" @click="setSolveLayoutMode('comcbt')"><strong>COM</strong><span>COMCBT 모드</span><small>선택형 · 고밀도 시험지형</small></button>
            <button :class="{ active: solveLayoutMode === 'combat' }" :aria-pressed="solveLayoutMode === 'combat'" @click="setSolveLayoutMode('combat')"><strong>⚡</strong><span>컴뱃 CBT</span><small>4문제 · 진행 HUD</small></button>
          </div>
        </section>
        <section class="setting-group" data-setting="visualStyle" v-show="matches('visualStyle')"><span>UI 스타일</span>
          <p class="setting-description">{{ isJewelry ? '기본 CBT, 심슨, 선재 테마' : '기본 CBT와 심슨 테마' }}는 이 설정 화면에서만 바꿀 수 있습니다. 동적 UI를 꺼도 선택한 테마는 유지됩니다.</p>
          <div class="style-options">
            <button :class="{ active: visualStyle === 'default' }" :aria-pressed="visualStyle === 'default'" @click="setVisualStyle('default')"><strong>CBT</strong><span>기본 UI</span><small>지금까지 사용한 화면</small></button>
            <button :class="{ active: visualStyle === 'simpsons' }" :aria-pressed="visualStyle === 'simpsons'" @click="setVisualStyle('simpsons')"><strong>🍩</strong><span>심슨 테마</span><small>스프링필드 코믹 UI</small></button>
            <button v-if="isJewelry" :class="{ active: visualStyle === 'sunjae' }" :aria-pressed="visualStyle === 'sunjae'" @click="setVisualStyle('sunjae')"><strong>☂</strong><span>선재 테마</span><small>보석관 전용 팬페이지 UI</small></button>
          </div>
        </section>
        <section v-if="isJewelry" class="setting-group" data-setting="rotation" v-show="matches('rotation')"><span>선재 사진 자동 교체</span>
          <p class="setting-description">선재 테마의 홈·로고·메뉴 사진이 바뀌는 시간을 고릅니다. 끔을 선택하면 현재 사진을 그대로 유지합니다.</p>
          <div class="sunjae-rotation-options">
            <button v-for="seconds in [0, 5, 10, 30, 60, 180, 300]" :key="seconds" :class="{ active: sunjaeRotationSeconds === seconds }" :aria-pressed="sunjaeRotationSeconds === seconds" @click="setSunjaeRotationSeconds(seconds)">{{ sunjaeRotationLabel(seconds) }}</button>
          </div>
        </section>
        <section class="setting-group" data-setting="theme" v-show="matches('theme')"><span>화면 테마</span>
          <div class="theme-options">
            <button :class="{ active: theme === 'system' }" :aria-pressed="theme === 'system'" @click="change('theme', 'system')"><strong>◐ 자동</strong><small>기기 설정</small></button>
            <button :class="{ active: theme === 'light' }" :aria-pressed="theme === 'light'" @click="change('theme', 'light')"><strong>☀ 라이트</strong><small>밝은 화면</small></button>
            <button :class="{ active: theme === 'dark' }" :aria-pressed="theme === 'dark'" @click="change('theme', 'dark')"><strong>☾ 다크</strong><small>어두운 화면</small></button>
          </div>
        </section>
        <section class="setting-group" data-setting="fontScale" v-show="matches('fontScale')"><span>문자 크기</span>
          <p class="setting-description">문제·보기·해설 글씨만 80%부터 160%까지 조절합니다.</p>
          <div class="font-options">
            <button :class="{ active: fontScale === .8 }" :aria-pressed="fontScale === .8" @click="setFontScale(.8)">아주 작게</button>
            <button :class="{ active: fontScale === 1 }" :aria-pressed="fontScale === 1" @click="setFontScale(1)">기본</button>
            <button :class="{ active: fontScale === 1.3 }" :aria-pressed="fontScale === 1.3" @click="setFontScale(1.3)">크게</button>
            <button :class="{ active: fontScale === 1.6 }" :aria-pressed="fontScale === 1.6" @click="setFontScale(1.6)">아주 크게</button>
          </div>
        </section>
        <section class="setting-group" data-setting="fontFamily" v-show="matches('fontFamily')"><span>글씨체</span>
          <p class="setting-description">문제·보기·해설과 메뉴 글꼴을 함께 바꿉니다.</p>
          <div class="font-family-options">
            <button :class="{ active: fontFamilyPreference === 'regular' }" :aria-pressed="fontFamilyPreference === 'regular'" @click="setFontFamilyPreference('regular')"><strong>나눔고딕</strong><small>Regular · 기본</small></button>
            <button :class="{ active: fontFamilyPreference === 'bold' }" :aria-pressed="fontFamilyPreference === 'bold'" @click="setFontFamilyPreference('bold')"><strong>나눔고딕 Bold</strong><small>굵고 또렷하게</small></button>
            <button :class="{ active: fontFamilyPreference === 'd2coding' }" :aria-pressed="fontFamilyPreference === 'd2coding'" @click="setFontFamilyPreference('d2coding')"><strong>D2Coding</strong><small>Regular · 고정폭</small></button>
            <button :class="{ active: fontFamilyPreference === 'd2coding-bold' }" :aria-pressed="fontFamilyPreference === 'd2coding-bold'" @click="setFontFamilyPreference('d2coding-bold')"><strong>D2Coding Bold</strong><small>굵은 고정폭</small></button>
          </div>
        </section>
        <section v-if="!isJewelry" class="setting-group" data-setting="imageTheme" v-show="matches('imageTheme')"><span>문제 이미지 다크 표시</span>
          <p class="setting-description">복원·한솔·일반 문제 그림의 원본 픽셀은 그대로 두고, 다크 모드 표시만 바꿉니다.</p>
          <div class="restored-image-options">
            <button :class="{ active: restoredImageTheme === 'auto' }" :aria-pressed="restoredImageTheme === 'auto'" @click="setRestoredImageTheme('auto')"><strong>◐ 눈부심 완화</strong><small>추천 · 짙은 남색</small></button>
            <button :class="{ active: restoredImageTheme === 'original' }" :aria-pressed="restoredImageTheme === 'original'" @click="setRestoredImageTheme('original')"><strong>□ 항상 원본</strong><small>흰 문제지 유지</small></button>
          </div>
        </section>
        <section class="setting-group standard-solving-setting" data-setting="answerLayout" v-show="matches('answerLayout')"><span>답안 선택 방식</span>
          <p class="setting-description">베타가 아닌 정식 설정입니다. 복원 이미지 문제의 답안 표시만 바뀌며 학습 기록에는 영향을 주지 않습니다.</p>
          <div class="answer-layout-options">
            <button :class="{ active: answerLayout === 'hotspot' }" :aria-pressed="answerLayout === 'hotspot'" @click="setAnswerLayout('hotspot')"><strong>☝ 이미지 직접 선택</strong><small>원문 속 보기를 바로 누르기</small></button>
            <button :class="{ active: answerLayout === 'inline' }" :aria-pressed="answerLayout === 'inline'" @click="setAnswerLayout('inline')"><strong>① 답안 문구</strong><small>번호 옆에서 내용을 바로 선택</small></button>
            <button :class="{ active: answerLayout === 'classic' }" :aria-pressed="answerLayout === 'classic'" @click="setAnswerLayout('classic')"><strong>① ② ③ ④</strong><small>기존 큰 번호 버튼</small></button>
          </div>
          <div class="hotspot-indicator-setting" data-setting="indicator">
            <span>이미지 답안 선택 표시</span>
            <div>
              <button :class="{ active: hotspotIndicator === 'marker' }" :aria-pressed="hotspotIndicator === 'marker'" @click="setHotspotIndicator('marker')"><strong>✓ 체크 마커</strong><small>기본 · 글자를 가리지 않음</small></button>
              <button :class="{ active: hotspotIndicator === 'area' }" :aria-pressed="hotspotIndicator === 'area'" @click="setHotspotIndicator('area')"><strong>▰ 영역 색상 박스</strong><small>PaddleOCR · 보기 전체 한 박스</small></button>
            </div>
          </div>
          <div class="standard-solving-list">
            <span><b>✓</b><strong>이미지 잘림 방지</strong></span>
            <span><b>✓</b><strong>OMR 자동 따라가기</strong></span>
          </div>
        </section>
        <section v-show="matchesData" data-setting="data"><slot name="account" /></section>
        <section v-if="!isNativeApp" class="setting-group data-setting pwa-recovery-setting" data-setting="recovery" v-show="matches('recovery')"><span>PWA 업데이트 복구</span>
          <p>업데이트 뒤 화면이 꼬였을 때 학습 기록은 보존하고 이 사이트의 캐시와 서비스워커만 다시 설정합니다.</p>
          <div><button type="button" @click="emit('action', 'recovery')">복구 화면 열기</button></div>
        </section>
        <section class="setting-group data-setting" data-setting="backup" v-show="matches('backup')"><span>학습 기록</span>
          <p>이 기기의 오답·진도·시험 기록을 파일로 옮기거나 다시 불러올 수 있습니다.</p>
          <div>
            <button @click="emit('action', 'export')">기록 내보내기</button>
            <button @click="emit('action', 'import')">기록 불러오기</button>
            <button class="danger" @click="emit('action', 'reset')">전체 초기화</button>
          </div>
          
        </section>

<section v-if="context.exam" class="setting-group"><span>OMR 답안지</span><button type="button" class="settings-link-button" @click="emit('action', 'omr')">{{ context.omr ? 'OMR 닫기' : 'OMR 열기' }}</button></section>
</div></template>
