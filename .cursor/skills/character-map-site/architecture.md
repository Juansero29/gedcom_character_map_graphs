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

## createGraph

1. Filtre liens invalides ; déduplique familles en mode hierarchy.
2. `layoutWidth = viewportWidth * horizontalSpread`.
3. Forces D3 selon mode ; tick clamp X/Y ; paths pour liens + `link-hit`.
4. Labels : groupe `node-label-group` + `rect.node-label-bg` opaque.
5. `enrichLinkTooltips()` sur `.link-hit`.
6. Fin de simulation → zoom fit (privilégie la hauteur pour la lisibilité).

## État global utile

| Variable / clé | Rôle |
|----------------|------|
| `allNodes` / `allLinks` | Données courantes (aussi `window.*`) |
| `lastFocusedNode` / `lastFocusedLink` | Focus épinglé clic |
| `currentNarrative` / `currentNarrativeTime` | Frise + âges |
| `cm_layout`, `cm_h_spread`, `cm_legend_collapsed`, `cm_library_collapsed` | localStorage |

## Emphasis (survol / focus)

- `neighborIdsFor` → voisins 1 saut.
- `emphasizeGraph` / `emphasizeNeighborhood` : opacités + `raise()` (avec `suppressHoverLeave`).
- `restorePersistentEmphasis` : si focus épinglé, le rétablir ; sinon clear.
- `rebuildCurrentGraph` : recrée le SVG puis restaure le focus (critique à l’ouverture de la modal).

## UI panels

- `#modalContainer` : fiche (droite desktop / bas mobile). z-index au-dessus du graphe ; topbar **dans** `#graphContainer`.
- `#narrativePanel` : chronologie bas-centre ; hidden sans `narrative`.
- `#graphLegend` : bas-droite.
- `#nowPlaying` : bas-gauche (livre / chapitre).

## Serveur

- `GET /ged` → JSON des chemins relatifs sous `public/ged` (et fallback chemin alternatif si configuré).
- Fichiers servis en static ; sur GitHub Pages, pas d’API `/ged` → catalogue seul.

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
