import type {VisualStyle} from '../cbt/storage';

type CharacterTheme = Exclude<VisualStyle, 'default'>;
interface ThemePhoto {
  full: string;
  small: string;
  position: string;
}
function photo(theme: CharacterTheme, file: string, position: string): ThemePhoto {
  const stem = 'assets/theme/' + theme + '/' + file.slice(0, file.lastIndexOf('.'));
  return {full: 'assets/theme/' + theme + '/' + file, small: stem + '-small.webp', position};
}

// Keep focal points with the source image so faces and signs survive narrow crops.
const albums = {
  simpsons: [
    photo('simpsons', 'springfield.webp', '49% 34%'),
    photo('simpsons', 'kwik-e-mart.webp', '54% 22%'),
    photo('simpsons', 'king-size-homer.jpg', '48% 34%'),
    photo('simpsons', 'king-size-homer-bart.jpg', '52% 27%'),
    photo('simpsons', 'king-size-homer-cool.jpg', '44% 38%'),
    photo('simpsons', 'mr-burns-excellent-pink.jpg', '49% 33%'),
    photo('simpsons', 'king-size-homer-phone.jpg', '52% 31%'),
    photo('simpsons', 'king-size-homer-hardhat.jpg', '47% 48%'),
  ],
  sunjae: [
    photo('sunjae', 'wooseok-discovery.webp', '50% 24%'),
    photo('sunjae', 'wooseok-prada.webp', '52% 23%'),
    photo('sunjae', 'sunjae-campus.png', '64% 28%'),
    photo('sunjae', 'sunjae-cherry-capture.jpg', '58% 27%'),
    photo('sunjae', 'wooseok-restaurant-portrait.jpg', '53% 28%'),
    photo('sunjae', 'sunjae-track.png', '62% 24%'),
    photo('sunjae', 'sunjae-smile-capture.jpg', '49% 24%'),
    photo('sunjae', 'wooseok-cafe.jpg', '55% 43%'),
  ],
};

export function roundPhoto(theme: CharacterTheme, id: string): ThemePhoto {
  let hash = 0;
  for (const char of id) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  return albums[theme][hash % albums[theme].length]!;
}

const slots: Record<string, number> = {home: 0, rounds: 1, textbook: 2, history: 3, settings: 4, wrong: 5, school: 6, menu: 1};

export function workspacePhoto(theme: CharacterTheme, section: string, rotation = 0): ThemePhoto {
  const index = slots[section] ?? 7;
  return albums[theme][(index + rotation) % albums[theme].length]!;
}

export function photoStyle(image: ThemePhoto) {
  const url = (path: string) => 'url("' + new URL(path, document.baseURI).href + '")';
  return {'--theme-main-photo': url(image.full), '--theme-small-photo': url(image.small), '--theme-focus': image.position};
}
