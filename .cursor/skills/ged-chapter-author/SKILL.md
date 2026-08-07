---
name: ged-chapter-author
description: >-
  Authore des snapshots GEDCOM narratifs chapitre par chapitre et enregistre
  les livres dans le catalogue du site (catalog.json, .book, narrative).
  À utiliser quand l’utilisateur demande un nouveau .ged, une mise à jour
  jusqu’à un chapitre, des ASSO/FAM avec citations, des premières mentions,
  une frise narrative, ou l’ajout d’un livre/chapitre à la bibliothèque.
---

# Auteur GED / chapitres

Tu produis le **contenu narratif** du site (fichiers `.ged`, `.book`, entrées `catalog.json`), pas l’UI du graphe. Pour le code du site, utiliser le skill `character-map-site`.

## Lecture obligatoire avant d’écrire

1. `prompts/new_ged.prompt` — consignes à jour (langue, preuves, timeline).
2. `public/README.fr.md` — structure GEDCOM narrative.
3. Le `.ged` précédent du même livre (s’il existe) + le `.book` / texte fourni.
4. L’entrée livre/chapitre dans `public/ged/catalog.json`.

## Workflow (checklist)

Copier et cocher au fil de l’eau :

```
- [ ] 1. Périmètre de lecture fixé (prologue + chapitres N, pas plus loin)
- [ ] 2. Texte source en .book sous public/ged/<livre>/
- [ ] 3. Snapshot .ged up-to-chapter-N (ou équivalent) écrit/mis à jour
- [ ] 4. Chaque INDI a ≥1 Première mention (QUOT + TYPE)
- [ ] 5. Chaque ASSO (et FAM si le texte l’établit) a ≥1 2 QUOT verbatim
- [ ] 6. FAM / FAMS / FAMC cohérents ; IDs @I####@ / @F####@
- [ ] 7. catalog.json : chapter file + label + title (+ narrative)
- [ ] 8. i18n blurbs/chapterTitles si besoin (public/i18n.js)
- [ ] 9. Vérif : pas de spoiler hors périmètre ; personnages non dupliqués
```

## Règles dures

- **Anti-spoiler** : ne lire / n’encoder que jusqu’à la fin du chapitre demandé.
- **Langue** : pour *Les Rois maudits* / consignes FR du prompt → NOTE, QUOT, EVEN, RELA, labels portrait **100 % français** (`Traits physiques :`, `Non précisé`, etc.).
- **Sang / famille vs ASSO (exclusif)** :
  - `FAM`/`FAMS`/`FAMC` = seuls liens de sang ou de mariage (époux, parent/enfant, fratrie).
  - `ASSO` = uniquement non-famille (allié, ennemi, conseiller, parrain…).
  - Jamais les deux pour le même lien ; pas d’`ASSO` « Cousin / Oncle / Descendante / Époux… ».
- **Preuves livre** :
  - Relations : `2 QUOT` verbatim sous chaque `ASSO` (et `FAM` si applicable).
  - Apparition : `1 QUOT "…"` + `2 TYPE Première mention` pour **chaque** INDI (y compris ancêtres seulement ancrés par parenté/titre).
  - Dialogues de personnalité = `1 QUOT` **sans** ce TYPE.
- **IDs** : `@I0001@`… et `@F0001@`… (4 chiffres).
- **ASSO** dans le bloc INDI, jamais en fin de fichier orphelin.
- **Une seule occurrence** par personnage dans le fichier.

## Emplacements fichiers

| Élément | Chemin typique |
|--------|----------------|
| Texte | `public/ged/<slug-livre>/<titre>.book` |
| Snapshot | `public/ged/<slug-livre>/up-to-chapter-N.ged` |
| Catalogue | `public/ged/catalog.json` → `books[].chapters[]` |
| Prompt | `prompts/new_ged.prompt` (mettre à jour si nouvelle règle durable) |

## Entrée catalogue (minimum)

```json
{
  "file": "/ged/<slug>/up-to-chapter-N.ged",
  "label": "Prologue & chapitre 1",
  "title": "Titre du chapitre",
  "narrative": {
    "start": "YYYY-MM-DDTHH:mm:ss",
    "end": "YYYY-MM-DDTHH:mm:ss",
    "spanLabel": "Durée réelle dans le récit",
    "location": "Lieu",
    "note": "Caveat si jour/heure inférés",
    "sourceQuote": "Citation qui ancre la datation",
    "moments": [
      { "at": "…", "label": "…", "summary": "…" }
    ]
  }
}
```

`start`/`end` = horloge **narrative** du snapshot. Ne pas inventer de dates qui contredisent le texte.

## Ordre de travail recommandé

1. Lire le périmètre → lister personnages + familles + associations.
2. Mettre à jour le `.ged` (porter l’existant, corriger, enrichir).
3. Ajouter premières mentions + QUOT de relations manquants.
4. Rédiger / ajuster `narrative.moments` d’après le texte.
5. Brancher le chapitre dans `catalog.json` (et blurb livre si nouveau livre).
6. Résumer à l’utilisateur : fichier(s) touchés + éventuelles ambiguïtés du texte.

## Références

- Détail tags & exemples : [ged-conventions.md](ged-conventions.md)
- Exemple *Roi de fer* : `public/ged/les-rois-maudits/le-roi-de-fer/`
