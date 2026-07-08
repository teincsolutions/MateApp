export function uuidv4(): string {
  const hex = '0123456789abcdef';
  const rnd = () => hex[Math.floor(Math.random() * 16)];
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
    .replace(/x/g, rnd)
    .replace(/y/g, () => hex[(Math.floor(Math.random() * 4) + 8)]);
}
