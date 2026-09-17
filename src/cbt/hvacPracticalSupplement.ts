import rows from '../../data/hvac-practical-supplement-20260916.json';
import type { PracticalCategory, PracticalPrompt } from './hvacPracticalTypes';

// Source transcription lives separately. These learning notes never replace older questions.
type Note = { category: PracticalCategory; explanation: string; keys: string[]; answer?: string; question?: string; correction?: string; url?: string };
const notes: Record<number, Note> = {
  1: { category: 'equipment', answer: '과전류가 흐르면 퓨즈 엘리먼트가 녹아 회로를 끊고 전선·기기를 보호한다.', explanation: '전류가 커지면 발열이 커진다. 퓨즈가 먼저 녹아 전류의 길을 끊는 방식이며, 동작한 퓨즈는 원인을 제거한 뒤 같은 규격으로 교체한다.', keys: ['과전류', '용단', '회로 보호'] },
  2: { category: 'equipment', answer: '전원이 공급되는 동안 설정한 주기로 접점을 반복 개폐하여 점등·소등을 반복시킨다.', explanation: '한 번 켜진 채 유지하는 릴레이가 아니라, 켜짐과 꺼짐을 되풀이하는 타이머이다. a접점이 붙을 때 b접점은 떨어지는 식으로 동작한다.', keys: ['주기', '반복 개폐'] },
  3: { category: 'equipment', explanation: '코일에 전기를 흘려 자석의 힘으로 밸브를 여닫는다. 냉매를 보내거나 막아 온도·액면 등을 제어하며, 정지 중 액냉매 이동을 막는 용도로도 쓴다.', keys: ['전자력', '유체 흐름 개폐', '온도제어'] },
  4: { category: 'equipment', explanation: '팬 바람을 따라 날아가려는 물방울을 붙잡아 다시 떨어뜨린다. 물의 비산을 줄이는 장치이지, 수증기 전체를 제거하는 장치는 아니다.', keys: ['물방울', '비산 방지'] },
  5: { category: 'safety', answer: '기출의 전통적 식별 답안: 특유의 자극취, 젖은 붉은 리트머스지의 청색 변화, 유황초 시험의 백색 연기. 실제 점검은 적합한 누설검지기와 안전 절차를 사용한다.', explanation: '암모니아는 독성·부식성이 있다. 냄새를 일부러 맡거나 유황초를 피우며 누출부에 접근하는 실습으로 따라 하면 안 된다. 위험 구역에서 벗어나 전문 대응을 요청한다.', keys: ['리트머스', '청색', '누설검지기'], correction: '원문 전통적 시험 답안과 실제 안전한 작업방법을 구분함.', url: 'https://www.cdc.gov/chemical-emergencies/chemical-fact-sheets/ammonia.html' },
  6: { category: 'safety', answer: '자료의 전통적 헬라이드 토치 답안: 누설 없음→청색, 소량→녹색, 다량→자색, 극심→불꽃 꺼짐.', explanation: '염소를 포함하는 옛 냉매에 쓰던 검출 방식이다. 모든 프레온계 냉매에 적용되는 방법이 아니다. 화염은 냉매의 유해 분해가스를 만들 수 있으므로 실제 누설검사는 냉매에 맞는 검지기를 사용한다.', keys: ['청색', '녹색', '자색', '꺼짐'], correction: '전통적 방식의 적용 범위·화염 위험을 명시함.', url: 'https://chemicalsafety.ilo.org/dyn/icsc/showcard.display?p_card_id=1281&p_lang=en' },
  7: { category: 'operation', explanation: '압축비가 커지거나 들어오는 가스가 이미 뜨거우면 토출온도가 높아진다. 냉매 부족·팽창밸브 과소 개방은 증발기를 굶겨 과열도를 키울 수 있고, 윤활 불량은 마찰열을 키운다.', keys: ['고압 상승', '흡입가스 과열', '냉매 부족', '팽창밸브', '윤활 불량'] },
  8: { category: 'operation', explanation: '펌프다운은 냉매를 버리는 작업이 아니라 저압측에서 고압측으로 모으는 작업이다. 저압측 수리와 정지 중 냉매 이동 억제가 목적이다.', keys: ['펌프다운', '저압측 수리', '누설 방지', '오일포밍 방지'] },
  9: { category: 'air', explanation: '차가운 컵 표면에 물방울이 생기는 것과 같다. 표면온도가 주변 공기의 노점온도 이하로 내려가면 수증기가 물로 응축한다.', keys: ['노점온도', '수증기', '응축'] },
  10: { category: 'equipment', answer: '내부균압형: 밸브 출구 압력을 내부 통로로 받아 사용하며 증발기 압력손실이 작은 경우에 쓴다. 외부균압형: 증발기 출구 압력을 외부 균압관으로 받아 압력손실을 보상한다.', explanation: '증발기를 지나며 압력이 많이 떨어지면 입구 쪽 압력만으로는 출구 상태를 정확히 알 수 없다. 그래서 출구까지 별도 관을 연결한다. 단순히 소형·대형이나 과열도가 크고 작다는 기준만으로 나누지 않는다.', keys: ['밸브 출구 압력', '증발기 출구 압력', '압력손실 보상'], correction: '원문 표현을 압력 감지 위치와 압력손실 기준으로 교정함.', url: 'https://www.danfoss.com/en-us/service-and-support/case-stories/dcs/how-thermostatic-expansion-valves-work/' },
  11: { category: 'air', explanation: '확산형은 바람을 멀리 한 줄기로 보내기보다 넓게 퍼뜨린다. 천장에 설치해 넓은 범위로 분산시키는 취출구로 기억한다.', keys: ['확산형', '확산반경', '도달거리', '원추'] },
  12: { category: 'piping', explanation: '고장 난 기기를 지나는 본래 길 대신 우회로로 유체를 보낸다. 모든 장치를 세우지 않고 해당 부분을 점검할 수 있도록 하는 배관이다.', keys: ['우회', '점검', '수리'] },
  13: { category: 'air', explanation: '축류형은 주로 일정 방향으로 보내고, 확산형은 주변으로 퍼뜨린다. 이 문항은 제공 자료의 분류에 맞춰 종류를 구분하는 연습이다.', keys: ['노즐형', '펑커루버형', '유니버셜', '머쉬룸', '슬롯형', '아네모스탯형', '팬형'] },
  14: { category: 'equipment', answer: '오일펌프 토출압력과 크랭크케이스 압력의 차(유효 유압)가 부족한 상태로 일정 시간 지속되면 압축기를 정지시켜 윤활 불량에 따른 손상을 막는다.', explanation: '그림의 P1은 유압, P2는 저압이다. 실제 베어링에 오일을 밀어 넣는 힘은 P1−P2이므로 압력 하나만 보지 않고 차압을 확인한다.', keys: ['차압', '일정 시간', '압축기 정지', '윤활'] },
  15: { category: 'cycle', answer: '강관을 사용한다. 전기절연성이 낮다. 물에 잘 녹는다. 독성이 있다. 가연성이 있으며 특정 농도·조건에서는 폭발 위험이 있다.', explanation: '암모니아는 좋은 냉매 성능과 별개로 독성·재질 적합성·화재 위험을 관리해야 한다. “항상 폭발한다”는 뜻은 아니다.', keys: ['강관', '전기절연성', '물', '독성', '가연성'], url: 'https://www.cdc.gov/niosh/npg/npgd0028.html' },
  16: { category: 'calculation', answer: '냉각탑 방열량 Q = 냉각수 질량유량 × 비열 × (입구 수온−출구 수온). 쿨링레인지 = 입구 수온−출구 수온. 쿨링어프로치 = 출구 수온−입구 공기의 습구온도.', explanation: '레인지는 물이 얼마나 식었는지, 어프로치는 식은 물이 공기의 습구온도와 얼마나 차이 나는지이다. Q를 kW로 구할 때 유량은 kg/s, 물의 비열은 약 4.186 kJ/(kg·℃)로 넣는다. 원문의 “유량×레인지”에는 물의 비열과 단위 조건이 생략돼 있다.', keys: ['질량유량', '비열', '입구 수온−출구 수온', '습구온도'], correction: 'PDF 글꼴 추출 오류와 생략된 비열·단위 조건을 보완함.', url: 'https://spxcooling.com/wp-content/uploads/H-002A.pdf' },
  17: { category: 'air', answer: '공기여과기(필터), 냉각코일, 가열코일, 가습장치, 송풍기.', explanation: '필터로 거르고, 냉각·가열코일로 온도를 바꾸고, 가습장치로 수분을 더하며, 송풍기로 보낸다. 원문의 “엘리멘트”는 어떤 부품인지 불분명해 기능이 구분되는 장치명으로 정리했다.', keys: ['필터', '냉각코일', '가열코일', '가습', '송풍기'], correction: '불명확한 부품명 대신 기능별 장치 예시로 정리함.' },
  18: { category: 'operation', explanation: '증발기에서 액체가 다 기화하지 못하면 압축기로 액냉매가 돌아온다. 부하는 줄었는데 냉매는 너무 많이 들어오거나, 성에·유막 때문에 열을 못 받는 상황을 생각하면 된다.', keys: ['부하 감소', '냉매 과충전', '팽창밸브', '액분리기', '유막', '적상'] },
  19: { category: 'operation', explanation: '토출밸브가 새면 내보낸 고온가스가 실린더로 되돌아온다. 같은 가스를 다시 압축하느라 뜨거워지고, 실제로 순환시키는 냉매량과 냉동능력은 줄어든다.', keys: ['토출가스온도', '체적효율', '윤활유', '냉동능력', '소요동력'] },
  20: { category: 'operation', explanation: '처음부터 수분을 못 빼냈거나, 작업 중 공기·습기가 들어왔거나, 외부 압력이 더 높아 틈으로 빨려 들어온 경우이다.', keys: ['진공작업', '냉매', '오일', '설치', '외기'] },
  21: { category: 'operation', explanation: '액관 속 냉매는 압력이 떨어지거나 열을 받으면 일부가 미리 기체가 된다. 막힘·가는 관은 압력강하, 햇빛·고온 장소는 열 유입으로 묶으면 쉽다.', keys: ['막힘', '구경', '직사광선', '고온'] },
  22: { category: 'operation', answer: '냉매 공급량·냉동능력 감소, 냉장실 온도 상승, 흡입가스 과열, 토출온도 상승과 윤활유 열화, 증발압력 저하 및 냉동능력당 소요동력 증가.', explanation: '팽창밸브 앞에 기체가 섞이면 필요한 액냉매가 충분히 공급되지 않는다. “동력 증가”는 조건에 따라 달라질 수 있어, 냉동능력 1단위당 소요동력이 증가하는 뜻으로 정리했다.', keys: ['냉동능력 감소', '냉장실 온도', '과열', '토출온도', '증발압력'], correction: '총동력 증가로 단정하지 않고 냉동능력당 소요동력으로 보완함.' },
  23: { category: 'operation', explanation: '필요한 냉방량이 줄었는데 계속 최대출력으로 운전하면 전기를 낭비하고 고장 위험도 커진다. 필요한 만큼만 일하도록 조절하는 것이다.', keys: ['경제적', '사고 방지', '수명'] },
  24: { category: 'cycle', question: '그림의 가열 과정에서 B, C, D, E 지점의 상태변화를 쓰시오.', answer: 'B: 융해 시작(포화 고체), C: 융해 완료(포화 액체), D: 비등·기화 시작(포화 액체), E: 기화 완료(포화 증기).', explanation: '왼쪽에서 오른쪽으로 계속 가열하는 그래프이다. B~C에서는 얼음이 물로, D~E에서는 물이 수증기로 바뀐다. C를 응고, E를 응결이라고 쓴 원문 답안은 이 가열 방향과 맞지 않는다.', keys: ['융해 시작', '융해 완료', '기화 시작', '기화 완료'], correction: '원문 그림과 답안 불일치를 가열 방향에 맞게 교정함.', url: 'https://openstax.org/books/chemistry-2e/pages/10-3-phase-transitions' },
  25: { category: 'safety', answer: '눈 노출: 즉시 깨끗한 흐르는 물로 충분히 씻고 진료를 받는다. 피부·동상: 물로 씻고 비비거나 달라붙은 옷을 억지로 떼지 않으며 의료 도움을 받는다. 예방: 보안경·내한 장갑을 착용하고 해당 냉매의 SDS를 따른다.', explanation: '원문의 붕산·피크린산·광물유 세척은 실제 응급처치 지침으로 사용하지 않는다. 냉매 종류에 맞는 SDS와 응급의료진의 안내를 우선한다. 이 답안은 옛 교재 답을 그대로 암기하기 위한 것이 아니라 안전을 위해 교정한 학습 안내이다.', keys: ['물로 세척', '진료', '보안경', '내한 장갑'], correction: '위험한 약품 세척 안내 제외. 실제 사고 시119·의료진·제품 SDS를 우선함.', url: 'https://chemicalsafety.ilo.org/dyn/icsc/showcard.display?p_card_id=1281&p_lang=en' },
  26: { category: 'air', explanation: '차가운 공기가 빠르게 몸에 닿거나 차가운 벽으로 열을 빼앗길 때 춥게 느낀다. 제공 자료의 낮은 습도 항목은 보조적인 쾌적감 요인으로 구분하고, 기류·공기온도·주위 표면온도를 핵심으로 이해한다.', keys: ['기류 속도', '공기온도', '벽면 온도'], correction: '원문 답안을 유지하되 낮은 습도는 보조 요인임을 설명함.' },
  27: { category: 'air', explanation: '방 안에서 생기는 열이다. 사람, 조명, 각종 기기에서 나오는 열을 묶는다.', keys: ['인체', '조명', '실내기구'] },
  28: { category: 'air', explanation: '방 밖에서 벽·창을 통과하거나 틈새로 들어오는 공기와 함께 유입되는 열이다.', keys: ['벽체', '유리창', '극간풍'] },
  29: { category: 'air', explanation: '실내에서 제거할 열뿐 아니라 외기 처리, 재열, 기기와 배관에서 더해지는 열까지 고려한다. PDF의 “배과부하”는 배관부하로 바로잡았다.', keys: ['실내취득', '기기취득', '재열', '외기', '배관'] },
  30: { category: 'air', explanation: '난방은 모자라는 열을 보충하는 일이다. 햇빛·사람·조명이 열을 내주면 난방기가 보충할 양이 줄어든다.', keys: ['일사', '인체', '조명'] },
  31: { category: 'air', answer: '창문 틈새를 기밀하게 보수한다. 기밀성이 높은 이중창을 사용한다. 창을 완전히 닫고 패킹·문풍지 등으로 접합부 틈새를 줄인다.', explanation: '문제는 창문을 물었지만 원문 답은 회전문·이중문·에어커튼이라는 출입구 대책이었다. 창문에는 기밀 보수가 직접적인 대책이다. 출입구 틈새바람을 묻는 경우에는 원문의 문·에어커튼 대책을 구분해 쓴다.', keys: ['기밀', '이중창', '틈새'], correction: '창문 질문과 출입구 답안의 불일치를 구분함.' },
  32: { category: 'equipment', answer: '회전하는 임펠러로 냉매가스에 속도를 주고 디퓨저에서 압력으로 바꾸는 연속 압축 방식이다. 큰 체적유량·대용량 냉동설비에 적합하다.', explanation: '피스톤으로 왕복 압축하는 것이 아니라 회전 날개로 밀어낸다. 소음·안전성은 기종과 냉매에 따라 달라 “저압냉매라 무조건 안전”하다고 단정하지 않는다.', keys: ['임펠러', '디퓨저', '대용량'], correction: '원문의 소음·안전성 일반화 대신 기본 구조와 용도로 정리함.' },
  33: { category: 'safety', explanation: '가스용접에서 혼합가스가 나가는 속도가 너무 작아지거나 화구가 과열되면 불꽃이 안쪽으로 들어갈 수 있다. 막힘·압력 부족·과열을 묶어 기억하되 실제 조치는 장비 안전절차를 따른다.', keys: ['공급압력 부족', '화구 막힘', '화구 과열'] },
  34: { category: 'equipment', explanation: '유효하게 압축하는 양을 줄이는 방법이다. 우회시키거나 틈새체적을 늘리거나 회전수를 바꾼다. 기종에 따라 적용 가능한 방법이 다르다.', keys: ['바이패스', '클리어런스', '회전수'] },
  35: { category: 'equipment', explanation: '회전수 조절은 필요한 냉동량에 맞춰 압축기 속도를 바꾸고, 바이패스는 냉매 일부를 우회시킨다. 제시한 두 가지가 모든 터보 냉동기의 제어방식을 뜻하지는 않는다.', keys: ['바이패스', '회전수'] },
  36: { category: 'operation', explanation: '제상은 성에를 없애는 것이다. 압축기의 뜨거운 토출가스를 증발기에 보내 그 열로 얼음을 녹인다.', keys: ['토출가스', '증발기', '성에'] },
  37: { category: 'air', answer: '실내 부하 일부를 유닛 코일에서 처리해 중앙 공조기와 1차 공기 덕트를 작게 할 수 있다. 유닛 자체에 실내공기 순환용 팬이 필요하지 않다.', explanation: '노즐에서 나온 1차 공기가 주변 실내공기를 끌어들여 코일을 통과시킨다. 원문의 “동력소비 적다”는 전체 시스템에 무조건 해당하지 않는다. 고압 1차 공기를 보내는 송풍동력은 따로 필요하다.', keys: ['공조기 소형화', '덕트 공간', '유닛 팬 불필요'], correction: '전체 동력 절감 단정을 유닛 팬 불필요라는 구조적 특징으로 보완함.' },
  38: { category: 'air', explanation: '중량법은 포집된 먼지의 무게, 비색법은 오염에 따른 색 변화, DOP법은 시험 에어로졸의 상·하류 농도를 비교하는 방식으로 구분한다. DOP는 전통적 시험 명칭이다.', keys: ['중량법', '비색법', 'DOP'] },
  39: { category: 'equipment', explanation: '액체 위에 뜨는 플로트의 높이가 달라지면 접점이 바뀐다. 액면이 너무 높거나 낮은지 감지해 펌프·밸브를 제어하는 데 쓴다.', keys: ['액면', '플로트', '접점'] },
  40: { category: 'equipment', explanation: '정해 둔 압력에 도달하면 접점을 바꿔 장치를 켜거나 끈다. 압력을 연속 숫자로 보여주는 압력계와는 역할이 다르다.', keys: ['설정 압력', '접점', '개폐'] },
  41: { category: 'air', question: '냉각탑의 백연 현상이란 무엇인가?', answer: '냉각탑의 따뜻하고 습한 배출공기가 차가운 외기와 섞이면서 수증기가 미세한 물방울로 응축하여 흰 안개처럼 보이는 현상이다.', explanation: '연료가 타서 생긴 연기가 아니다. 수증기 자체는 눈에 보이지 않으며, 응축한 작은 물방울이 빛을 산란시켜 하얗게 보인다.', keys: ['습한 배출공기', '차가운 외기', '응축', '물방울'], correction: 'PDF 답안 공란을 냉각탑 제조사 자료로 보완하고 질문의 맥락을 명시함.', url: 'https://spxcooling.com/library/understanding-plume-poing/' },
  42: { category: 'operation', question: '오일포밍(oil foaming)이란 무엇인가?', explanation: '오일에 녹아 있던 냉매가 압력이 낮아지며 급히 기화하면 거품이 생길 수 있다. 오일이 정상적으로 윤활하지 못하고 다른 곳으로 운반되는 문제가 생긴다.', keys: ['오일', '거품', '냉매'], correction: '문제의 오밀포밍 오탈자를 교정함.' },
};

export const hvacPracticalSupplement: PracticalPrompt[] = rows.map(row => {
  const note = notes[row.number];
  if (!note) throw new Error(`추가 필답 ${row.number}번 검토 기록 없음`);
  const answer = note.answer || row.sourceAnswer.replaceAll('#', ': ').replaceAll('배과부하', '배관부하').replace(/^\./gm, '').trim();
  if (!answer) throw new Error(`추가 필답 ${row.number}번 답안 없음`);
  return {
    id: row.id, number: row.number, group: 'supplement', category: note.category,
    difficulty: 'basic', points: 5, question: note.question || row.question,
    answer, explanation: note.explanation, keyPoints: note.keys, image: row.image,
    sourceNote: `사용자 제공 모두CBT 「필답문제2」 ${row.sourcePage}쪽 ${row.number}번. 공식 기출 회차·공식 채점표가 아닌 학습 자료입니다.${note.correction ? ` 보완: ${note.correction}` : ' 제공 답안을 정리한 학습용 설명입니다.'}`,
    sourceUrl: note.url,
  };
});
