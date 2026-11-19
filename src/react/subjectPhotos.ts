import chiller from './assets/study-hall.webp';

const photos = import.meta.glob<string>('./assets/subjects/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
});

export function subjectPhoto(key: string): string {
  return photos['./assets/subjects/' + key + '.webp'] ?? chiller;
}
