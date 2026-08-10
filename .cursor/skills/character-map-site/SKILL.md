---
name: character-map-site
description: >-
  Développe et maintient l’app de cartographie de personnages GEDCOM (Express,
  D3, i18n, bibliothèque, layouts, fiche, frise narrative, survol/focus).
  À utiliser pour modifier graph.js, index.html, styles.css, i18n.js, server.js,
  le rendu du graphe, les interactions, ou toute feature UI du site — pas pour
  rédiger le contenu littéraire des .ged (voir ged-chapter-author).
---

# Développeur site — character map

Tu es le **développeur produit** de ce dépôt : architecture, graphe D3, UX. Le contenu des livres (`.ged` / catalogue narratif) relève du skill `ged-chapter-author`.

## Stack & lancement

- **Serveur** : `server.js` (Express) — API `GET /ged` (liste des fichiers) **avant** `express.static` sur `public/`.
- **Front** : `public/index.html` + `graph.js` + `styles.css` + `i18n.js` (EN/FR/ES).
- **Données** : `public/ged/**/*.ged`, `catalog.json`, éventuellement `.book`.
- Lancer : `node server.js` → http://localhost:3000/
- Après modif de `graph.js` : **incrémenter** le cache-bust `graph.js?v=…` dans `index.html` (sinon le navigateur sert l’ancien JS).

## Carte des fichiers

| Fichier | Rôle |
|---------|------|
| `public/graph.js` | Parse GEDCOM, simulation D3, focus/hover, fiche, bibliothèque, frise |
| `public/index.html` | Shell UI (sidebar, topbar, modal, légende, narrative panel) |
| `public/styles.css` | Design tokens, fiche, légende, chronologie |
| `public/i18n.js` | Chaînes UI + helpers date/chapitre |
| `public/ged/catalog.json` | Livres, chapitres, `narrative` |
| `server.js` | Liste `/ged` + static + chemins dual public/ged |
| `scripts/*.mjs` | QA visuelle / tactile optionnelle (overlaps, iPhone touch, pair-hover) |

## Principes UX déjà en place

- **Bibliothèque** collapsible : livres → snapshots chapitre ; ouvrir un chapitre referme la sidebar automatiquement.
- **Aide (?)** : popup bas de bibliothèque (au-dessus des Paramètres) — guide court des contrôles (graphe, tactile, filtres, légende, temps narratif).
- **Paramètres** : popup bas de bibliothèque (sous l’aide) — langue, layout `genealogy` / `chrono` / `force` (`cm_layout` ; ancien `hierarchy` → `chrono`), étalement `cm_h_spread`.
- **Filtres** : popup topbar (`cm_graph_filters`) — recherche, profondeur de parenté, type de liens (`blood` défaut / `all` / `other`), sexe, années de naissance, vivants/décédés, première mention livre. Clic nœud/lien prioritaire : reset filtres + profondeur 1 (voisins directs).
- **Fiche** : bouton « noyau familial » → surbrillance parents / enfants / fratrie (sans conjoints ni ASSO) ; toggle pour revenir au voisinage selon la profondeur. Fermer la fiche **garde** le focus / noyau ; sur mobile (≤900px) activer le noyau ferme la fiche pour montrer le graphe + barre « Ouvrir la fiche ». Tap fond vide = reset.
- **Profondeur** : modes `upto` (≤ N) / `exact` (= N) / `all` (tous les liens de sang, tout degré) ; `cm_link_depth` + `cm_link_depth_mode`.
- **Liens** : famille = trait rouge plein ; ASSO = pointillé gris + **hit-path**. Défaut = sang seulement ; ASSO visibles si filtre `all`/`other`, ou au **clic nœud** (ASSO de ce personnage). Layouts **généalogique** et **chronologique** : packing familles espacé selon la **largeur réelle des pastilles** (canvas `measureText`), pas de compression dans le viewport — le graphe s’élargit, pan/zoom pour explorer ; coudes orthogonaux parent/époux ; **arcs Sibling toujours visibles** (comme Parent/Spouse) — fratries regroupées via `familyTreeComponents` + `clusterUnitsBySibling` même sans parents dans le FAM. Ne pas re-masquer les Sibling « jusqu’au survol ».
- **Clic / double-clic** : clic → focus voisinage (sang + ASSO) + pastille fiche — **sans** ouvrir la fiche ni auto-zoom. Double-clic → noyau familial ; second double-clic = retour voisinage. **Critique** : `focusNode` remet `focusScope` à `"depth"` — donc sur le nœud déjà focusé, différer le clic (`setTimeout`) et ignorer `event.detail > 1` ; annuler le timer sur `dblclick` / clear. Sinon le premier clic du double-clic casse le noyau.
- **Survol** : voisinage (lignée ≤ profondeur) + `raise()` ; survol d’un voisin en focus → relation ego↔cible ; au leave, `restorePersistentEmphasis` (ne pas laisser le graphe « collé » sur le voisin). Fiche seulement via la pastille. Pas d’auto-zoom. En layout **libre** : fan radial optionnel (sans zoom).
- **Fiche** : section **Relations** (recherche par nom + sous-sections sang / ASSO, labels bi « A est X de B »). Preuves sang : `1 QUOT` FAM → époux seulement ; `2 QUOT` sous `CHIL` → parent↔enfant ; dédup des citations identiques dans la liste sang.
- **ASSO** : `RELA` = rôle du **porteur** de l’ASSO (pas de la cible). Documenté dans `ged-chapter-author`.
- **Légende** bas-droite, repliable (`cm_legend_collapsed`) ; boutons **+/-** empilés **au-dessus** de la légende (zoom manuel uniquement — pas d’auto-zoom à l’ouverture).
- **Frise du chapitre** : si `chapter.narrative` dans le catalogue → timeline d’événements (`moments[]` avec `characters`) + highlight du casting **seulement tant que la frise est ouverte** (prev/next / jalons) ; bouton **Fermer** (ou replier la pastille / Échap) → `releaseNarrativeFriseHighlight` (exploration libre) ; slider pour le temps narratif / âges ; panneau repliable (`cm_narrative_collapsed`).
- **Mobile** : fiche plein écran ; fermer ≠ clear focus ; pastille focus aussi sur desktop ; noyau → ferme la fiche + pastille ; bibliothèque = tiroir + scrim / ✕. Graphe tactile : tap = focus voisinage (pas de fiche) ; appui long = survol ; pan/pinch = zoom manuel uniquement.

