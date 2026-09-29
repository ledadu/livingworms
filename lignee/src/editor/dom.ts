// Markup of the workshop, inserted into the page the first time it is opened.
export const ATELIER_HTML = `
  <header class="at-bar">
    <button id="atBack" class="round" type="button" aria-label="Retour">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>
    </button>
    <input id="atName" type="text" maxlength="40" aria-label="Nom de l'espèce">
    <button id="atUndo" class="round" type="button" aria-label="Annuler">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 7L4 12l5 5"/><path d="M4 12h10a6 6 0 0 1 0 12h-2" transform="translate(0 -6)"/></svg>
    </button>
    <button id="atRedo" class="round" type="button" aria-label="Rétablir">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 7l5 5-5 5"/><path d="M20 12H10a6 6 0 0 0 0 12h2" transform="translate(0 -6)"/></svg>
    </button>
    <button id="atPlay" class="cta sm" type="button">Jouer</button>
  </header>
  <div class="at-main">
    <div class="at-stage">
      <canvas id="atCanvas" aria-label="Aquarium : touche une partie pour la sélectionner"></canvas>
      <span id="atMeter" class="meter"></span>
      <span id="atFlash" hidden></span>
      <div class="stage-tools">
        <button type="button" data-mode="swim" aria-pressed="true">Circuit</button>
        <button type="button" data-mode="follow" aria-pressed="false">Guider</button>
        <button type="button" data-mode="pose" aria-pressed="false">Pose</button>
        <span class="sep"></span>
        <button id="atNight" type="button" aria-pressed="false">Nuit</button>
        <button id="atSkel" type="button" aria-pressed="false">Squelette</button>
      </div>
    </div>
    <div class="at-panel">
      <div class="at-tabs" role="tablist">
        <button type="button" role="tab" data-tab="parts" aria-selected="true">Structure</button>
        <button type="button" role="tab" data-tab="species" aria-selected="false">Espèce</button>
        <button type="button" role="tab" data-tab="invent" aria-selected="false">Inventer</button>
        <button type="button" role="tab" data-tab="models" aria-selected="false">Modèles</button>
      </div>
      <div id="atTabParts">
        <div id="atTree" class="tree"></div>
        <div class="tree-actions">
          <button id="atAdd" class="ghost" type="button">+ Ajouter une partie</button>
          <button id="atDup" class="ghost" type="button">Dupliquer</button>
          <button id="atCopy" class="ghost" type="button">Copier</button>
          <button id="atCut" class="ghost" type="button">Couper</button>
          <button id="atPaste" class="ghost" type="button" disabled>Coller</button>
          <button id="atKeep" class="ghost" type="button">Garder</button>
          <button id="atDel" class="ghost danger" type="button">Supprimer</button>
        </div>
        <div id="atProps"></div>
      </div>
      <div id="atTabSpecies" hidden></div>
      <div id="atTabInvent" hidden></div>
      <div id="atTabModels" hidden></div>
    </div>
  </div>
  <div id="atSheet" class="sheet" hidden>
    <div class="sheet-card" role="dialog" aria-labelledby="atSheetTitle">
      <header><h3 id="atSheetTitle"></h3><button id="atSheetClose" class="ghost" type="button">Fermer</button></header>
      <div id="atSheetBody"></div>
    </div>
  </div>
`;
