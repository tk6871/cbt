import manifest from '../../data/responsive-images.json';

type Entry = { width: number; height: number; variants: { src: string; width: number }[] };
const images: Record<string, Entry> = manifest;

// A question's fit-content stage cannot use sizes=auto: its containment fallback
// can collapse intrinsic image width to 300px. Explicit slots keep text readable.
export function responsiveImageAttrs(source: string, sizes = '(max-width: 820px) calc(100vw - 48px), (max-width: 1480px) 46vw, 700px') {
  const image = images[source];
  if (!image) return {};
  return {
    width: image.width,
    height: image.height,
    srcset: [...image.variants.map(v => `${v.src} ${v.width}w`), `${source} ${image.width}w`].join(', '),
    sizes,
  };
}

export function restoreOriginalImage(event: Event): void {
  const image = event.currentTarget as HTMLImageElement;
  // A missing optional derivative must not hide the question. Removing srcset
  // retries the unchanged src URL once, without an error/retry loop.
  if (image.hasAttribute('srcset')) {
    image.removeAttribute('srcset');
    image.removeAttribute('sizes');
  }
}
