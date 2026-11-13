import { test, expect } from '@playwright/test';
import { advanceCampusStory, freshStory } from '../src/cbt/campusStory';
import { makePreviewWalker } from '../src/cbt/campusPreviewWalk';
import { campusReactionAt, campusReactionWave } from '../src/cbt/campusReaction';
import { Bone, Group, Vector3 } from 'three';
test.use({ serviceWorkers: 'block' });
test.beforeEach(async ({ page }) => {
  await page.route('**/work/private-notes/campus-assets/shiho-campus.glb', route => route.fulfill({status:404}));
  await page.route('**/work/private-notes/campus-assets/{scarlett,ivy,lucy}-campus.glb', route => route.fulfill({status:404}));
  await page.addLocatorHandler(page.locator('.pwa-error-notice'), async () => {
    // The notice can disappear when campusOpen becomes true; click synchronously
    // if it still exists instead of waiting for a detached transition element.
    await page.locator('.pwa-error-notice').evaluateAll(nodes => nodes.forEach(node => {
      Array.from(node.querySelectorAll('button')).find(button => button.textContent?.trim() === '나중에')?.click();
    }));
  }, { noWaitAfter: true });
  await page.addInitScript(() => {
    localStorage.setItem('modern-cbt-qualification-industrial', 'hvac');
    localStorage.setItem('unified-cbt-dynamic-ui', 'false');
    sessionStorage.setItem('unified-cbt-ios-pwa-popup-seen-v351', 'true');
    sessionStorage.setItem('unified-cbt-android-apk-popup-seen-v351', 'true');
  });
});
test('캐릭터 보조 동작은 머리카락과 몸통에 적용되고 T자 자세에서는 초기화', () => {
  const model = new Group();
  const makeBone = (name: string, x = 0) => {
    const bone = new Bone(); bone.name = 'DEF-' + name; bone.position.x = x; model.add(bone); return bone;
  };
  makeBone('Left arm', .1); makeBone('Right arm', -.1);
  for (const name of ['Left leg','Right leg','Left knee','Right knee']) makeBone(name);
  const spine = makeBone('Spine'), hair = makeBone('Hair_Back');
  const walker = makePreviewWalker(model)!;
  const hairRest = hair.quaternion.clone(), spineRest = spine.quaternion.clone();
  walker.react();
  walker.update(.05, false, 'idle');
  expect(hair.quaternion.equals(hairRest)).toBe(false);
  expect(spine.quaternion.equals(spineRest)).toBe(false);
  walker.update(.05, false, 'tpose');
  expect(hair.quaternion.equals(hairRest)).toBe(true);
  expect(spine.quaternion.equals(spineRest)).toBe(true);
});
test('맞은 위치를 구분하고 해당 관절에만 반동을 더함', () => {
  const model = new Group();
  const bone = (name:string,x:number,y:number) => {
    const joint = new Bone(); joint.name='DEF-'+name; joint.position.set(x,y,0); model.add(joint); return joint;
  };
  const head=bone('Head',0,1.7), spine=bone('Spine',0,1.1), arm=bone('Left arm',.35,1.4), wrist=bone('Left wrist',.7,1.3);
  bone('Right arm',-.35,1.4); bone('Right wrist',-.7,1.3);
  bone('Left leg',.15,.8); bone('Right leg',-.15,.8); bone('Left knee',.15,.4); bone('Right knee',-.15,.4);
  expect(campusReactionAt(new Vector3(.58,1.36,0),[['spine',spine],['head',head],['leftArm',arm,wrist]])).toBe('leftArm');
  expect(campusReactionAt(new Vector3(0,1.71,.04),[['spine',spine],['head',head],['leftArm',arm,wrist]])).toBe('head');
  const walker=makePreviewWalker(model,{x:0,z:0,yaw:0})!;
  walker.update(0,false,'idle');
  const hit=wrist.getWorldPosition(new Vector3());
  walker.update(.05,false,'idle');
  const normal=arm.quaternion.clone();
  walker.react(hit);
  walker.update(.05,false,'idle');
  expect(arm.quaternion.angleTo(normal)).toBeGreaterThan(.05);
  walker.update(.5,false,'idle');
  expect(arm.quaternion.angleTo(normal)).toBeLessThan(.0001);
  expect(campusReactionWave(0)).toBe(0);
});
test('교복 학생 모델 로드 및 캠퍼스 안내', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', '키보드 이동 검증');
  await page.goto('/?safe=1');
  const launch = page.getByRole('button', { name: /3D 캠퍼스 체험/ });
  await expect(launch).toBeVisible({ timeout: 15000 });
  await Promise.all([
    page.waitForResponse(response => response.url().endsWith('/school-uniform.vrm') && response.ok()),
    page.waitForResponse(response => response.url().endsWith('/school-blazer.vrm') && response.ok()),
    launch.click(),
  ]);
  const campus = page.getByRole('dialog', { name: '3D 캠퍼스 체험', exact: true });
  await expect(campus.locator('.character-status')).toHaveCount(0, { timeout: 30000 });
  await campus.locator('.campus-scene').focus();
  await page.keyboard.down('d');
  await page.keyboard.down('w');
  const talk = campus.getByRole('button', { name: /시부 · 대화하기/ });
  try { await expect(talk).toBeVisible({ timeout: 6500 }); }
  finally { await page.keyboard.up('w'); await page.keyboard.up('d'); }
  await campus.locator('canvas').screenshot({ path: '/private/tmp/cbt-school-uniform.png' });
  await talk.click();
  const conversation = campus.getByRole('region', { name: '캠퍼스 인물 대화' });
  await expect(conversation).toContainText('견학 학생 · 캠퍼스 안내');
  await expect(conversation.getByRole('button', { name: '공부 시작' })).toBeVisible();
  await expect(conversation.locator('.campus-story-choices, .campus-affinity')).toHaveCount(0);
  const festival = page.waitForResponse(response => response.url().endsWith('/school-festival.vrm') && response.ok());
  await conversation.getByRole('button', { name: '축제 의상', exact: true }).click();
  await festival;
  await expect(conversation.getByRole('button', { name: '축제 의상', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await conversation.getByRole('button', { name: '대화 닫기', exact: true }).click();
  await campus.locator('canvas').screenshot({ path: '/private/tmp/cbt-school-festival.png' });
  await talk.click();
  await conversation.getByRole('button', { name: '교복', exact: true }).click();
  await expect(conversation.getByRole('button', { name: '교복', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('캠퍼스 시점 전환과 목적지 이동', async ({ page }, info) => {
  await page.goto('/?safe=1');
  await page.getByRole('button', { name: /3D 캠퍼스 체험/ }).click();
  const campus = page.getByRole('dialog', { name: '3D 캠퍼스 체험', exact: true });
  await expect(campus.locator('canvas')).toBeVisible({ timeout: 15000 });
  await campus.getByRole('button', { name: /1인칭 보기/ }).click();
  await expect(campus.getByRole('button', { name: /위에서 보기/ })).toHaveAttribute('aria-pressed', 'true');
  const touch = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
  if (touch) {
    const controls = campus.getByRole('group', { name: '화면 방향키' });
    await expect(controls).toBeVisible();
    await expect(controls.getByRole('button')).toHaveCount(4);
  }
  await campus.getByLabel('이동 애니메이션 줄이기').check();
  await campus.getByRole('navigation', { name: '캠퍼스 목적지' }).getByRole('button', { name: /강의실/ }).click();
  await expect(campus.locator('.campus-status')).toHaveText('현재 위치: 강의실');
  if (info.project.name === 'desktop') await campus.locator('canvas').screenshot({ path: '/private/tmp/cbt-campus-overview.png' });
  await campus.locator('.campus-scene').focus();
  await page.keyboard.press('v');
  await expect(campus.getByRole('button', { name: /1인칭 보기/ })).toHaveAttribute('aria-pressed', 'false');
  if (info.project.name === 'desktop') {
    await expect(campus.locator('.character-status')).toHaveCount(0, { timeout: 30000 });
    const hoverLook = campus.getByLabel('드래그 없이 시점 이동');
    await expect(hoverLook).not.toBeChecked();
    const view = () => page.screenshot({ clip:{ x:520,y:280,width:440,height:260 } });
    await page.mouse.move(700, 430);
    const before = await view();
    await page.mouse.move(750, 430, { steps: 5 });
    expect((await view()).equals(before)).toBe(true);
    await page.mouse.down();
    await page.mouse.move(754, 430, { steps: 4 });
    await page.mouse.up();
    expect((await view()).equals(before)).toBe(true);
    await page.mouse.down();
    await page.mouse.move(875, 430, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => (await view()).equals(before)).toBe(false);
    const turned = await view();
    await campus.getByRole('button', { name: '시선 정면' }).click();
    await expect.poll(async () => (await view()).equals(turned)).toBe(false);
    await hoverLook.check();
    const reset = await view();
    await page.mouse.move(700,430);
    await page.mouse.move(870,430,{steps:8});
    await expect.poll(async () => (await view()).equals(reset)).toBe(false);
  }
});

test('열람 테라스 이동 · 비타 안내 · 정문 복귀', async ({ page }, info) => {
  await page.goto('/?safe=1');
  const launch = page.getByRole('button', { name: /3D 캠퍼스 체험/ });
  await expect(launch).toBeVisible({ timeout: 20000 });
  await Promise.all([
    page.waitForResponse(response => response.url().endsWith('/terrace-vita.vrm') && response.ok(), {timeout: 20000}),
    launch.click(),
  ]);
  const campus = page.getByRole('dialog', { name: '3D 캠퍼스 체험', exact: true });
  const navigation = campus.getByRole('navigation', { name: '캠퍼스 목적지' });
  await expect(campus.locator('.character-status')).toHaveCount(0, { timeout: 30000 });
  if (info.project.name !== 'desktop') await campus.getByLabel('이동 애니메이션 줄이기').check();
  await navigation.getByRole('button', { name: /테라스/ }).click();
  await expect(campus.locator('.campus-status')).toHaveText('현재 위치: 테라스', { timeout: 16000 });
  const talk = campus.getByRole('button', { name: /비타 · 대화하기/ });
  await expect(talk).toBeVisible();
  if (info.project.name === 'desktop') await campus.screenshot({ path: '/private/tmp/cbt-terrace-desktop.png' });
  await talk.click();
  const dialogue = campus.getByRole('region', { name: '캠퍼스 인물 대화' });
  await expect(dialogue).toContainText('테라스 열람 도우미');
  await expect(dialogue.getByRole('button', { name: '공부 시작' })).toBeVisible();
  await dialogue.getByRole('button', { name: '대화 닫기' }).click();
  await campus.getByLabel('이동 애니메이션 줄이기').check();
  await navigation.getByRole('button', { name: /정문/ }).click();
  await expect(campus.locator('.campus-status')).toHaveText('현재 위치: 정문');
});

test('캠퍼스 지연 로딩 · 공간 이동 · 기존 화면 복귀', async ({ page }, info) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on('request', r => requests.push(r.url()));
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?safe=1');
  const launch = page.getByRole('button', { name: /3D 캠퍼스 체험/ });
  await expect(launch).toBeVisible();
  expect(requests.some(url => url.includes('CampusExperience'))).toBe(false);
  expect(requests.some(url => url.endsWith('.vrm'))).toBe(false);
  await launch.click();
  const campus = page.getByRole('dialog', { name: '3D 캠퍼스 체험', exact: true });
  await expect(campus.locator('canvas')).toBeVisible();
  await expect(campus.locator('.campus-error')).toHaveCount(0);
  await expect(campus.locator('.character-status')).toHaveCount(0, { timeout: 30000 });
  if (info.project.name === 'desktop') {
    const still = await campus.locator('canvas').screenshot();
    await page.waitForTimeout(350);
    expect((await campus.locator('canvas').screenshot()).equals(still)).toBe(false);
  }
  await expect(campus.getByRole('button', { name: /서윤 · 대화하기/ })).toBeVisible();
  await campus.locator('.campus-scene').focus();
  await page.keyboard.press('e');
  await expect(campus.getByRole('region', { name: '캠퍼스 인물 대화' })).toContainText('캠퍼스 안내');
  await page.keyboard.press('Escape');
  await expect(campus.getByRole('region', { name: '캠퍼스 인물 대화' })).toHaveCount(0);
  await expect(campus).toBeVisible();
  await page.screenshot({ path: `/private/tmp/campus-${info.project.name}-entrance.png` });
  await campus.getByRole('button', { name: '캠퍼스 들어가기 →' }).click();
  await expect(campus.locator('.campus-status')).toHaveText('현재 위치: 복도', { timeout: 20000 });
  await page.screenshot({ path: `/private/tmp/campus-${info.project.name}-hall.png` });
  await campus.getByLabel('이동 애니메이션 줄이기').check();
  await campus.getByRole('button', { name: '101 강의실 입장 →' }).click();
  await expect(campus.locator('.campus-status')).toHaveText('현재 위치: 강의실');
  await page.screenshot({ path: `/private/tmp/campus-${info.project.name}-room.png` });
  await campus.getByRole('button', { name: '회차 선택하고 공부하기 ↗' }).click();
  await expect(campus).toHaveCount(0);
  expect(await page.locator('body').evaluate(el => el.style.overflow)).not.toBe('hidden');
  await page.goBack();
  await expect(launch).toBeVisible();
  await launch.click();
  await expect(campus.locator('canvas')).toBeVisible();
  await page.goBack();
  await expect(campus).toHaveCount(0);
  await expect(launch).toBeFocused();
  expect(errors).toEqual([]);
});
test('WebGL 불가 시 기본 CBT로 안전 복귀', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind: any, ...args: any[]) {
      if (kind === 'webgl2' || kind === 'webgl') return null;
      return (original as any).call(this, kind, ...args);
    } as any;
  });
  await page.goto('/?safe=1');
  await page.getByRole('button', { name: /3D 캠퍼스 체험/ }).click();
  await expect(page.getByRole('alert')).toContainText('이 기기에서는 3D 화면을 열 수 없어요');
  await page.getByRole('button', { name: '기존 CBT로 돌아가기', exact: true }).click();
  await expect(page.locator('.campus')).toHaveCount(0);
});

test('성인 캠퍼스 이야기 · 분기와 진행 복원', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', '상태 저장은 PC에서 검사');
  let state=freshStory();
  expect(advanceCampusStory(state,'date')).toEqual(state);
  for(const choice of ['hello','study','coffee'] as const)state=advanceCampusStory(state,choice);
  expect(advanceCampusStory(state,'friend').ending).toBe('friend');
  await page.goto('/?safe=1');
  await page.getByRole('button',{name:/3D 캠퍼스 체험/}).click();
  const campus=page.locator('.campus');
  await expect(campus.locator('canvas')).toBeVisible();
  await expect(campus.locator('.character-status')).toHaveCount(0,{timeout:30000});
  const records=await page.evaluate(()=>localStorage.getItem('unified-industrial-cbt-v1'));
  await campus.getByRole('button',{name:/서윤 · 대화하기/}).click();
  for(const name of ['반가워요. 잠깐 이야기해요.','다음 문제를 같이 생각해 볼까요?','잠깐 쉬면서 커피 한 잔 할래요?','다음엔 둘이 산책하는 데이트 어때요?'])await campus.getByRole('button',{name,exact:true}).click();
  await expect(campus.locator('.campus-conversation')).toContainText('첫 데이트 이야기 완료');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('cbt-campus-story-v1')||'{}').guide.ending)).toBe('date');
  expect(await page.evaluate(()=>localStorage.getItem('unified-industrial-cbt-v1'))).toEqual(records);
  await page.reload();
  await page.getByRole('button',{name:/3D 캠퍼스 체험/}).click();
  await expect(campus.locator('canvas')).toBeVisible();
  await expect(campus.locator('.character-status')).toHaveCount(0,{timeout:30000});
  await campus.getByRole('button',{name:/서윤 · 대화하기/}).click();
  await expect(campus.locator('.campus-conversation')).toContainText('첫 데이트 이야기 완료');
});