## Règles de modif

1. Lire le code existant autour du point de changement avant d’éditer.
2. Préserver i18n : toute nouvelle chaîne UI → `en` / `fr` / `es` dans `i18n.js` + `data-i18n*` si besoin.
3. Ne pas casser le parseur GED sans mettre à jour `ged-chapter-author` (conventions + QA) / README si le contrat change — surtout routage FAM `1 QUOT` vs `2 QUOT` sous `CHIL`, et phrase ASSO « A est RELA de B ».
4. Focus clic vs hover : `lastFocusedNode` / `focusScope` / `restorePersistentEmphasis` / `rebuildCurrentGraph` doivent rester cohérents (ouverture modal → resize ; leave voisin → focus).
5. Éviter les rebuilds inutiles ; si rebuild, réappliquer le focus **et** le `focusScope` (depth vs nucleus).
6. Cache-bust `graph.js?v=` à chaque livrable JS visible en local/prod static.

## Points d’extension fréquents

- **Nouveau contrôle UI** : topbar dans `#graphContainer` (pas par-dessus la modal).
- **Nouveau champ GED** : `parseGedcom` → modèle nœud → `renderPersonProfile` / labels.
- **Chronologie** : consommer `narrative` via `setChapterNarrative` / `findChapterNarrative` ; ne pas hardcoder un livre dans `graph.js`.
- **Perf graphe** : forces, collide (rayon lié à la longueur du nom), fit zoom en fin de simulation.
- **QA visuelle** : `scripts/check-label-overlaps.mjs`, `scripts/test-iphone-touch.mjs`, `scripts/test-pair-hover-leave.mjs`, `scripts/analyze-graph.mjs` (Playwright / captures sous `tmp-graph-analysis/`).

## Vérifications manuelles

- Charger *Le Roi de fer* ch.1 puis un snapshot récent (ex. ch.6) : graphe, légende, frise (événements + casting highlight), slider âges.
- Fratries visibles en genealogy/chrono sans survol ; placeholders type Parent Tolomei regroupés avec la fratrie.
- Clic nœud → focus + pastille (pas de fiche auto) ; fermer la fiche → focus conservé ; tap fond vide → reset.
- Double-clic → noyau ; second double-clic → voisinage ; ne doit pas « flasher » depth entre les deux clics.
- Survol ASSO pointillé cliquable ; leave voisin en focus → retour emphasis ego ; layout Généalogique / Chronologique / Libre ; étalement.
- Mobile (≤900px) : fiche plein écran ; noyau familial → ferme la fiche, garde l’effet, barre pour rouvrir ; bibliothèque = tiroir + scrim / ✕ ; narratif/légende en bas, collapse par défaut.
- Changer langue : libellés UI + dates.
- Hard-refresh ou bump `?v=` après edit `graph.js`.

## Référence détaillée

Voir [architecture.md](architecture.md) pour le flux de données, le parseur et les APIs internes.
