import './atelier.css';
import { ATELIER_HTML } from './dom';
import { createAtelier, type Atelier as AtelierApi, type AtelierContext } from './atelier';

let inst: AtelierApi | null = null;

function ensure(): AtelierApi {
  if (inst) return inst;
  const sec = document.createElement('section');
  sec.id = 'atelier';
  sec.hidden = true;
  sec.innerHTML = ATELIER_HTML;
  document.body.appendChild(sec);
  inst = createAtelier();
  return inst;
}

/** The species workshop. Opens over the game; "Play" hands the edited species to onPlay. */
export const Atelier = {
  open(spec?: unknown, ctx?: AtelierContext): void { ensure().open(spec, ctx); },
  close(): void { inst?.close(); },
  get isOpen(): boolean { return !!inst && inst.isOpen; }
};
export type { AtelierContext };
