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

1. [ged-conventions.md](ged-conventions.md) — contrat tags, sens des `RELA`, preuves FAM, EVEN vs DEAT.
2. [qa-checklist.md](qa-checklist.md) — passe finale avant de dire « bon ».
3. Prompt utilisateur : `prompts/next_ged_chapter.prompt` (chapitre suivant) ou `prompts/new_ged.prompt` (premier snapshot / nouveau livre).
4. Le `.ged` **précédent** du même livre + le `.book` / texte / extrait fourni.
5. L’entrée livre/chapitre dans `public/ged/catalog.json`.

## Deux modes

| Mode | Quand | Fichier de départ | Sortie typique |
|------|--------|-------------------|----------------|
| **Nouveau livre / ch.1** | Premier snapshot | Texte + prompt `new_ged.prompt` | `up-to-chapter-1.ged` |
| **Chapitre suivant** | Toujours après un snapshot validé | Copier/porter `up-to-chapter-(N-1).ged` | `up-to-chapter-N.ged` |

*Le Roi de fer* (Maurice Druon) — snapshots sous  
`public/ged/les-rois-maudits/le-roi-de-fer/up-to-chapter-N.ged`  
(état courant au moment de la rédaction : jusqu’au ch.8 « Je cite au tribunal de Dieu… »). Ne pas écraser un snapshot antérieur.

## Workflow chapitre suivant (checklist)

```
- [ ] 1. Périmètre : lire du début du livre jusqu’à la FIN du chapitre N demandé — PAS plus loin
- [ ] 2. Extraire le texte du chapitre (tmp + copie optionnelle le-…-chapter-N-extract.txt) si source EPUB/PDF
- [ ] 3. Partir du .ged up-to-chapter-(N-1) ; ne pas réécrire depuis zéro
- [ ] 4. Nouveau fichier up-to-chapter-N.ged (garder l’ancien snapshot intact)
- [ ] 5. Porter tous les INDI/FAM/ASSO existants ; enrichir / corriger / NICK si le nouveau texte le demande
- [ ] 6. Nouveaux personnages → nouveaux @I####@ (suite des IDs, jamais réutiliser)
- [ ] 7. Chaque INDI (vieux + nouveaux) a ≥1 Première mention
- [ ] 8. Chaque ASSO a RELA dans le bon sens + ≥1 2 QUOT + 2 NOTE utiles
- [ ] 9. Chaque FAM couple : 1 QUOT ; chaque CHIL utile : 2 QUOT (pas la citation du mariage)
- [ ] 10. FAM / FAMS / FAMC cohérents ; pas d’ASSO sur un lien déjà FAM ; pas d’ASSO de parenté
- [ ] 11. Condamnation / sentence sans exécution visible → EVEN, pas DEAT
- [ ] 12. catalog.json : nouveau chapter + narrative (moments anti-spoiler)
- [ ] 13. i18n blurbs/chapterTitles si besoin
- [ ] 14. QA : exécuter qa-checklist.md (phrases « A est X de B », spoiler, IDs)
```

## Règles dures (ne pas négocier)

### Anti-spoiler
Ne lire / n’encoder que jusqu’à la fin du chapitre demandé. Si une info n’est pas encore dans le texte, ne pas l’anticiper.
Dans `narrative.moments` / `narrative.note` / notes GED : décrire **seulement** ce qui se passe dans le snapshot — jamais « pas encore », « ce n’est pas dans ce chapitre », « la suite viendra », ni « le chapitre s’arrête avant X » (nier un événement futur spoil aussi).
Une **décision** ou un **ordre** (« seront brûlés ce soir ») peut être narrée ; l’**acte** (bûcher, mort) seulement quand le texte le montre → alors `1 DEAT` / EVEN d’exécution.

### Langue (*Les Rois maudits* / prompt FR)
NOTE, QUOT, EVEN, RELA, labels portrait **100 % français** :
`Traits physiques :` / `Traits mentaux :` / `Rôle :` / `Opinions politiques :` / `Actions décisives principales :` / `Non précisé`.

### FAM vs ASSO (exclusif)
- `FAM`/`FAMS`/`FAMC` = sang ou mariage seulement.
- `ASSO` = non-famille (allié, ennemi, conseiller, parrain, amant, gouvernante…).
- Jamais les deux pour le même couple de personnes.
- **Interdit en ASSO** : Cousin, Oncle, Tante, Neveu, Nièce, Frère, Sœur, Père, Mère, Fils, Fille, Époux, Épouse, Beau-… — même si le récit dit « mon oncle ». Encoder la parenté via chaîne `FAM` (éventuellement ancêtre / « Parent X » placeholder).
- Arbre complet même pour une parenté nommée en passant (chaque saut = un `FAM`).

### Sens du RELA (erreur la plus fréquente)
Sur la fiche de **A** :

`1 ASSO @B@` + `2 RELA X` ⇒ l’UI affiche **« A est X de B »**.

`X` = rôle de **A** envers **B**, jamais le rôle de B.

| Situation | Sur A | Sur B (si lien inverse) |
|-----------|--------|-------------------------|
| Jeanne gouverne le prince | `RELA Gouvernante` → prince | `RELA Pupille` → Jeanne |
| Robert protège le prince | `RELA Protecteur potentiel` → prince | `RELA Protégé potentiel` → Robert |
| Molay parrain d’Isabelle | `RELA Parrain` → Isabelle | `RELA Filleule` → Molay |
| Gaveston amant du roi | `RELA Amant / favori` → Édouard II | `RELA Amant` → Gaveston |

