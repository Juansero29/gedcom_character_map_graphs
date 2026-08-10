# Conventions GED narrative (référence)

## INDI minimal

```
0 @I0001@ INDI
1 NAME Prénom /Nom/
2 NICK Surnom ou appellation du livre
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
1 QUOT "Réplique marquante (sans TYPE Première mention)."
1 EVEN
2 TYPE …
2 DATE MAR 1314
2 PLAC …
2 NOTE …
1 ASSO @I0009@
2 RELA …
2 NOTE …
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
| Preuve ASSO | `2 QUOT "…"` sous l’`ASSO` |
| Preuve couple FAM | `1 QUOT "…"` sur le bloc `FAM` |
| Preuve parent↔enfant | `2 QUOT "…"` sous `1 CHIL @I…@` |
| Continuité longue | `2 CONT` / `CONC` |

## Sens du RELA (contrat UI)

Sur person **A** :

```
1 ASSO @B@
2 RELA X
```

⇒ l’app affiche : **« A est X de B »**.

Donc `X` = rôle de A envers B.

```
# Bon
0 @I0021@ INDI  (Jeanne)
1 ASSO @I0008@  (prince)
2 RELA Gouvernante

0 @I0008@ INDI  (prince)
1 ASSO @I0021@
2 RELA Pupille
```

```
# Mauvais — inverse le sujet
0 @I0021@ INDI
1 ASSO @I0008@
2 RELA Pupille
# → « Jeanne est Pupille du prince » ✗
```

Accorder le genre français. Éviter les libellés qui produisent « … de la reine de Isabelle » ; préférer un rôle court (`Rival`, `Reine lésée` du côté d’Isabelle).

## FAM

```
0 @F0002@ FAM
1 HUSB @I0007@
1 WIFE @I0006@
1 CHIL @I0008@
2 NOTE Contexte propre à cet enfant.
2 QUOT "Preuve du lien parent ↔ cet enfant (pas la phrase du mariage)."
1 NOTE Contexte du couple / ménage.
1 QUOT "Preuve du couple / mariage."
```

### Ce que le site fait des citations FAM

| Tag | Lien UI |
|-----|---------|
| `1 QUOT` / `1 NOTE` sur FAM | **Époux** seulement |
| `2 QUOT` / `2 NOTE` sous `1 CHIL` | **Parent → cet enfant** (père et mère) |
| (rien) | Liens **fratrie** : pas de citation couple |

Ne jamais mettre sous `CHIL` une phrase qui parle du mariage des parents (ex. « Sa fille était mariée au roi… » sous le fils).

## HEAD

```
0 HEAD
1 SOUR Titre du livre
1 GEDC
2 VERS 5.5
1 CHAR UTF-8
```

## FAM vs ASSO (exclusivité)

| Type | Tags | Exemples RELA |
|------|------|----------------|
| Famille (trait rouge) | `FAM`, `FAMS`, `FAMC` | (pas de RELA — relations Spouse/Parent/Sibling dérivées) |
| Association (pointillé) | `ASSO` + `RELA` | Allié, Ennemie, Conseiller, Parrain, Amant, Gouvernante, Rival… |

Interdit : `ASSO` qui redit un lien `FAM`, ou qui affirme une parenté (`Cousin`, `Oncle`, `Tante`, `Neveu`, `Époux`…).

Toute parenté utile au graphe (même pour ancrer un titre) doit être en `FAM` complets. Profondeur UI = bonds `family`.

### Placeholder d’ancêtre / parent commun

Quand le récit dit « mon oncle » / « son neveu » sans nommer le parent :

```
0 @I0046@ INDI
1 NAME Parent /Tolomei/
…
0 @F0016@ FAM
1 HUSB @I0046@
1 CHIL @I0044@
2 QUOT "…oncle…"
1 CHIL @I0045@
2 QUOT "…neveu…"
```

Pas d’`ASSO` `RELA Oncle` entre les deux cousins / oncle-neveu.

## EVEN vs DEAT

```
# Sentence / ordre (ch.6 : « seront brûlés ce soir »)
1 EVEN
2 TYPE Condamnation à mort
2 DATE 18 MAR 1314
2 PLAC Île aux Juifs (ordre)
2 NOTE Le Conseil décide l’exécution pour le soir.
2 QUOT "Jacques de Molay et Geoffroy de Charnay seront brûlés ce soir…"

# Mort seulement quand le texte la montre
1 DEAT
2 DATE …
2 PLAC …
```

Ne pas mettre `DEAT` parce que « tout le monde sait » ou parce que l’ordre a été donné.

## Portrait

- Les 5 lignes `CONT` sont lues comme fiches structurées dans l’UI.
- Si le livre établit clairement un trait saillant (ambition, cruauté, homosexualité, etc.), le mettre dans `NOTE` / `Traits mentaux` / `Actions…`, pas seulement en ASSO.
- `2 NICK` obligatoire pour tout surnom du livre distinct du `NAME` (Louis Hutin, Spinello, Lombard pour un chien royal n’est pas un INDI sauf si personnifié).
- Figurants utiles au Conseil / administration : INDI + Première mention + portrait court OK ; ne pas les omettre s’ils sont nommés et agissent.

## Ce que le parser du site comprend (`graph.js`)

- INDI : NAME(+NICK), SEX, BIRT/DEAT, OCCU, NOTE(+CONT), QUOT(+TYPE/CONT), EVEN(+TYPE/DATE/PLAC/NOTE/QUOT), ASSO(+RELA/NOTE/QUOT), FAMC/FAMS
- QUOT + `TYPE Première mention` → `person.firstMentions`
- ASSO → liens `type: association` avec notes/citations
- FAM `1 QUOT` → citations du lien Spouse ; `2 QUOT` sous CHIL → citations des liens Parent vers cet enfant
- Sibling dérivé des co-`CHIL` d’un même FAM (pas de citation couple)
- Dates GED pour âges narratifs

## Nouveau livre

1. Dossier `public/ged/<id>/`
2. `.book` source + un ou plusieurs `.ged`
3. Objet dans `catalog.json`
4. Optionnel : `blurbs` / `chapterTitles` dans `public/i18n.js` (en/fr/es)

## Chapitre suivant

1. Ne pas écraser `up-to-chapter-(N-1).ged`
2. Créer `up-to-chapter-N.ged` en portant l’existant
3. Suivre [SKILL.md](SKILL.md) + [qa-checklist.md](qa-checklist.md)
4. Prompt prêt à l’emploi : `prompts/next_ged_chapter.prompt`
5. Extraire le chapitre si besoin (`tmp-chN-….txt` + copie `…-chapter-N-extract.txt` sous le dossier livre)
