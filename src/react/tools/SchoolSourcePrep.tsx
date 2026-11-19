import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import Cropper from 'cropperjs';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import './school-source.css';

export default function SchoolSourcePrep({onClose}: {onClose: () => void}) {
  const input = useRef<HTMLInputElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const cropper = useRef<Cropper | null>(null);
  const documentTask = useRef<PDFDocumentLoadingTask | null>(null);
  const pdf = useRef<PDFDocumentProxy | null>(null);
  const render = useRef<RenderTask | null>(null);
  const revision = useRef(0);
  const url = useRef('');
  const fileName = useRef('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [number, setNumber] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState('사진이나 PDF에서 필요한 문제와 보기를 선택하세요.');

  function releaseImage() {
    cropper.current?.destroy();
    cropper.current = null;
    stage.current?.replaceChildren();
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = '';
  }
  function releaseDocument() {
    render.current?.cancel();
    render.current = null;
    void documentTask.current?.destroy().catch(() => {});
    documentTask.current = null;
    pdf.current = null;
  }
  useEffect(() => () => { ++revision.current; releaseDocument(); releaseImage(); }, []);

  async function showImage(blob: Blob, name: string, ticket: number) {
    if (revision.current !== ticket) return;
    releaseImage();
    url.current = URL.createObjectURL(blob);
    const image = new Image();
    image.alt = '자를 학교 시험 자료';
    image.src = url.current;
    await image.decode();
    if (revision.current !== ticket || !stage.current) return;
    stage.current.replaceChildren(image);
    cropper.current = new Cropper(image, {container: stage.current});
    const selection = cropper.current.getCropperSelection();
    if (selection) {
      selection.tabIndex = 0;
      selection.setAttribute('role', 'group');
      selection.setAttribute('aria-label', '자를 영역. 방향키로 이동, 더하기와 빼기로 크기 조절');
      selection.addEventListener('keydown', event => {
        const delta:Record<string, [number, number]> = {ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
        if (delta[event.key]) {
          event.preventDefault();
          const [x,y] = delta[event.key];
          selection.$move(x * (event.shiftKey ? 8 : 1), y * (event.shiftKey ? 8 : 1));
        } else if (['+', '=', '-'].includes(event.key)) {
          event.preventDefault();
          const factor = event.key === '-' ? -.05 : .05;
          selection.$resize('se-resize', selection.width * factor, selection.height * factor);
        }
      });
    }
    fileName.current = name;
    setReady(true);
  }
  async function showPage(doc: PDFDocumentProxy, requested: number, ticket: number) {
    const current = Math.max(1, Math.min(doc.numPages, Math.trunc(requested) || 1));
    const page = await doc.getPage(current);
    if (revision.current !== ticket) return;
    const size = page.getViewport({scale:1});
    const viewport = page.getViewport({scale: Math.min(2, 3000 / Math.max(size.width, size.height))});
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    render.current = page.render({canvas, viewport});
    await render.current.promise;
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw Error('empty page');
    await showImage(blob, 'school-pdf-page-' + current + '.png', ticket);
    if (revision.current !== ticket) return;
    setNumber(current);
    setPageInput(String(current));
    setMessage(current + '/' + doc.numPages + '쪽입니다. 드래그하거나 방향키와 +, − 키로 저장할 영역을 조절하세요.');
  }
  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    const ticket = ++revision.current;
    releaseDocument(); releaseImage();
    setBusy(true); setReady(false); setCount(0); setNumber(1); setPageInput('1');
    try {
      if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
        const [pdfjs, worker, bytes] = await Promise.all([
          import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url'), file.arrayBuffer()
        ]);
        if (ticket !== revision.current) return;
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        documentTask.current = pdfjs.getDocument({data:bytes});
        const doc = await documentTask.current.promise;
        if (ticket !== revision.current) return;
        pdf.current = doc; setCount(doc.numPages);
        await showPage(doc, 1, ticket);
      } else {
        await showImage(file, file.name.replace(/\.[^.]+$/, '') + '-crop.png', ticket);
        if (ticket === revision.current) setMessage('문제와 보기가 모두 들어오도록 영역을 선택하세요.');
      }
    } catch {
      if (ticket === revision.current) setMessage('파일을 열지 못했습니다. 파일 형식이나 PDF 암호를 확인해 주세요.');
    } finally { if (ticket === revision.current) setBusy(false); }
  }
  async function go(requested: number) {
    if (busy || !pdf.current) return;
    const ticket = ++revision.current;
    setBusy(true); setReady(false);
    try { await showPage(pdf.current, requested, ticket); }
    catch { if (ticket === revision.current) setMessage('이 쪽을 열지 못했습니다. 다른 쪽을 선택해 주세요.'); }
    finally { if (ticket === revision.current) setBusy(false); }
  }
  async function save() {
    const selection = cropper.current?.getCropperSelection();
    if (!selection) return;
    const ticket = revision.current;
    try {
      const canvas = await selection.$toCanvas({width:Math.min(2400, Math.max(600, selection.width * 2))});
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw Error('empty selection');
      if (ticket !== revision.current) return;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob); link.download = fileName.current; link.click();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      setMessage('선택한 영역을 PNG로 저장했습니다.');
    } catch { if (ticket === revision.current) setMessage('선택 영역을 저장하지 못했습니다. 다시 시도해 주세요.'); }
  }
  return <section className="school-source-prep">
    <header><div><strong>사진·PDF 문제 자르기</strong><small>문제와 보기를 한 장으로 저장</small></div><button onClick={onClose}>닫기</button></header>
    <div className="school-source-actions"><button onClick={() => input.current?.click()}>{busy ? '다른 파일 선택' : '사진·PDF 선택'}</button>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.pdf" hidden onChange={selectFile}/>
      {ready && <><button onClick={() => {cropper.current?.getCropperSelection()?.$reset(); setMessage('선택 영역을 초기화했습니다.');}}>영역 초기화</button>
      <button className="primary" onClick={save}>선택 영역 저장</button></>}
    </div>
    {count > 1 && <div className="school-pdf-pages"><button disabled={busy || number <= 1} onClick={() => go(number - 1)}>이전 쪽</button>
      <form onSubmit={e => {e.preventDefault(); void go(Number(pageInput));}}><label>PDF 쪽 <input type="number" min="1" max={count} required value={pageInput} disabled={busy}
        onChange={e => setPageInput(e.target.value)}/> / {count}쪽</label> <button disabled={busy}>이동</button></form>
      <button disabled={busy || number >= count} onClick={() => go(number + 1)}>다음 쪽</button></div>}
    <div ref={stage} className="school-crop-stage" hidden={!busy && !ready}/>
    {!busy && !ready && <div className="school-source-empty"><strong>원본은 현재 기기에서만 엽니다</strong></div>}
    <p role="status">{busy ? '파일을 준비하는 중…' : message}</p>
  </section>;
}