Accorder le genre : Alliée / Ennemie / Protégée / Espionne…

Préférer les **deux sens** quand le récit les établit (sinon un seul sens correct suffit).

### EVEN vs DEAT
| Situation narrative | Encodage |
|---------------------|----------|
| Mort montrée / confirmée dans le périmètre | `1 DEAT` (+ DATE/PLAC si connus) |
| Condamnation, ordre d’exécution, sentence | `1 EVEN` + `2 TYPE` / NOTE / QUOT — **pas** de `DEAT` |
| Personnage encore vivant dans le snapshot | ne pas anticiper la mort |

### Placeholders généalogiques
Si le livre nomme une parenté (oncle↔neveu, fratrie) sans donner le parent commun : créer un INDI ancre minimal (`NAME Parent /Clan/` ou équivalent), `FAM` avec `CHIL`, Première mention = phrase qui établit la parenté. L’UI layout regroupe les fratries via Sibling même sans parents nommés dans le texte — le placeholder sert surtout à ancrer le sang.

### Preuves livre
- ASSO : `2 QUOT` verbatim + `2 NOTE` (contexte plot).
- FAM couple : `1 QUOT` (preuve mariage / ménage) → UI lien **époux** seulement.
- FAM enfant : `2 QUOT` / `2 NOTE` sous `1 CHIL @I…@` → UI lien **parent↔cet enfant**.
- **Interdit** : coller la phrase du mariage sous un `CHIL` (ex. « Sa fille était mariée au roi… » sous le fils).
- Fratrie : pas de citation couple recyclée.
- Première mention : `1 QUOT` + `2 TYPE Première mention` pour **chaque** INDI (y compris figurants de conseil / secrétaires) ; dialogues perso = `1 QUOT` sans ce TYPE.
- Portrait : traits saillants du livre (y compris mœurs / sexualité si le texte les établit clairement) dans NOTE / Traits mentaux — pas seulement en ASSO.
- Enrichir les INDI existants quand le chapitre clarifie un nom (`2 NICK`, précision de `NAME`, Catherine de Courtenay, Spinello Tolomei, Louis Hutin…).

### IDs & unicité
- `@I0001@`… `@F0001@`… (4 chiffres).
- Un personnage = une seule occurrence INDI.
- `ASSO` uniquement dans le bloc INDI concerné.

### Édition sûre
- Ne jamais réécrire un `.ged` entier avec une regex greedy (`re.S` + `.+`) : risque de troncature.
- Préférer patches localisés ou parseur ligne à ligne pour changer les `RELA`.
- Après édition : smoke QA (TRLR, Premières mentions, FAMC↔CHIL, orphelins ASSO) — script Python rapide OK (voir [qa-checklist.md](qa-checklist.md)).

## Emplacements fichiers

| Élément | Chemin typique |
|--------|----------------|
| Texte / extrait | `public/ged/<slug-livre>/…` + optionnel `tmp-chN-….txt` en travail |
| Snapshot N | `public/ged/<slug-livre>/up-to-chapter-N.ged` |
| Catalogue | `public/ged/catalog.json` → `books[].chapters[]` |
| Prompt suite | `prompts/next_ged_chapter.prompt` |
| Prompt initial | `prompts/new_ged.prompt` |

## Entrée catalogue (minimum)

```json
{
  "file": "/ged/<slug>/up-to-chapter-N.ged",
  "label": "Jusqu’au chapitre N",
  "title": "Titre du chapitre N",
  "narrative": {
    "start": "YYYY-MM-DDTHH:mm:ss",
    "end": "YYYY-MM-DDTHH:mm:ss",
    "spanLabel": "Durée narrative",
    "location": "Lieu",
    "note": "Caveat si jour/heure inférés (sans nier un futur)",
    "sourceQuote": "Citation qui ancre la datation",
    "moments": [
      {
        "at": "…",
        "label": "…",
        "summary": "…",
        "characters": ["@I0001@", "@I0002@"]
      }
    ]
  }
}
```

`start`/`end` = horloge **narrative** du snapshot. Ne pas inventer de dates qui contredisent le texte. Horaires inférés OK si la continuité du jour est claire — le dire dans `note` sans spoiler.

`moments` = jalons de la **frise du chapitre** (UI) : `label` / `summary` en français pour *Les Rois maudits* ; `characters` = ids GEDCOM des personnages de la scène (highlight sur le graphe). Lister seulement les acteurs réellement en jeu à ce moment (présents, cités comme acteurs de la scène, ou cibles nommées du plan — pas tout le chapitre).

## Ordre de travail recommandé

1. Lire le périmètre → delta personnages / familles / associations vs snapshot N-1.
2. Copier N-1 → N ; enrichir sans casser les IDs stables.
3. Corriger les `RELA` / preuves FAM si le nouveau texte clarifie une erreur passée.
4. `narrative.moments` pour le nouveau span (ou étendre si le snapshot couvre plusieurs chapitres).
5. Brancher dans `catalog.json`.
6. QA ([qa-checklist.md](qa-checklist.md)) puis résumé utilisateur : fichiers touchés + nouveaux IDs + ambiguïtés du texte.

## Références

- [ged-conventions.md](ged-conventions.md)
- [qa-checklist.md](qa-checklist.md)
- Snapshots *Le Roi de fer* : `public/ged/les-rois-maudits/le-roi-de-fer/`
