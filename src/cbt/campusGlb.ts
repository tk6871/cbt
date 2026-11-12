/** Self-contained GLB only: private previews must never fetch arbitrary dependencies. */
export function validateCampusGlb(bytes: ArrayBuffer): void {
  if (bytes.byteLength < 20 || bytes.byteLength > 50 * 1024 * 1024) throw new Error('50MB 이하 GLB 파일만 사용할 수 있어요.');
  const view = new DataView(bytes);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.byteLength || view.getUint32(16, true) !== 0x4e4f534a) throw new Error('정상적인 GLB 2.0 파일이 아닙니다.');
  const length = view.getUint32(12, true);
  if (length > bytes.byteLength - 20) throw new Error('GLB 헤더가 손상됐어요.');
  const json = JSON.parse(new TextDecoder().decode(bytes.slice(20, 20 + length)));
  for (const resource of [...(json.buffers || []), ...(json.images || [])]) {
    if (resource.uri && !/^data:/i.test(resource.uri)) throw new Error('텍스처가 포함된 단일 GLB로 내보내 주세요. 외부 URL은 허용하지 않습니다.');
  }
}