test('유나 InkJS · 다른 에셋 실패와 무관하게 대화 · 저장과 두 결말', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'PC 키보드 접근 검사');
  await page.route('**/assets/campus/models/victoria.vrm', route => route.abort());
  await page.goto('/?safe=1');
  await page.getByRole('button',{name:/3D 캠퍼스 체험/}).click();
  const campus=page.locator('.campus');
  await expect(campus.locator('.character-status')).toContainText('일부 캐릭터',{timeout:30000});
  const host=campus.locator('.campus-scene');
  const talk=campus.getByRole('button',{name:/유나 · 대화하기/});
  await host.focus();
  await page.keyboard.down('w');
  try { await expect(talk).toBeVisible({timeout:10000}); } finally { await page.keyboard.up('w'); }
  await talk.click();
  const novel=campus.locator('.campus-novel');
  await campus.getByText('자유 대화',{exact:true}).click();
  await campus.getByRole('textbox',{name:'대화 메시지'}).fill('커피 마실래요?');
  await campus.getByRole('button',{name:'보내기',exact:true}).click();
  await expect(campus.getByRole('log',{name:'자유 대화 내용'})).toContainText('조용한 카페');
  await campus.getByText('자유 대화',{exact:true}).click();
  await novel.getByRole('button',{name:/강의에서 기억/}).click();
  await novel.getByRole('button',{name:/한 문제씩 설명/}).click();
  await campus.getByRole('button',{name:'대화 닫기',exact:true}).click();
  await talk.click();
  await novel.getByRole('button',{name:/같이 가자고/}).click();
  await novel.getByRole('button',{name:/데이트로/}).click();
  await expect(novel).toContainText('데이트 엔딩');
  await novel.getByRole('button',{name:/처음부터/}).click();
  await novel.getByRole('button',{name:/쉬는 날엔/}).click();
  await novel.getByRole('button',{name:/카페 추천만/}).click();
  await expect(novel).toContainText('스터디 친구 엔딩');
});

