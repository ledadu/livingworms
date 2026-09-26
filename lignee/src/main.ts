import { Game } from './game/game';
import './style.css';

const canvas = document.getElementById('sea') as HTMLCanvasElement;
const title = document.getElementById('title')!;
const chapter = document.getElementById('chapter')!;

const game = new Game(canvas);
game.start();
(window as unknown as { lignee: Game }).lignee = game;

let chapterTimer = 0;
game.onChapter = (name) => {
  if (!title.hidden) return;
  chapter.textContent = name;
  chapter.classList.remove('show');
  void chapter.offsetWidth;
  chapter.classList.add('show');
  clearTimeout(chapterTimer);
  chapterTimer = window.setTimeout(() => chapter.classList.remove('show'), 4200);
};

title.addEventListener('pointerup', () => {
  title.classList.add('gone');
  window.setTimeout(() => { title.hidden = true; game.onChapter?.(game.mood.name); }, 900);
});

// keep the screen from scrolling or zooming under the fingers
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
