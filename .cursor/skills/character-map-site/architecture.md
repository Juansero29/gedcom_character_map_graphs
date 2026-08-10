# Architecture — character map

## Flux de démarrage

```
index.html
  → i18n.js (window.t, setLang, formatGedDate, …)
  → graph.js
       DOMContentLoaded:
         initLibrary() → fetch catalog.json + GET /ged
         mergeCatalogWithFiles → renderLibrary
         loadFile(path) → parseGedcom → createGraph → setChapterNarrative
```

## Parse GEDCOM → graphe

`parseGedcom(text)` retourne `{ nodes, links }`.

**Node** (extrait) : `id`, `name`, `sex`, `birth`, `death`, `occupation`, `notes[]`, `quotes[]` (dialogues), `firstMentions[]`, `events[]`, `associations[]`, `familiesAsChild/Spouse`, puis `birthYear` / `birthYearInferred` (inférence via liens famille).

**Link** : `source`, `target`, `relation`, `type` (`family` | `association`), `notes[]`, `citations[]`.

Famille : Parent / Spouse / Sibling (anglais dans le modèle ; affichés via `translateRelation`).

Routage preuves FAM à la construction des liens :
- `1 QUOT` / `1 NOTE` du bloc FAM → lien **Spouse** seulement
- `2 QUOT` / `2 NOTE` sous `1 CHIL @id@` (`childMeta`) → liens **Parent** vers cet enfant
- Sibling : pas de citations couple

ASSO : `relation` = `RELA` du porteur ; UI = « A est RELA de B » (`formatAssocPhrase`).

## createGraph

1. Filtre liens invalides ; déduplique familles en mode layered (`genealogy` / `chrono`).
2. Layered (`genealogy` / `chrono`) : `assignGenerations` + `layoutGenealogyPositions` (composantes famille espacées, unités conjoints, fratries sous parents). Y = génération (`genealogy`) ou année de naissance (`chrono`). `force` : libre. Largeur pastille via canvas `measureText` (évite chevauchements labels).
3. `layoutWidth` élargi en layered ; `treeGap` large entre familles.
4. Forces layered : X→`targetX` fort, Y verrouillé, spouse-only (ASSO ne tirent pas).
5. Paths layered : Spouse barre ; Parent coude orthogonal ; Sibling arc **toujours visible** (comme le reste du sang). `familyTreeComponents` et packing incluent Parent / Spouse / **Sibling** (fratries CHIL-only + `clusterUnitsBySibling`). ASSO dans le DOM mais masqués si filtre `blood` (défaut) sauf focus nœud / filtre `all`|`other`. Au focus : packing conservé + lanes ASSO + pastille focus (pas de fiche, pas d’auto-zoom). Fan radial seulement en layout libre. `restoreFocusNeighborSpread` au clear.
6. Ordre SVG : `links` → `nodes` → `node-labels` ; labels centrés sous le nœud en layered.
7. `enrichLinkTooltips()` sur `.link-hit`.
8. Pas d’auto-zoom : pan / molette / pinch / boutons +/- empilés au-dessus de la légende.

## État global utile

| Variable / clé | Rôle |
|----------------|------|
| `allNodes` / `allLinks` | Données courantes (aussi `window.*`) |
| `lastFocusedNode` / `lastFocusedLink` | Focus épinglé clic |
| `focusScope` (`depth` \| `nucleus`) + `nucleusKind` | Voisinage vs noyau familial |
| `nodeClickTimer` | Diffère le re-clic sur le nœud déjà focusé pour laisser passer le dblclick |
| `currentNarrative` / `currentNarrativeTime` / `activeNarrativeCast` | Frise événements + âges + highlight casting |
| `cm_layout`, `cm_h_spread`, `cm_legend_collapsed`, `cm_library_collapsed` | localStorage |

## Emphasis (survol / focus)

Sur **touch** (viewport type iPhone 17 Pro Max 440×956) : tap court → `focusNode` ; appui long 1 doigt (~420 ms, sans move) → même preview que `mouseenter` (tooltip + voisinage), relâché = `mouseleave` ; pan 1 doigt / pinch → `d3.zoom` (`touch-action: none` sur le SVG) ; pas de drag nœud au doigt. Hit nœud élargi (`.node-hit` r≈22).

- `neighborIdsFor` → voisins 1 saut.
- `emphasizeGraph` / `emphasizeNeighborhood` : opacités + `raise()` (avec `suppressHoverLeave`).
- `restorePersistentEmphasis` : si focus épinglé, le rétablir **selon `focusScope`** ; sinon clear. Appelé au leave d’un voisin (pair-hover) pour ne pas rester coincé sur la cible.
- `rebuildCurrentGraph` : recrée le SVG puis restaure le focus (critique à l’ouverture de la modal).

### Clic vs double-clic (piège)

`focusNode()` remet `focusScope = "depth"`. Sur un nœud déjà focusé :

1. `click` avec `event.detail > 1` → ignorer (laisse `dblclick.nucleus`).
2. Sinon différer via `nodeClickTimer` (~délai double-clic).
3. `dblclick.nucleus` annule le timer, puis bascule nucleus ↔ depth.

Sans ce différé, le premier clic du double-clic détruit le noyau avant le handler dblclick.

## UI panels

- `#modalContainer` : fiche (droite desktop ; plein écran mobile). `closeModal` = hide sheet **sans** clear focus ; `clearGraphSelection` = tap fond.
- `#focusChip` : mobile, quand fiche fermée mais focus actif.
- `#libraryScrim` + `#collapseLibrary` : fermeture tiroir bibliothèque mobile.
- `#narrativePanel` : frise bas du graphe (événements + casting + slider) ; hidden sans `narrative`. `moments[].characters` = ids `@I…@` à highlight.
- `#graphLegend` : bas-droite.
- `#nowPlaying` : bas-gauche (livre / chapitre).

## Serveur

- `GET /ged` → JSON des chemins relatifs sous `public/ged` (et fallback chemin alternatif si configuré).
- Fichiers servis en static ; sur GitHub Pages, pas d’API `/ged` → catalogue seul.
- Les chemins catalogue restent logiques (`/ged/...`) ; `resolveAppUrl` les résout via `document.baseURI` pour GitHub Pages (sous-dossier `/…/public/`).

## i18n

- Dictionnaires `en` / `fr` / `es`.
- `data-i18n`, `data-i18n-placeholder`, `data-i18n-title`, `data-i18n-aria`.
- `window.t(key, { var })` avec `{placeholders}`.
- Dates GED localisées : `formatGedDate` ; lieux FR/ES en `, place` (pas « à »).

## Contrats contenu ↔ UI

Le front attend du catalogue :

- `books[].chapters[].file` absolu type `/ged/.../file.ged`
- optionnel `narrative` (voir skill ged-chapter-author)

Le parseur alimente la fiche : premières mentions, preuves de lien, ages si `currentNarrativeTime` est défini.
