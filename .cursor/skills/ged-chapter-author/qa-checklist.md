# QA relations — avant de valider un chapitre

À faire **après** rédaction du `.ged`, avant de dire à l’utilisateur que c’est bon.

## 1. Intégrité structurelle

- [ ] Fichier se termine par `0 TRLR` ; pas de troncature au milieu d’un INDI/FAM
- [ ] Chaque `FAMC` pointe vers un `FAM` qui liste bien le `CHIL`
- [ ] Chaque `HUSB`/`WIFE` a le `FAMS` correspondant
- [ ] Pas d’ID orphelin (`ASSO` / `HUSB` / `WIFE` / `CHIL` → INDI existant)
- [ ] Un seul bloc `0 @I…@ INDI` par personnage

Smoke script (recommandé) : parser ligne à ligne → compter INDI/FAM, vérifier FAMC↔CHIL, FAMS↔HUSB/WIFE, ASSO orphelins, clash FAM+ASSO sur le même couple, Premières mentions manquantes.

## 2. Premières mentions

- [ ] Chaque INDI a ≥1 `1 QUOT` suivi de `2 TYPE Première mention`
- [ ] La citation est bien la **première** identification dans le périmètre lu (pas un spoiler plus loin)
- [ ] Les répliques de personnalité restent en `1 QUOT` **sans** ce TYPE
- [ ] Figurants nommés (conseillers, secrétaires, chiens exclus sauf personnifiés) ont aussi leur Première mention

## 3. Sens des ASSO (critique)

Pour chaque `1 ASSO @B@` / `2 RELA X` sur A, lire à voix haute :

> « **A** est **X** de **B** »

- [ ] La phrase a du sens en français
- [ ] X décrit A, pas B
- [ ] Genre accordé (Alliée, Ennemie, Protégée, Espionne…)
- [ ] Pas de double « de » absurde (`Rival de la reine de Isabelle` → plutôt `Rival`)
- [ ] Aucun ASSO entre deux personnes déjà liées par le même `FAM` (époux / parent-enfant / fratrie)
- [ ] Aucun `RELA` de parenté (`Oncle`, `Cousin`, `Époux`, `Frère`…) — grep `2 RELA` pour ces mots

### Pièges vus (ne pas reproduire)

| Mauvais | Bon |
|---------|-----|
| Jeanne `RELA Pupille` → prince | Jeanne `RELA Gouvernante` → prince |
| Prince `RELA Protecteur` → Robert | Prince `RELA Protégé potentiel` → Robert |
| Despenser `RELA Reine lésée` → Isabelle | Despenser `RELA Rival` → Isabelle ; Isabelle `RELA Reine lésée` → Despenser |
| Molay `RELA Filleule` → Isabelle | Molay `RELA Parrain` → Isabelle |
| Valois `RELA Oncle` → Louis (ASSO) | Chaîne `FAM` (Valois frère du roi → Louis fils du roi) ou placeholder parent |
| Tolomei↔neveu en ASSO « Oncle » | `FAM` + INDI `Parent /Tolomei/` si besoin |

## 4. Preuves FAM

- [ ] Couple (`HUSB`+`WIFE`) : `1 QUOT` = preuve du **mariage / ménage**
- [ ] Chaque `CHIL` utile : `2 QUOT` = preuve du lien **parent↔cet enfant** (phrase adaptée)
- [ ] La citation du mariage n’apparaît **pas** sous un `CHIL`
- [ ] FAM généalogiques d’ancêtres / placeholders : au moins une citation qui ancre la parenté dans le texte

## 5. Contenu portrait

- [ ] NOTE + 5 lignes `CONT` structurées en français
- [ ] Faits saillants du chapitre dans le portrait (pas seulement dans les ASSO)
- [ ] `2 NICK` si le livre utilise un autre nom / surnom
- [ ] QUOT de dialogue importants hors Première mention si utiles
- [ ] Condamnation sans mort montrée → `EVEN`, pas `DEAT`

## 6. Catalogue

- [ ] `catalog.json` : `file`, `label`, `title`, `narrative` cohérents avec le snapshot
- [ ] `narrative` ne dépasse pas le span du chapitre encodé
- [ ] `moments[].characters` = acteurs de **cette** scène seulement
- [ ] `moments` / `note` : ordre ou décision OK ; pas d’exécution / mort anticipée ; pas de formulation « avant que… » / « non sur… »

## 7. Anti-spoiler

- [ ] Aucun événement / mort / relation issus d’un chapitre non lu
- [ ] Les IDs et portraits des absents du nouveau chapitre restent, mais ne sont pas « mis à jour » avec de l’avenir
- [ ] `narrative.moments` / `note` : pas de « pas encore », « n’est pas dans ce chapitre », ni négation d’un événement futur
- [ ] Grep utile sur le `.ged` + entrée catalogue : `pas encore`, `ce n'est pas`, `la suite`, `non sur`
