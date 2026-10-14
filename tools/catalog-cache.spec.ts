import { test, expect } from '@playwright/test';
import { loadCatalogs } from '../src/cbt/catalog';
import type { Catalog } from '../src/cbt/types';

test('문제은행 재사용·교재 뒤늦은 로딩·새 은행 교체', () => {
  const globals = globalThis as unknown as { window?: Partial<Window> };
  const previous = globals.window;
  const bank = (number:number):Catalog => ({ key:'energy-midterm',name:'test',rounds:[{
    id:'round',year:2025,session:'1',subjects:['test'],questions:[{number,question:'test',choices:['1','2','3','4'],answer:1,explanation:''}],
  }] } as unknown as Catalog);
  globals.window = { CBT_DATA_ENERGY_MIDTERM:bank(1) };
  try {
    const first=loadCatalogs()[0];
    expect(loadCatalogs()[0]).toBe(first);
    globals.window.CBT_DATA_ENERGY_TEXTBOOK=bank(2);
    const merged=loadCatalogs()[0];
    expect(merged).not.toBe(first);
    expect(merged.rounds[0].questions.map(q=>q.number)).toEqual([1,2]);
    expect(loadCatalogs()[0]).toBe(merged);
    globals.window.CBT_DATA_ENERGY_MIDTERM=bank(3);
    expect(loadCatalogs()[0].rounds[0].questions.map(q=>q.number)).toEqual([3,2]);
  } finally { globals.window=previous; }
});