test('시노 자동 로드 · 자세 전환 · 시험 메뉴 없음', async ({ page }, info) => {
  const previewModel = process.env.CBT_LOCAL_CAMPUS_GLB;
  test.skip(info.project.name !== 'desktop' || !previewModel, '로컬 시노 파일이 필요');
  await page.unroute('**/work/private-notes/campus-assets/shiho-campus.glb');
  if (previewModel !== 'work/private-notes/campus-assets/shiho-campus.glb') {
    await page.route('**/work/private-notes/campus-assets/shiho-campus.glb', route => route.fulfill({ path:previewModel! }));
  }
  await page.goto('/?safe=1');
  await page.getByRole('button',{name:/3D 캠퍼스 체험/}).click();
  const campus=page.locator('.campus');
  await expect(campus.locator('canvas')).toBeVisible();
  await expect(campus.getByText('로컬 모델 시험',{exact:true})).toHaveCount(0);
  await expect(campus.getByRole('button',{name:/비공개 에셋 테스트/})).toHaveCount(0);
  await expect(campus.locator('.campus-model-preview-status')).toContainText('플레이어 · 시노', { timeout: 25000 });
  await campus.getByRole('button',{name:/점프/}).click();
  await expect(campus.getByRole('button',{name:/점프/})).toHaveAttribute('aria-pressed','true');
  await expect(campus.getByRole('button',{name:/점프/})).toHaveAttribute('aria-pressed','false');
  await campus.getByRole('button',{name:'시노로 플레이'}).click();
  await campus.getByLabel('이동 애니메이션 줄이기').check();
  await campus.getByRole('navigation', { name: '캠퍼스 목적지' }).getByRole('button', { name: /테라스/ }).click();
  await expect(campus.locator('.campus-status')).toHaveText('현재 위치: 테라스');
  await expect(campus.getByRole('button', { name: /비타 · 대화하기/ })).toHaveCount(0);
  const poses = campus.getByRole('group', { name: '시노 자세' });
  await poses.getByRole('button', { name: 'T자 자세' }).click();
  await expect(poses.getByRole('button', { name: 'T자 자세' })).toHaveAttribute('aria-pressed', 'true');
  await expect(campus.locator('.campus-model-preview-status')).toContainText('테라스 T자 자세');
  const tPose = await campus.locator('canvas').screenshot();
  await poses.getByRole('button', { name: '편하게 서기' }).click();
  await expect.poll(async () => (await campus.locator('canvas').screenshot()).equals(tPose)).toBe(false);
  await poses.getByRole('button', { name: '산책', exact:true }).click();
  await campus.getByLabel('이동 애니메이션 줄이기').uncheck();
  const canvas = campus.locator('canvas');
  const still = await canvas.screenshot();
  await expect.poll(async()=> (await canvas.screenshot()).equals(still)).toBe(false);
});

