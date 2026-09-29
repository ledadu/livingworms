// Labels shown by the workshop for every choice a species definition offers.

export const NAMES = {
  shape: {
    constant: 'Constant', linear: 'Pointe', worm: 'Ver', virgule: 'Virgule', sansue: 'Sangsue',
    sansueBigHead: 'Grosse tête', bloby: 'Blob', spindle: 'Fuseau', tadpole: 'Têtard', leaf: 'Feuille',
    bell: 'Cloche', carapace: 'Carapace', frill: 'Volant', club: 'Massue', bulb: 'Bulbe', gourd: 'Gourde'
  },
  style: { ribbon: 'Ruban', plates: 'Plaques', line: 'Trait', disc: 'Perles', eye: 'Œil' },
  motion: {
    none: 'Aucun', wave: 'Battement', row: 'Rame', flutter: 'Frémissement', pulse: 'Pulsation',
    breathe: 'Respiration', undulate: 'Ondulation', curl: 'Enroulement', recoil: 'Recul (jets)'
  },
  pattern: { single: 'Seul', pair: 'Paire', fan: 'Éventail', series: 'Série', ring: 'Anneau' },
  motif: { none: 'Uni', bands: 'Bandes', spots: 'Taches', stripe: 'Ligne', ocelli: 'Ocelles', edge: 'Liseré' },
  harmony: { analog: 'Analogue', complement: 'Complément', triad: 'Triade', split: 'Divisée', mono: 'Mono' },
  swim: { steady: 'Régulière', pulse: 'Par pulsations', dart: 'Par à-coups', bell: 'Cloche (méduse)', jet: 'Par jets (poulpe)', crawl: 'Marche au sol' },
  ai: { hunter: 'Curieux', prey: 'Craintif', drifter: 'Dériveur' },
  glow: { none: 'Aucune', tip: 'Au bout', body: 'Partout' },
  role: {
    body: 'Corps', whip: 'Fouet', sting: 'Dard', jaw: 'Pince', fin: 'Nageoire',
    cilia: 'Cils', light: 'Lanterne', sense: 'Antenne', deco: 'Décor'
  }
} as const;

/** what a part is good for; in La Lignée these become the traits a lineage passes on */
export const ROLE_HELP: Record<string, string> = {
  body: 'Le tronc : c\'est lui qui porte toutes les autres parties.',
  whip: 'Un fouet : il claque et lui donne de l\'élan.',
  sting: 'Un dard : pique ce qui le touche.',
  jaw: 'Une pince : saisit et déplace ce qu\'elle attrape.',
  fin: 'Chaque copie aide à nager plus vite.',
  cilia: 'Des cils : chaque copie rend la nage plus douce.',
  light: 'Une lanterne : éclaire les eaux sombres autour d\'elle.',
  sense: 'Une antenne : perçoit plus loin.',
  deco: 'Pour la beauté : aucun effet.'
};

export const AI_HELP: Record<string, string> = {
  hunter: 'Vient voir de près et tourne autour de ce qui l\'intéresse.',
  prey: 'Craintive : s\'écarte quand on s\'approche.',
  drifter: 'Se laisse porter par le courant.'
};
