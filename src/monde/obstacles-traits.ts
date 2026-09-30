// The traits a body brings, as the obstacles ask them (docs/mecaniques.md,
// « L'hérédité : les traits »). A stand-in until the traits of the body
// (step 3, traits-corps) give the function of the game: same ids, same rule
// (read on the tree of parts, never given apart), rough thresholds.

import type { NodeDef, Spec } from '../engine';
import type { Trait } from './obstacles';

/** every node of the tree with how many copies of it the body carries */
function eachNode(n: NodeDef, copies: number, f: (n: NodeDef, copies: number) => void): void {
  f(n, copies);
  for (const a of n.attach) {
    const count = a.pattern === 'pair' ? 2 : a.pattern === 'single' ? 1 : a.count * (a.mirror ? 2 : 1);
    eachNode(a.node, copies * count, f);
  }
}

/** the traits of a species, from its tree of parts, each once */
export function traitsOf(sp: Spec): Trait[] {
  const out = new Set<Trait>(), body = sp.body;
  let fin = 0, light = 0, cilia = 0, long = 0;
  eachNode(body, 1, (n, k) => {
    const size = n.links * n.len;
    if (n.role === 'fin' && n !== body) fin += k * size * Math.min(1, n.width / 2 + 0.3);
    if (n.role === 'light' || n.color.glow !== 'none') light += k * Math.max(1, size / 4);
    if (n.role === 'jaw') out.add('pinces');
    if (n.role === 'cilia') cilia += k;
    if (n !== body && (n.role === 'sting' || n.role === 'whip' || n.shape === 'frill') && n.links >= 10) long += k;
  });
  // the larva's little tail and single glowing dot are not yet fins nor a lantern
  if (fin >= 30) out.add('nageoires');
  if (light >= 5 || body.color.glow === 'body') out.add('lanterne');
  if (cilia >= 16) out.add('cils');
  if (long >= 4) out.add('filaments');
  if (body.style === 'plates') out.add('carapace');
  if (body.motion.type === 'pulse' || sp.swim.mode === 'bell') out.add('pulsation');
  // a long and narrow trunk: worms, eels
  if ((body.links * body.len) / Math.max(0.5, body.width) >= 14 && body.links >= 12) out.add('corpsFin');
  return [...out];
}
