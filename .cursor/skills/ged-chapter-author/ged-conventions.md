# Conventions GED narrative (référence)

## INDI minimal

```
0 @I0001@ INDI
1 NAME Prénom /Nom/
1 SEX M
1 BIRT
2 DATE 1268
2 PLAC Lieu
1 OCCU …
1 QUOT "Première identification dans le livre."
2 TYPE Première mention
1 NOTE Portrait en une phrase.
2 CONT Traits physiques : …
2 CONT Traits mentaux : …
2 CONT Rôle : …
2 CONT Opinions politiques : …
2 CONT Actions décisives principales : …
1 EVEN
2 TYPE …
2 DATE MAR 1314
2 PLAC …
2 NOTE …
1 ASSO @I0009@
2 RELA …
2 NOTE …
2 QUOT "Preuve verbatim."
1 FAMS @F0001@
1 FAMC @F0002@
```

## Citations

| Usage | Forme |
|-------|--------|
| Première apparition | `1 QUOT "…"` + `2 TYPE Première mention` |
| Réplique / pensée | `1 QUOT "…"` (sans TYPE Première mention) |
| Preuve de relation | sous ASSO/FAM : `2 QUOT "…"` |
| Continuité longue | `2 CONT` / `3 CONT` ou `CONC` selon niveau |

## FAM

```
0 @F0001@ FAM
1 HUSB @I0001@
1 WIFE @I0002@
1 CHIL @I0003@
1 NOTE …
1 QUOT "Preuve textuelle du lien familial si le livre l’établit."
```

## HEAD

```
0 HEAD
1 SOUR Titre du livre
1 GEDC
2 VERS 5.5
1 CHAR UTF-8
```

## Ce que le parser du site comprend (graph.js)

- INDI : NAME, SEX, BIRT/DEAT, OCCU, NOTE(+CONT), QUOT(+TYPE/CONT), EVEN(+TYPE/DATE/PLAC/NOTE/QUOT), ASSO(+RELA/NOTE/QUOT), FAMC/FAMS
- QUOT avec `TYPE Première mention` → `person.firstMentions` (hors liste des citations dialogue)
- ASSO.citations + FAM.citations → preuves dans la fiche de lien
- Dates GED (`1268`, `ABT 1270`, `13 NOV 1312`, `MAR 1314`, `BET … AND …`) pour âges narratifs

## Nouveau livre

1. Dossier `public/ged/<id>/`
2. `.book` source + un ou plusieurs `.ged`
3. Objet dans `catalog.json` : `id`, `title`, `series?`, `author?`, `blurb`, `chapters[]`
4. Optionnel : clés `blurbs` / `chapterTitles` dans `public/i18n.js` (en/fr/es)
