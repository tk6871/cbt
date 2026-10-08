import type { QuestionItem } from './types';
import { coolingStem } from './coolingScope';

// Chapter/section indexes follow the user's photographed textbook contents.
// Classify the task being asked, not incidental equipment in the choices.
export type BookPlacement = readonly [chapter: number, section: number];
const reviewed: Record<string, [BookPlacement, string, string]> = {
  'hvac-20070304:25': [[2, 2], '냉동장치에대해설명', '보기의 흡수식·터보 비교'],
  'hvac-20080302:34': [[0, 3], '다음설명중옳은', '보기의 교축 전후 엔탈피'],
  'hvac-20080511:22': [[0, 0], '다음설명중옳지', '보기의 전도·대류·복사·열통과'],
  'hvac-20090510:36': [[5, 1], '다음설명중옳지', '보기의 불응축가스·액압축 점검'],
  'hvac-20100307:23': [[0, 1], '다음보기중', '원문 그림의 냉동유·냉매 용해성 직접 확인'],
  'hvac-20120304:34': [[0, 1], '다음보기의내용', '원문 그림의 냉동유·냉매 용해성 직접 확인'],
  'hvac-20130602:26': [[0, 3], '다음설명중옳은', '보기의 교축 전후 엔탈피'],
  'hvac-20140302:38': [[1, 5], '암모니아냉동장치에대한설명', '보기의 증발압력 조정밸브 목적'],
  'hvac-20140525:36': [[0, 1], '다음설명중옳은', '보기의 암모니아 냉동유 변질'],
  'hvac-20060816:30': [[1, 1], '암모니아수냉응축기', '응축기 열통과율 계산'],
  'hvac-20060816:48': [[1, 4], '냉동장치에서증발기와응축기', '기기 위치에 따른 부속 밸브 설치'],
  'hvac-hansol-2018-1:56': [[1, 4], '냉동장치에서증발기가응축기', '정지 시 냉매 흐름 방지 부속기기'],
  'hvac-20100725:17': [[1, 4], '열교환기로서공기냉각기', '보기의 냉매 분배기'],
  'hvac-20110821:31': [[5, 1], '압축기및응축기에서', '과열 운전 대책'],
  'hvac-20140525:38': [[5, 1], '압축기및응축기에서', '과열 운전 대책'],
  'hvac-20140525:31': [[0, 1], '다음냉매중독성', '냉매의 독성·성질 비교'],
  'hvac-hansol-2018-3:42': [[4, 0], '프레온냉동장치흡입관', '흡입 배관 구배'],
  'hvac-hansol-2020-1:25': [[0, 0], '다음중펠티어', '전자 냉동 원리, 응용 장의 세 유형에 해당하지 않음'],
  'hvac-hansol-2023-1:22': [[1, 4], '다음중증발기출구와압축기', '저압측 부속장치'],
  'hvac-20080302:28': [[1, 4], 'R12열교환기', '고압 액·저압 증기 열교환 부속기기'],
  'hvac-20160306:26': [[0, 3], '표준냉동장치에서단열팽창', '표준 사이클의 교축 상태 변화'],
  'hvac-hansol-2020-1:29': [[0, 0], '증기압축식냉동법', '증기압축·전자 냉동 원리 비교'],
  'hvac-hansol-2023-2:29': [[5, 1], '증기압축식냉동장치운전을', '운전 준비·점검 절차'],
};
const rules: Array<[RegExp, BookPlacement, string]> = [
  [/공조방식|공기조화방식|전공기|전수식|냉방방식|F\.?C\.?U|팬코일/, [5, 0], '냉방설비 방식'],
  [/펌프.*(?:회전수|토출량)|냉수.*순환펌프/, [5, 2], '냉동기 부속 펌프'],
  [/냉각탑/, [5, 3], '냉각탑'],
  [/불응축|공기.*(?:침입|유입|혼입)|수분.*혼입|단수|장기간운전|운전(?:상태|할때|에관한)|운전.*(?:점검|유의|주의)|고압.*상승원인|응축압력.*(?:상승|원인)|증발압력.*(?:낮은|낮아)|저압.*낮아|냉매가부족|핫가스제상|제상방법|운전을위한준비/, [5, 1], '운전 상태·고장 점검'],
  [/부하|침입열|저장품.*열량|냉장실.*(?:벽|열관류)|단열재|방열재/, [3, 0], '냉장 부하·단열'],
  [/흡입관내|이중입상관|오일트랩|냉매.*배관|배관.*냉매|기밀시험|내압시험|진공건조|냉매충전/, [4, 0], '설치·냉매 배관'],
  [/CA\(?|C[.．]A|쇼케이스|냉장쇼케이스|냉동차|냉동자동차|냉장수송|냉동운송|냉동용운송|냉동컨테이너|냉장화물|식품|수산물|빙관|제빙|초저온동결|동결장치|얼음제조/, [2, 0], '저장·제빙·동결 응용'],
  [/수축열|축열시스템|열펌프|히트펌프|빙축열|LNG.*냉열/, [2, 1], '축열·열펌프·냉열 응용'],
  [/증기분사|스팀이젝터|부압(?:작용|적용)|수증기.*열원|태양열.*냉방|흡수식/, [2, 2], '열 구동 냉동장치'],
  [/가용전|브르돈|부르돈|부속기기|고압측.*(?:설치|장치)|가스퍼저|GasPurger|열교환기의주된설치목적|히트파이프/, [1, 4], '부속기기'],
  [/증발압력조정밸브|EPR|온도제어기|제어동작|시퀀스제어|제어기기|압력스위치|온도조절기/, [1, 5], '제어기기'],
  [/균압관|교축작용.*부속기기|감압장치|팽창밸브.*(?:특징|설명|입구|통과)|모세관|감온통/, [1, 3], '팽창밸브·감압장치'],
  [/스크류|스크루|압측기|압축기.*(?:구조|특징|능력|회전)|왕복동/, [1, 0], '압축기'],
  [/응축관|응축기.*(?:역할|전열|특징|구조)|대수평균온도차/, [1, 1], '응축기·열교환 온도차'],
  [/증발기.*(?:구조|종류|특징|역할)/, [1, 2], '증발기'],
  [/플[래레]시|플[래레]쉬|후레쉬|flashgas|교축작용|교축팽창|줄.?톰슨|냉동효과|냉동싸이클|냉동사이클|2단압축|2원냉동|중간냉각기|중간압력|압축비|성적계수|응축온도|증발온도|응축기.*(?:방출|방열량|제거.*열량)|응축기방열량|초저온냉동|내한.*성능|T-S|T－S/i, [0, 3], '냉동 사이클·에너지 수지'],
  [/모리엘|몰리엘|몰리에|P-h|P－h|p-h|냉매선도/i, [0, 2], '냉매선도'],
  [/윤활|냉동기유|냉동유|냉매|프레온|브라인|Brine|할로겐|HFC|할론|저온유체|동부착|구리도금|오존.*파괴/i, [0, 1], '냉매·브라인·냉동유'],
  [/폴리트로|P-V|PV|기체|가스상수|상태변화|단열(?:압축|유동)|압력.*온도|공기.*(?:용기|체적)|최종속도/i, [0, 4], '기초열역학·상태 변화'],
  [/에너지보존|엔트로피.*(?:증가|변화)|에너지의흐름|열과일|열.*일사이|열기관|가역사이클|열효율/, [0, 5], '열역학 법칙'],
  [/단위|압력(?:중|값)|열의일당량|1HP|감열|Sensibleheat|열이동|열유속|열전도율|전열계수|열에대한설명|열량|얼음.*수증기|냉동관련용어|냉동능력.*전동기|영화관.*냉방|냉동방법의종류|냉동기.*종류.*원리|얼음과식염/i, [0, 0], '기초 원리·단위·열 전달'],
];

export function coolingContextPlacement(item: QuestionItem): { placement: BookPlacement; reason: string } | undefined {
  const text = coolingStem(item);
  const manual = coolingReviewedPlacement(item);
  if (manual) return manual;
  const rule = rules.find(([pattern]) => pattern.test(text));
  return rule ? { placement: rule[1], reason: rule[2] } : undefined;
}

export function coolingReviewedPlacement(item: QuestionItem): { placement: BookPlacement; reason: string } | undefined {
  const row = reviewed[item.id.replace(/^school-cooling::/, '')];
  return row && coolingStem(item).startsWith(row[1]) ? { placement: row[0], reason: row[2] } : undefined;
}

export function coolingSectionContext(item: QuestionItem, chapter: number): number | undefined {
  const text = coolingStem(item);
  // Single-section chapters already have an unambiguous destination.
  if (chapter === 3 || chapter === 4) return 0;
  if (chapter === 0) {
    if (/몰리|몰리엘|모리엘|선도.*건조도|압력.?엔탈피.*선도/i.test(text)) return 2;
    if (/엔트로피.*(?:증가|변화)/.test(text)) return 5;
    if (/압축비|냉동능력|냉매순환|냉동사이클|카르노|교축|성적계수|포화액.*엔탈피/.test(text)) return 3;
    if (/열역학|밀폐탱크|노즐|기체|물질.*교환|상태변화/.test(text)) return 4;
  }
  if (chapter === 1) {
    if (/팽창밸브|모세관/.test(text)) return 3;
    if (/수액기|부속장치|열교환시킬/.test(text)) return 4;
    if (/왕복동|대용량|냉동기의종류|피스톤/.test(text)) return 0;
    if (/응축기.*(?:열량|냉각수)/.test(text)) return 1;
  }
  const context = coolingContextPlacement(item);
  return context?.placement[0] === chapter ? context.placement[1] : undefined;
}
