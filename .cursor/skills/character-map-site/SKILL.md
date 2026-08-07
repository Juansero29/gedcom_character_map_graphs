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

## Carte des fichiers

| Fichier | Rôle |
|---------|------|
| `public/graph.js` | Parse GEDCOM, simulation D3, focus/hover, fiche, bibliothèque, frise |
| `public/index.html` | Shell UI (sidebar, topbar, modal, légende, narrative panel) |
| `public/styles.css` | Design tokens, fiche, légende, chronologie |
| `public/i18n.js` | Chaînes UI + helpers date/chapitre |
| `public/ged/catalog.json` | Livres, chapitres, `narrative` |
| `server.js` | Liste `/ged` + static + chemins dual public/ged |

## Principes UX déjà en place

- **Bibliothèque** collapsible : livres → snapshots chapitre.
- **Paramètres** : popup bas de bibliothèque (sous README) — langue, layout `genealogy` / `chrono` / `force` (`cm_layout` ; ancien `hierarchy` → `chrono`), étalement `cm_h_spread`.
- **Filtres** : popup topbar (`cm_graph_filters`) — recherche, profondeur de parenté, type de liens (`all` / `blood` / `other`), sexe, années de naissance, vivants/décédés, première mention livre. Clic nœud/lien prioritaire : reset filtres + profondeur 1 (voisins directs).
- **Fiche** : bouton « noyau familial » → surbrillance parents / enfants / fratrie (sans conjoints ni ASSO) ; toggle pour revenir au voisinage selon la profondeur.
- **Profondeur** : modes `upto` (≤ N) / `exact` (= N) / `all` (tous les liens de sang, tout degré) ; `cm_link_depth` + `cm_link_depth_mode`.
- **Liens** : famille = trait rouge plein ; ASSO = pointillé gris + **hit-path** large invisible.
- **Survol** : voisinage (lignée ≤ profondeur) + `raise()` ; **clic** : fiche + focus épinglé de la lignée (survivre au resize/rebuild).
- **Fiche** : section **Relations** (recherche par nom + sous-sections sang / ASSO, labels bi explicites).
- **Légende** bas-droite, repliable (`cm_legend_collapsed`).
- **Temps narratif** : si `chapter.narrative` dans le catalogue → slider + âges ; panneau repliable (`cm_narrative_collapsed`), comme la légende.

## Règles de modif

1. Lire le code existant autour du point de changement avant d’éditer.
2. Préserver i18n : toute nouvelle chaîne UI → `en` / `fr` / `es` dans `i18n.js` + `data-i18n*` si besoin.
3. Ne pas casser le parseur GED sans mettre à jour `ged-chapter-author` / README si le contrat change.
4. Focus clic vs hover : `lastFocusedNode` / `restorePersistentEmphasis` / `rebuildCurrentGraph` doivent rester cohérents (ouverture modal → resize).
5. Éviter les rebuilds inutiles ; si rebuild, réappliquer le focus.

## Points d’extension fréquents

- **Nouveau contrôle UI** : topbar dans `#graphContainer` (pas par-dessus la modal).
- **Nouveau champ GED** : `parseGedcom` → modèle nœud → `renderPersonProfile` / labels.
- **Chronologie** : consommer `narrative` via `setChapterNarrative` / `findChapterNarrative` ; ne pas hardcoder un livre dans `graph.js`.
- **Perf graphe** : forces, collide (rayon lié à la longueur du nom), fit zoom en fin de simulation.

## Vérifications manuelles

- Charger *Le Roi de fer* ch.1 : graphe, légende, slider narratif, âges.
- Clic nœud → fiche + dim des non-voisins ; fermer → reset.
- Survol ASSO pointillé cliquable ; layout Généalogique / Chronologique / Libre ; étalement.
- Changer langue : libellés UI + dates.

## Référence détaillée

Voir [architecture.md](architecture.md) pour le flux de données, le parseur et les APIs internes.
