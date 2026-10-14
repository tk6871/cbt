import manifest from '../../data/responsive-images.json';

type Entry = { width: number; height: number; variants: { src: string; width: number }[] };
const images: Record<string, Entry> = manifest;

// Theme decoration only. Problem and explanation images always use originals.
export function responsiveImageAttrs(source: string, sizes = '64px') {
  if (!source.startsWith('assets/theme/')) return {};
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
