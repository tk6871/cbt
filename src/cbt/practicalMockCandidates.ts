import type { PracticalPrompt } from './hvacPracticalTypes';
import type { MockKind } from './practicalMock';
import { calculationLesson } from './practicalCalculations';

export type MockCandidate = { prompt: PracticalPrompt; kind: MockKind; topic: string };
const normalized = (text: string) => text.normalize('NFKC').toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
// Device aliases join repeated photos/descriptions across material sources.
// Category comes from the existing curated bank; an image alone is not a type.
const topicAliases: [string, string[]][] = [
  ['scroll-compressor',['스크롤압축기']], ['centrifugal-compressor',['터보압축기','원심식압축기']],
  ['screw-compressor',['스크루압축기','스크류압축기']], ['reciprocating-compressor',['왕복동압축기','왕복동식압축기']],
  ['rotary-compressor',['회전식압축기']], ['accumulator',['액분리기','흡입액분리기']],
  ['oil-separator',['유분리기']], ['receiver',['수액기']], ['filter-drier',['필터드라이어']],
  ['manifold',['매니폴드','매니폴드게이지']], ['tev',['온도식팽창밸브','온도자동팽창밸브']],
  ['epr',['증발압력조정밸브','epr']], ['cpr',['흡입압력조정밸브','cpr']],
  ['capillary',['모세관']], ['solenoid',['전자밸브','솔레노이드']],
  ['check-valve',['체크밸브','역지밸브','역류방지밸브']], ['strainer',['스트레이너']],
  ['steam-trap',['스팀트랩','증기트랩','디스크트랩','플로트트랩','버킷트랩']],
  ['outlets',['취출구','아네모스탯','펑커루버','캄라인']], ['ventilation',['환기']],
  ['erv',['전열교환기']], ['fcu',['팬코일유닛']], ['induction-unit',['유인유닛']],
  ['evaporative-condenser',['증발식응축기']], ['flooded-evaporator',['만액식증발기']],
  ['vernier',['버니어캘리퍼스']], ['multimeter',['멀티미터','회로시험기','테스터']],
  ['clamp-meter',['클램프미터','클램프메터']], ['insulation-meter',['절연저항계','메거']],
  ['overload-sensor',['열동형과부하계전기']], ['contactor',['전자접촉기','마그네틱컨택터']],
  ['breaker',['배선용차단기','mccb']], ['relief-damper',['릴리프댐퍼']],
  ['flare-tool',['플레어링툴']], ['expander-tool',['익스팬더','확관기']],
  ['canvas-joint',['캔버스이음','캔버스조인트']], ['supports',['서포트','배관지지']],
  ['insulation',['보온재']], ['ammonia-moisture',['암모니아수분']],
  ['pressure-gauge',['부르동관압력계','컴파운드압력계','진공게이지']],
  ['solenoid',['2위치밸브']], ['relay',['릴레이11핀','11핀릴레이']],
  ['current-transformer',['계기용변류기']], ['four-way-valve',['4방밸브']],
  ['rupture-disc',['파열판']], ['fusible-plug',['가용전']],
  ['oil-pressure-switch',['유압차단스위치','유압보호스위치']],
  ['sight-glass',['사이트글라스']], ['water-valve',['절수밸브']],
  ['reducing-valve',['감압밸브']], ['safety-valve',['스프링식안전밸브']],
  ['air-vent',['공기빼기밸브','에어벤트']], ['flexible-joint',['플렉시블']],
  ['flange',['플랜지']], ['flare-joint',['플레어이음']],
  ['finned-evaporator',['핀코일식증발기','유니트쿨러','핀드튜브형증발기']],
  ['fire-damper',['방화댐퍼']], ['recovery-device',['냉매회수장치']],
  ['vacuum-device',['진공펌프','추기장치']], ['bracket-valve',['브라켓밸브']],
  ['reamer',['리머']], ['water-level-gauge',['수면계']],
  ['pressure-switch',['고저압차단스위치','고저압스위치']],
  ['air-filter',['프리필터','미디엄필터','헤파필터','울파필터']],
  ['outlets',['라인형취출구']], ['steam-trap',['버킷트랩','디스크트랩','플로트트랩']],
];
const calculationTopics: Record<string,string> = {
  '물의 온도 변화와 열량':'heat-sensible', '선도 온도차로 공기 가열량':'heat-sensible',
  '공기의 현열·송풍량':'airflow', '정해진 시간에 물을 냉각하기':'cooling-capacity',
  '얼음 → 물 → 증기의 열량':'heat-phase', '건조도로 냉동능력 구하기':'cooling-capacity',
  'COP와 응축기 방열량':'cop', '엔탈피로 COP 구하기':'cop',
  '냉매 순환량':'refrigerant-flow', '엔탈피 차로 전열부하':'enthalpy-load',
  '현열비 SHF':'shf', '혼합공기의 온도·습도':'mixed-air',
  '바닥 손실열과 열관류율':'floor-transfer', '응축기 전열면적':'condenser-area',
  '열저항으로 열관류율 구하기':'wall-transfer', '펌프 유량과 회전수':'pump-affinity',
  '펌프 축동력':'pump-power', '보일러 부하와 정격출력':'boiler-output',
  '급탕·상용·정격출력과 효율':'boiler-output', '굽힌 배관의 길이':'bent-pipe-length',
  '바이패스팩터 BF·콘택트팩터 CF':'bf-cf', '나사이음 강관 길이 공식':'threaded-pipe-length',
};

export function additionalMockCandidate(prompt: PracticalPrompt): MockCandidate | null {
  if (!prompt.question.trim() || !prompt.answer.trim() || prompt.points !== 5) return null;
  if (prompt.group === 'restored') {
    // Older motion questions still need a video; only self-contained photos are added.
    if (!(prompt.image || prompt.images?.length) || !prompt.question.includes('사진')
      || /영상을 보고|동작영상|점등상태|알맞은 회로/.test(prompt.question)) return null;
  }
  const lesson = calculationLesson(prompt);
  let kind: MockKind;
  if (lesson) kind = lesson.kind === 'numeric' ? 'calculation' : 'formula';
  else if (/시퀀스|회로.*동작|자기유지|인터록/.test(prompt.question)) kind = 'sequence';
  else if (prompt.category === 'piping') kind = 'piping';
  else if (prompt.category === 'air') kind = 'air';
  else if (prompt.category === 'equipment' || ((prompt.image || prompt.images?.length)
    && /명칭|계기|부품/.test(prompt.question))) kind = 'device';
  else if (prompt.category === 'calculation') return null; // Do not guess a numeric task.
  else kind = 'theory';
  const namedTopic = lesson && calculationTopics[lesson.title];
  const primary = normalized(prompt.answer.split(/특징|사용목적|설치목적|원리|용도/)[0] + ' ' + prompt.question);
  const alias = topicAliases.find(([,names]) => names.some(name => primary.includes(normalized(name))));
  return { prompt, kind, topic: namedTopic || alias?.[0] || `content:${normalized(prompt.question + prompt.answer)}` };
}
