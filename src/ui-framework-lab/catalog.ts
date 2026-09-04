export type FrameworkKey =
  | 'classic' | 'reka' | 'vuetify' | 'primevue' | 'naive' | 'quasar'
  | 'element' | 'ant' | 'bootstrap' | 'vuestic' | 'arco' | 'tdesign'
  | 'viewui' | 'vant' | 'varlet' | 'oruga' | 'wave' | 'ionic'
  | 'framework7' | 'kendo' | 'devextreme';

export interface FrameworkInfo {
  key: FrameworkKey;
  name: string;
  maker: string;
  group: '대형·유명' | 'Vue 특화' | '모바일' | '상용 체험' | '기본·헤드리스';
  tone: string;
  license: string;
  commercial?: boolean;
}

export const frameworks: FrameworkInfo[] = [
  { key: 'classic', name: '기본 CBT', maker: '현재 프로젝트', group: '기본·헤드리스', tone: '지금 익숙한 학습 화면', license: '프로젝트 기준' },
  { key: 'reka', name: 'Reka UI', maker: 'Reka UI', group: '기본·헤드리스', tone: '접근성 중심의 자유로운 구성', license: 'MIT' },
  { key: 'vuetify', name: 'Vuetify', maker: 'Material Design', group: '대형·유명', tone: '큰 터치 영역과 명확한 계층', license: 'MIT' },
  { key: 'primevue', name: 'PrimeVue', maker: 'PrimeTek', group: '대형·유명', tone: '정돈된 Aura 대시보드', license: 'MIT' },
  { key: 'quasar', name: 'Quasar', maker: 'Quasar Framework', group: '대형·유명', tone: '웹과 앱을 함께 보는 화면', license: 'MIT' },
  { key: 'element', name: 'Element Plus', maker: 'Element Plus', group: '대형·유명', tone: '단정한 관리·학습 도구', license: 'MIT' },
  { key: 'ant', name: 'Ant Design Vue', maker: 'Ant Design', group: '대형·유명', tone: '정보 밀도가 높은 업무형 UI', license: 'MIT' },
  { key: 'bootstrap', name: 'BootstrapVueNext', maker: 'Bootstrap 5', group: '대형·유명', tone: '가장 익숙한 웹 구성', license: 'MIT' },
  { key: 'naive', name: 'Naive UI', maker: 'TuSimple', group: 'Vue 특화', tone: '차분하고 가벼운 문제 집중형', license: 'MIT' },
  { key: 'vuestic', name: 'Vuestic UI', maker: 'Epicmax', group: 'Vue 특화', tone: '선명한 카드형 대시보드', license: 'MIT' },
  { key: 'arco', name: 'Arco Design Vue', maker: 'ByteDance', group: 'Vue 특화', tone: '정밀하고 현대적인 업무형', license: 'MIT' },
  { key: 'tdesign', name: 'TDesign Vue Next', maker: 'Tencent', group: 'Vue 특화', tone: '넓고 또렷한 제품형 UI', license: 'MIT' },
  { key: 'viewui', name: 'View UI Plus', maker: 'View Design', group: 'Vue 특화', tone: '전통적인 데스크톱 업무 화면', license: 'MIT' },
  { key: 'oruga', name: 'Oruga UI', maker: 'Oruga', group: '기본·헤드리스', tone: 'CSS를 자유롭게 입히는 구조', license: 'MIT' },
  { key: 'wave', name: 'Wave UI', maker: 'Wave UI', group: 'Vue 특화', tone: '밝고 부드러운 Vue 화면', license: 'MIT' },
  { key: 'ionic', name: 'Ionic Vue', maker: 'Ionic', group: '모바일', tone: '네이티브 앱에 가까운 터치 UI', license: 'MIT' },
  { key: 'framework7', name: 'Framework7 Vue', maker: 'Framework7', group: '모바일', tone: 'iOS·Android 앱 스타일', license: 'MIT' },
  { key: 'vant', name: 'Vant', maker: 'Youzan', group: '모바일', tone: '작은 화면에 촘촘한 구성', license: 'MIT' },
  { key: 'varlet', name: 'Varlet UI', maker: 'Varlet', group: '모바일', tone: 'Material 기반 모바일 UI', license: 'MIT' },
  { key: 'kendo', name: 'Kendo UI for Vue', maker: 'Progress Telerik', group: '상용 체험', tone: '대규모 업무용 컴포넌트', license: '상용·시험판' , commercial: true },
  { key: 'devextreme', name: 'DevExtreme Vue', maker: 'DevExpress', group: '상용 체험', tone: '고밀도 기업용 화면', license: '상용·30일 평가', commercial: true },
];

export function frameworkByKey(key: string | null): FrameworkInfo {
  return frameworks.find((item) => item.key === key) || frameworks[0];
}
