import { Controller, Get, NotFoundException, Param, ParseIntPipe, StreamableFile } from '@nestjs/common';
import { readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(process.env.CBT_CONTENT_ROOT || join(__dirname, '../..'));
const equipment = join(root, 'assets/equipment');
const banks = new Set(['hvac', 'hvac-hansol', 'safety', 'safety-engineer', 'energy', 'energy-midterm',
  'maintenance', 'electric-craftsman', 'gas-craftsman', 'hazardous-craftsman', 'information-engineer',
  'forklift-craftsman', 'maintenance-engineer', 'energy-textbook', 'energy-restored', 'energy-book-earlier',
  'energy-engineer', 'hvac-hansol-book', 'jewelry']);
type Bank = {key: string; rounds: {id: string; questions: {number: number; _originRoundId?:string; _originalNumber?:number}[]}[]};
type Model = {label: string; questions: string[]; file?: string};
async function models(): Promise<Record<string, Model>> {
  return JSON.parse(await readFile(join(equipment, 'lessons.json'), 'utf8'));
}
const cache = new Map<string,{mtime:number; value:Promise<Bank | Bank[]>}>();
async function readBank(key: string): Promise<Bank | Bank[]> {
  if (!banks.has(key)) throw new NotFoundException();
  const path = join(root, 'data', key + '.js');
  const {mtimeMs} = await stat(path);
  const cached = cache.get(key);
  if (cached?.mtime === mtimeMs) return cached.value;
  const value = parseFile(path);
  cache.set(key, {mtime:mtimeMs,value});
  if (cache.size > 4) cache.delete(cache.keys().next().value!);
  try { return await value; }
  catch (error) { if (cache.get(key)?.value === value) cache.delete(key); throw error; }
}
async function parseFile(path:string): Promise<Bank | Bank[]> {
  const source = await readFile(path,'utf8');
  const prefix = /window\.CBT_DATA_[A-Z_]+\s*=\s*/.exec(source);
  if (!prefix) throw Error('Unsupported bank format');
  // Only the JSON value from the published, allowlisted bank is read.
  return JSON.parse(source.slice(prefix.index + prefix[0].length).trim().replace(/;$/, ''));
}
@Controller()
export class ContentController {
  @Get('catalogs') catalogs() { return Array.from(banks); }
  @Get('catalogs/:key') catalog(@Param('key') key: string) { return readBank(key); }
  @Get('catalogs/:key/questions/:round/:number')
  async question(@Param('key') key: string, @Param('round') round: string, @Param('number', ParseIntPipe) number: number) {
    const bank = await readBank(key);
    const rounds = [bank].flat().flatMap(b => b.rounds);
    for (const r of rounds) {
      const match = r.questions.find(q => (q._originRoundId ?? r.id) === round && (q._originalNumber ?? q.number) === number);
      if (match) return match;
    }
    const displayed = rounds.find(r => r.id === round)?.questions.find(q => q.number === number);
    if (!displayed) throw new NotFoundException();
    return displayed;
  }
  @Get('models') listModels() { return models(); }
  @Get('models/:kind/file') async modelFile(@Param('kind') kind: string) {
    const registry = await models();
    const entry = Object.hasOwn(registry, kind) && registry[kind];
    if (!entry || !entry.file) throw new NotFoundException();
    return new StreamableFile(await readFile(join(equipment, entry.file)), {type:'model/gltf-binary'});
  }
}
