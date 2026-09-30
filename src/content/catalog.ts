// ----- catalogue: family, blurb, and where it lives in the game ----- //

export const CATS: [string, string][] = [
  ['poissons', 'Poissons'], ['cnidaires', 'Méduses & cie'], ['crustaces', 'Crustacés'], ['mollusques', 'Mollusques'],
  ['vers', 'Vers'], ['echinodermes', 'Échinodermes'], ['autres', 'Autres'], ['chimeres', 'Chimères']
];

// cat, description, first depth level in the game (120 m each), spawn weight
export const INFO: Record<string, [string, string, number, number]> = {
  anguille:      ['poissons', 'Un fouet vivant : deux tentacules et une nage ondulante.', 0, 2.5],
  poissonClown:  ['poissons', 'Trois bandes blanches et une anémone pour maison.', 0, 2],
  koi:           ['poissons', 'Taches blanches, barbillons et nageoires voilées.', 0, 1.5],
  hippocampe:    ['poissons', 'Queue enroulée en spirale ; c\'est le mâle qui porte les œufs.', 0, 1.5],
  combattant:    ['poissons', 'Un voile de nageoires démesuré qui flotte derrière lui.', 1, 1.5],
  poissonLion:   ['poissons', 'Nageoires en éventail rayé et épines venimeuses.', 2, 2],
  manta:         ['poissons', 'Vole sous l\'eau en ondulant de grandes ailes.', 2, 1],
  requinBaleine: ['poissons', 'Le plus grand poisson, constellé de taches blanches.', 2, 0.8],
  dragonFeuillu: ['poissons', 'Camouflé en algue par ses appendices en feuilles.', 3, 1.2],
  grandGosier:   ['poissons', 'Une bouche immense et une queue-fouet lumineuse.', 3, 1.5],
  baudroie:      ['poissons', 'Chasse dans le noir avec un leurre lumineux.', 3, 2],
  meduse:        ['cnidaires', 'Une ombrelle qui pulse et un voile de filaments urticants.', 1, 3],
  chrysaora:     ['cnidaires', 'Méduse ortie : ombrelle rayée et longs bras plissés.', 2, 2],
  anemone:       ['cnidaires', 'Deux couronnes de tentacules qui ondulent au ralenti.', 1, 1.5],
  ctenophore:    ['cnidaires', 'Ses rangées de palettes diffractent la lumière en arc-en-ciel.', 1, 1.5],
  physalie:      ['cnidaires', 'Galère portugaise : un flotteur et des filaments interminables.', 1, 1.2],
  siphonophore:  ['cnidaires', 'Une colonie : des cloches qui nagent et des polypes qui pêchent.', 2, 1.2],
  meduseBoite:   ['cnidaires', 'Quatre bouquets de filaments parmi les plus venimeux.', 3, 1.5],
  crevette:      ['crustaces', 'Antennes deux fois plus longues que le corps.', 0, 3],
  krill:         ['crustaces', 'Minuscule et lumineux : ses photophores brillent dans le bleu.', 0, 2],
  copepode:      ['crustaces', 'Le plus abondant des animaux : grandes antennes et sacs d\'œufs.', 0, 2],
  crabe:         ['crustaces', 'Huit pattes articulées et deux pinces en avant.', 0, 2],
  homard:        ['crustaces', 'Homard bleu : pinces massives et carapace tachetée.', 2, 1.5],
  crevetteMante: ['crustaces', 'Frappe avec ses pattes ravisseuses aussi vite qu\'une balle.', 2, 1.5],
  calmar:        ['mollusques', 'Nage à réaction ; deux tentacules en massue.', 2, 2.5],
  poulpe:        ['mollusques', 'Huit bras reliés par une membrane, couverts de ventouses.', 3, 2],
  seiche:        ['mollusques', 'Sa nageoire en collerette ondule tout autour du manteau.', 1, 1.5],
  nautile:       ['mollusques', 'Une coquille en spirale logarithmique vieille de 500 millions d\'années.', 3, 1],
  clione:        ['mollusques', 'Ange de mer : nage en battant deux petites ailes.', 1, 1.5],
  nudibranche:   ['mollusques', 'Ses cérates stockent le venin des méduses qu\'il mange.', 1, 2],
  larve:         ['vers', 'Le premier stade de beaucoup d\'animaux marins.', 0, 4],
  plumeau:       ['vers', 'Filtre l\'eau avec une couronne de plumes.', 1, 1.2],
  verDeFeu:      ['vers', 'Ses soies urticantes brûlent au moindre contact.', 2, 1.5],
  verPlat:       ['vers', 'Un tapis ondulant bordé de couleur.', 1, 1.5],
  serpentCilie:  ['vers', 'Hommage à test-patte.json : des cils qui battent en vague.', 2, 1.5],
  etoile:        ['echinodermes', 'Cinq bras qui rampent lentement.', 0, 1.5],
  ophiure:       ['echinodermes', 'Bras fins qui ondulent comme des serpents.', 2, 1.5],
  oursin:        ['echinodermes', 'Une boule de piquants qui bougent lentement.', 2, 1.2],
  axolotl:       ['autres', 'Garde ses branchies plumeuses toute sa vie.', 0, 1.2],
  tortue:        ['autres', 'Quatre nageoires et une carapace en écailles.', 1, 1],
  tardigrade:    ['autres', 'Huit pattes griffues, et survit presque à tout.', 0, 1],
  hydre:         ['chimeres', 'Tentacules à dards et épines lumineuses.', 4, 1.5],
  dragonAbyssal: ['chimeres', 'Ocelles, barbillons lumineux et crête palmée.', 4, 1.2]
};