test('강의실 새 캐릭터 3명 자동 로드', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop' || process.env.CBT_LOCAL_COMPANIONS !== '1', '로컬 캐릭터 파일이 필요');
  await page.unroute('**/work/private-notes/campus-assets/shiho-campus.glb');
  await page.unroute('**/work/private-notes/campus-assets/{scarlett,ivy,lucy}-campus.glb');
  await page.goto('/?safe=1');
  await page.getByRole('button',{name:/3D 캠퍼스 체험/}).click();
  const campus = page.getByRole('dialog',{name:'3D 캠퍼스 체험',exact:true});
  await campus.getByLabel('이동 애니메이션 줄이기').check();
  await campus.getByRole('navigation',{name:'캠퍼스 목적지'}).getByRole('button',{name:/운동장/}).click();
  await expect(campus.locator('.campus-status')).toHaveText('현재 위치: 운동장');
  await campus.getByRole('navigation',{name:'캠퍼스 목적지'}).getByRole('button',{name:/강의실/}).click();
  const classmates = campus.getByLabel('강의실에 앉은 캐릭터');
  for (const name of ['스칼렛','아이비','루시']) await expect(classmates).toContainText(name,{timeout:35000});
  await expect(campus.locator('.campus-model-preview-status')).toContainText('시노',{timeout:35000});
  await campus.screenshot({path:'/private/tmp/cbt-classroom-companions.png'});
});

test('4K · 키보드 이동 · 드래그 · 컨텍스트 손실 복귀', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'PC 4K 조작 검사');
  await page.setViewportSize({ width: 3840, height: 2160 });
  await page.goto('/?safe=1');
  await page.getByRole('button', { name: /3D 캠퍼스 체험/ }).click();
  const campus = page.locator('.campus');
  const host = campus.locator('.campus-scene');
  await expect(host.locator('canvas')).toBeVisible();
  await host.focus();
  const before = await host.screenshot();
  await page.keyboard.down('w');
  await page.waitForTimeout(500);
  await page.keyboard.up('w');
  expect((await host.screenshot()).equals(before)).toBe(false);
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(350); await page.keyboard.up('ArrowRight');
  await page.mouse.move(2000, 1000); await page.mouse.down();
  await page.mouse.move(2150, 1020, { steps: 8 }); await page.mouse.up();
  await page.screenshot({ path: '/private/tmp/campus-4k.png' });
  const overflow = await campus.evaluate(el => el.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await host.locator('canvas').evaluate(el => el.dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
  await expect(campus.getByRole('alert')).toContainText('3D 화면 연결이 중단');
  await page.keyboard.press('Escape');
  await expect(campus).toHaveCount(0);
});
