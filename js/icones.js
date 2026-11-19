/* Versus · icônes maison (dessinées pour le Versus, aucune bibliothèque, aucun logo)
   Grille 24 × 24, trait 1.9 arrondi, currentColor + une seule couleur d'accent : var(--ic-acc, #9B87FF).
   Usage : ico("turbo") → '<svg class="ic" aria-hidden="true" …>' ; ico("medaille", "or") → class="ic or".
   CSS conseillé : .ic { width: 1.15em; height: 1.15em; vertical-align: -.2em; flex: none; }
                   .ic.or { --ic-acc: var(--gold); } .ic.argent { --ic-acc: #B8C0CC; } .ic.bronze { --ic-acc: #C98A4B; } */
(function () {
  const A = 'style="fill:var(--ic-acc,#9B87FF);stroke:none"';          // aplat d'accent
  const AT = 'style="stroke:var(--ic-acc,#9B87FF)"';                   // trait d'accent
  const P = 'fill="currentColor" stroke="none"';                       // aplat couleur du texte
  const S = c => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + c + "</svg>";

  // roue dentée calculée (8 dents)
  const engrenage = (() => {
    const pt = (a, r) => (12 + r * Math.cos(a * Math.PI / 180)).toFixed(2) + " " + (12 + r * Math.sin(a * Math.PI / 180)).toFixed(2);
    let d = "";
    for (let i = 0; i < 8; i++) {
      const a = i * 45 - 90;
      d += (i ? "L" : "M") + pt(a - 17, 7) + "L" + pt(a - 9, 9.6) + "L" + pt(a + 9, 9.6) + "L" + pt(a + 17, 7);
    }
    return d + "Z";
  })();

  const I = {
    /* --- Podium : onglets --- */
    course: S('<path d="M5 21V3.5"/><path d="M5 4.5h14v9H5"/>' +
      '<path ' + P + ' d="M5 4.5h3.5V7.5H5zM12 4.5h3.5V7.5H12zM8.5 7.5H12v3H8.5zM15.5 7.5H19v3h-3.5zM5 10.5h3.5v3H5zM12 10.5h3.5v3H12z"/>'),
    stand: S('<rect x="3.2" y="5.2" width="10" height="14" rx="2" transform="rotate(-12 8.2 12.2)"/>' +
      '<rect x="9.5" y="4" width="10.5" height="15" rx="2"/><path ' + A + ' d="M14.75 7.6l2.2 3.9-2.2 3.9-2.2-3.9z"/>'),
    ecurie: S('<path d="M1.8 7.6h4.4M3.4 7.6v4.6"/><path d="M3.4 12.2h5.4l1.6-2.4h3l1.4 2.4 7.4 1.4v1.6H3.4"/>' +
      '<circle ' + A + ' cx="11.9" cy="9.6" r="1.25"/><path d="M19.8 17.2h2.6"/>' +
      '<circle ' + P + ' cx="6.2" cy="15.8" r="3.3"/><circle ' + P + ' cx="18" cy="15.8" r="3.3"/>' +
      '<circle cx="6.2" cy="15.8" r="1" stroke-width="1.5" style="stroke:var(--bg,#0D1015)"/><circle cx="18" cy="15.8" r="1" stroke-width="1.5" style="stroke:var(--bg,#0D1015)"/>'),
    trophees: S('<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4.5v1A3.5 3.5 0 0 0 7.6 10.8M17 6h2.5v1a3.5 3.5 0 0 1-3.1 3.8"/>' +
      '<path d="M12 14v3M8.5 20.5h7M9.5 17h5v3.5h-5z"/><path ' + A + ' d="M12 5.6l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2-1.45-1.4 2-.3z"/>'),

    /* --- Les 4 cartes --- */
    turbo: S('<path d="M10 6l6 6-6 6"/><path ' + AT + ' d="M15 6l6 6-6 6"/><path d="M2.5 9h4M3.5 12h3.5M2.5 15h4"/>'),
    aspiration: S('<path d="M2.5 8.5h10a2.8 2.8 0 1 0-2.8-2.8"/><path ' + AT + ' d="M2.5 12.5h15a3 3 0 1 1-3 3"/><path d="M2.5 16.5h6"/>'),
    pluie: S('<circle cx="10.5" cy="13.5" r="7.5"/><circle cx="10.5" cy="13.5" r="5.2" stroke-width="1.6" stroke-dasharray="1.6 2"/>' +
      '<circle ' + P + ' cx="10.5" cy="13.5" r="2"/>' +
      '<path ' + A + ' d="M19 1.8c1.7 2.4 2.8 4 2.8 5.3a2.8 2.8 0 0 1-5.6 0c0-1.3 1.1-2.9 2.8-5.3z"/>'),
    pari: S('<rect x="3.5" y="3.5" width="17" height="17" rx="4"/>' +
      '<circle ' + P + ' cx="8.2" cy="8.2" r="1.5"/><circle ' + A + ' cx="12" cy="12" r="1.7"/><circle ' + P + ' cx="15.8" cy="15.8" r="1.5"/>' +
      '<circle ' + P + ' cx="15.8" cy="8.2" r="1.5"/><circle ' + P + ' cx="8.2" cy="15.8" r="1.5"/>'),

    /* --- Points et bonus --- */
    indice: S('<circle cx="11" cy="13" r="8"/><circle cx="11" cy="13" r="4.2"/><circle ' + A + ' cx="11" cy="13" r="1.7"/>' +
      '<path d="M11 13l8.5-8.5M16.5 4.5h3v3"/>'),
    prono: S('<circle cx="12" cy="10" r="7"/><path d="M7.5 21h9l-1.6-3.8H9.1z"/>' +
      '<path ' + A + ' d="M10.6 5.8l.75 1.8 1.8.75-1.8.75-.75 1.8-.75-1.8-1.8-.75 1.8-.75z"/><path d="M14.5 13.2a3.6 3.6 0 0 0 1.8-2.6"/>'),
    pole: S('<rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><path d="M9.5 17V7.5h3.7a2.9 2.9 0 0 1 0 5.8H9.5"/>' +
      '<path ' + A + ' d="M16.4 3.5h.1a4 4 0 0 1 4 4v.1h-4.1z"/>'),
    defi: S('<path d="M6 21V3.5"/><path ' + A + ' d="M6.95 4.3L19 8.4 6.95 12.5z"/><path d="M3 21h6"/><path d="M14 16.5l2 2 4-4"/>'),
    serie: S('<path d="M12 2.8c.6 3.2 5.4 5.4 5.4 11a5.4 5.4 0 0 1-10.8 0c0-2.4 1.1-4 2.4-5 .1 1.9.9 3 2 3.4-.4-3.3-.3-6.1 1-9.4z"/>' +
      '<path ' + A + ' d="M12 13.2c1.3 1.4 2.3 2.4 2.3 3.8a2.3 2.3 0 0 1-4.6 0c0-1.4 1-2.4 2.3-3.8z"/>'),
    rival: S('<path ' + A + ' d="M5.6 9.2L4.3 3.6l4.3 3.2zM18.4 9.2l1.3-5.6-4.3 3.2z"/><circle cx="12" cy="13.5" r="7.2"/>' +
      '<path d="M8.4 11.2l2.4 1.3M15.6 11.2l-2.4 1.3M9 16.6c1.8 1.2 4.2 1.2 6-.4"/>'),
    regularite: S('<path d="M12 2.8l7.5 3v5.4c0 5-3.2 8.6-7.5 10-4.3-1.4-7.5-5-7.5-10V5.8z"/><path ' + AT + ' d="M8.5 12l2.5 2.5 4.6-5"/>'),
    equipe: S('<circle cx="8.5" cy="8" r="3.2"/><path d="M2.8 19.5c.5-3.6 2.8-5.6 5.7-5.6s5.2 2 5.7 5.6"/>' +
      '<circle ' + A + ' cx="16.5" cy="7.5" r="2.8"/><path ' + AT + ' d="M15.6 13.3c.3 0 .6-.1.9-.1 2.8 0 4.7 2 5.1 5.5"/>'),
    leader: S('<path d="M3.5 8l4.5 4 4-7 4 7 4.5-4-1.8 10.5H5.3z"/><path d="M5.5 21h13"/>' +
      '<circle ' + A + ' cx="12" cy="13.8" r="1.6"/>'),
    coteobscur: S('<path ' + P + ' opacity=".35" d="M12 4.5a7.5 7.5 0 0 0 0 15 5.2 7.5 0 0 0 0-15z"/>' +
      '<circle cx="12" cy="12" r="7.5"/><path ' + A + ' d="M12 4.5a7.5 7.5 0 0 1 0 15 5.2 7.5 0 0 0 0-15z"/>' +
      '<path ' + P + ' d="M19.6 2.6l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z"/>'),
    medaille: S('<path d="M8 2.8l3 6.4M16 2.8l-3 6.4"/><circle ' + A + ' cx="12" cy="15" r="6"/><circle cx="12" cy="15" r="6"/>' +
      '<path d="M12 12.2l.85 1.75 1.9.25-1.4 1.3.35 1.9L12 16.5l-1.7.9.35-1.9-1.4-1.3 1.9-.25z" stroke-width="1.3"/>'),
    diamant: S('<path d="M6.5 4h11L21.5 9 12 20.5 2.5 9z"/><path d="M2.5 9h19M9.5 4L8 9l4 11.5L16 9l-1.5-5"/>' +
      '<path ' + A + ' d="M8.4 9h7.2L12 19.3z"/>'),

    /* --- Course : boutons --- */
    bandeannonce: S('<rect x="3" y="10" width="18" height="10.5" rx="2"/><path d="M3.8 9.6L3.2 6.6l16-3.2.6 3"/>' +
      '<path d="M8 5.6l1.7 2.6M12.6 4.7l1.7 2.6"/><path ' + A + ' d="M10.3 12.8v5l4.3-2.5z"/>'),
    arrivee: S('<path ' + P + ' d="M4 6.2l7 5.8-7 5.8z"/><path ' + A + ' d="M11 6.2l7 5.8-7 5.8z"/><path d="M20.5 6v12"/>'),
    pleinecran: S('<path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15"/>' +
      '<rect ' + A + ' x="9.5" y="9.5" width="5" height="5" rx="1"/>'),
    cartepostale: S('<path d="M3 8.5A2 2 0 0 1 5 6.5h2.3l1.4-2h6.6l1.4 2H19a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>' +
      '<circle cx="12" cy="13" r="3.8"/><circle ' + A + ' cx="12" cy="13" r="1.6"/><circle ' + P + ' cx="17.8" cy="9.4" r="1"/>'),
    vue2d: S('<path d="M3 6.2l5.5-2.2 7 2.2L21 4v13.8L15.5 20l-7-2.2L3 20z"/><path d="M8.5 4v13.8M15.5 6.2V20"/>' +
      '<path ' + AT + ' d="M5.2 15c1.6-1.8 3.3-4 5.4-2.4 1.7 1.4 3.3-1.6 6.2-3.4"/>'),
    vue3d: S('<path d="M12 2.8l8 4.6v9.2l-8 4.6-8-4.6V7.4z"/><path d="M4 7.4l8 4.6 8-4.6M12 12v9.2"/>' +
      '<path ' + A + ' d="M12.95 13.5l6.1-3.5v6l-6.1 3.5z"/>'),

    /* --- Règles, nouveautés, profil --- */
    regles: S('<path d="M12 6.5C9.8 5 6.8 4.5 3.5 5v13.2c3.3-.5 6.3 0 8.5 1.5 2.2-1.5 5.2-2 8.5-1.5V5c-3.3-.5-6.3 0-8.5 1.5z"/>' +
      '<path d="M12 6.5v13.2"/><path ' + AT + ' d="M6.3 9.2c1.4-.1 2.6.1 3.4.5M6.3 12.5c1.4-.1 2.6.1 3.4.5"/>'),
    nouveautes: S('<rect x="4" y="11" width="16" height="9.5" rx="1.5"/><rect x="3" y="7.5" width="18" height="3.5" rx="1"/>' +
      '<path d="M12 7.5v13"/><path ' + AT + ' d="M12 7.3C10.5 4 7 3.6 7 5.6c0 1.6 3 1.9 5 1.7zM12 7.3c1.5-3.3 5-3.7 5-1.7 0 1.6-3 1.9-5 1.7z"/>'),
    portrait: S('<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="12" cy="10" r="3.3"/>' +
      '<path ' + AT + ' d="M6.6 20.3c.8-3 2.8-4.6 5.4-4.6s4.6 1.6 5.4 4.6"/>'),
    reglages: S('<path d="' + engrenage + '"/><circle ' + A + ' cx="12" cy="12" r="3"/>'),

    /* --- Divers fréquents --- */
    verrou: S('<rect x="4.5" y="10.5" width="15" height="10" rx="2.2"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"/>' +
      '<circle ' + A + ' cx="12" cy="15" r="1.6"/><path d="M12 16.3v1.6"/>'),
    rappel: S('<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2H4.5z"/><path d="M10 21h4"/><path ' + A + ' d="M12 2.5a1.4 1.4 0 0 1 1.4 1.4v1.2h-2.8V3.9A1.4 1.4 0 0 1 12 2.5z"/>'),
    etoile: S('<path ' + A + ' d="M12 2.8l2.1 6.1 6.4.2-5.1 3.9 1.8 6.2-5.2-3.6-5.2 3.6 1.8-6.2-5.1-3.9 6.4-.2z"/>' +
      '<path d="M12 2.8l2.1 6.1 6.4.2-5.1 3.9 1.8 6.2-5.2-3.6-5.2 3.6 1.8-6.2-5.1-3.9 6.4-.2z"/>'),
    eclat: S('<path ' + A + ' d="M10 3c.6 4.2 2.3 6 6.5 6.6-4.2.6-5.9 2.4-6.5 6.6-.6-4.2-2.3-6-6.5-6.6C7.7 9 9.4 7.2 10 3z"/>' +
      '<path d="M18 13.5c.3 2 1.2 2.9 3.2 3.2-2 .3-2.9 1.2-3.2 3.2-.3-2-1.2-2.9-3.2-3.2 2-.3 2.9-1.2 3.2-3.2z"/>'),
    hausse: S('<path d="M3.5 20.5h17"/><path ' + AT + ' d="M4 16l5-5 3.5 3.5L19.5 7.5"/><path ' + AT + ' d="M15 7.5h4.5V12"/>'),
    baisse: S('<path d="M3.5 20.5h17"/><path ' + AT + ' d="M4 6.5l5 5 3.5-3.5 7 7"/><path ' + AT + ' d="M15 15h4.5v-4.5"/>'),
    calendrier: S('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>' +
      '<rect ' + A + ' x="13" y="13" width="4" height="4" rx="1"/>'),
    vu: S('<path d="M2.5 12c2.3-4.2 5.6-6.3 9.5-6.3s7.2 2.1 9.5 6.3c-2.3 4.2-5.6 6.3-9.5 6.3S4.8 16.2 2.5 12z"/>' +
      '<circle cx="12" cy="12" r="3.4"/><circle ' + A + ' cx="12" cy="12" r="1.5"/>'),
    chrono: S('<circle cx="12" cy="13.5" r="7.5"/><path d="M10 2.8h4M12 2.8v3.2M18.2 6.6l1.4-1.4"/><path ' + AT + ' d="M12 13.5V9.3M12 13.5l3 1.8"/>')
  };

  const G = typeof self !== "undefined" ? self : globalThis;
  G.ICONES = I;
  // v16.29 : Théo préfère garder les émojis pour l'instant ; passer à true pour afficher les icônes maison
  G.ICONES_ACTIVES = false;
  G.icoOu = function (cle, emoji, classe) { return G.ICONES_ACTIVES && I[cle] ? G.ico(cle, classe) : emoji; };
  G.ico = function (cle, classe) {
    const s = I[cle];
    if (!s) return "";
    return s.replace("<svg ", '<svg class="ic' + (classe ? " " + classe : "") + '" aria-hidden="true" focusable="false" ');
  };
})();
