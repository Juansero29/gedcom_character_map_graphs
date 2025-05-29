
# 🧬 Guide de création d’un fichier `.ged` narratif pour romans

Ce guide explique comment structurer un fichier GEDCOM 5.5 pour modéliser **les personnages, leurs relations et événements narratifs** d’un roman. Il est pensé pour être **compatible avec une visualisation en graphe**, comme celle que tu construis.

---

## 📌 STRUCTURE GÉNÉRALE D’UN PERSONNAGE (`@INDI@`)

Chaque personnage ou figure significative du récit reçoit un bloc `@INDI@`. Ce bloc doit contenir :

### 1. `1 NAME`

Nom du personnage sous la forme : `Prénom /Nom/`

### 2. `1 SEX`

* `M` pour homme
* `F` pour femme
* (autres valeurs possibles, mais rarement utilisées ici)

### 3. `1 BIRT` / `1 DEAT` (facultatif)

Date et lieu de naissance ou de mort, si connues ou estimables.

```gedcom
1 BIRT
2 DATE 1948
2 PLAC China
```

---

## 🧠 `1 NOTE` : Portrait narratif structuré

La section `NOTE` est le cœur du profil narratif. Elle est structurée avec des sous-sections, chacune précédée d’un `2 CONT`. Exemple :

```gedcom
1 NOTE Respected scientist working in the field of nanomaterials.
2 CONT Physical traits: N/A. Mental traits: Intelligent, analytical.
2 CONT Role: Scientist introduced in "The Frontiers of Science", now involved in investigating the mysterious suicides.
2 CONT Political views: Neutral, focused on scientific advancement.
2 CONT Main decisive actions: Agrees to infiltrate the "Frontiers of Science" to gather information.
2 CONT Experiencing unexplained countdown in photos taken with his camera, leading to psychological distress.
```

---

## 🗣 `1 QUOT` : Citation emblématique (facultatif mais recommandé)

Permet de mettre en valeur une ligne de dialogue ou une pensée significative du personnage :

```gedcom
1 QUOT "Inventing the three laws of mechanics has already made me the greatest, God excepted."
```

---

## 🧭 `1 EVEN` : Événements clés

Chaque action ou événement important vécu par le personnage doit être décrit comme un `EVEN`, même approximatif :

```gedcom
1 EVEN
2 TYPE Participates in Three Body game
2 DATE Approx. 200X
2 PLAC Three Body In-game World
2 NOTE Participates in second level simulation with Newton and Von Neumann.
```

---

## 🧩 `1 ASSO` : Liens entre personnages (non familiaux)

Les relations significatives entre personnages (coéquipiers, rivaux, mentors…) doivent être encodées avec :

```gedcom
1 ASSO @I0031@
2 RELA In-game companion
2 NOTE Wang meets Von Neumann inside the game.
2 NOTE They discuss the logic behind the Qin I computer together.
2 NOTE Von Neumann shares a final revelation before collapse.
```

### 🔍 Ces liens sont **affichés en noir** sur le graphe.

Ils **n’indiquent pas un lien familial**, mais une interaction forte dans le récit (dialogue, conflit, alliance, influence, etc.).

---

## 👨‍👩‍👧 `FAM`, `FAMS`, `FAMC` : Relations familiales

### 🔴 Ces liens sont **affichés en rouge** sur le graphe.

### 🧱 `0 @FXXXX@ FAM`

Définit une famille. Inclut :

* `1 HUSB` : mari
* `1 WIFE` : épouse
* `1 CHIL` : enfant(s)

### 🧭 `1 FAMS @FXXXX@` *(Family as Spouse)*

Indique que l’individu est **marié ou parent dans une famille**.

### 🧭 `1 FAMC @FXXXX@` *(Family as Child)*

Indique que l’individu est **enfant dans une famille**.

---

### ✅ Exemple de famille simple :

```gedcom
0 @F0001@ FAM
1 HUSB @I0001@
1 WIFE @I0002@
1 CHIL @I0003@

0 @I0001@ INDI
1 NAME Zhetai /Ye/
1 SEX M
1 FAMS @F0001@

0 @I0003@ INDI
1 NAME Wenjie /Ye/
1 SEX F
1 FAMC @F0001@
```

---

## 🎨 Résumé visuel sur le graphe

| Type de lien                                         | Tag GEDCOM                | Couleur      |
| ---------------------------------------------------- | ------------------------- | ------------ |
| **Familial** (parent, enfant, mariage)               | `FAMC`, `FAMS`, via `FAM` | 🔴 **Rouge** |
| **Interaction narrative** (amis, ennemis, collègues) | `ASSO` + `RELA` + `NOTE`  | ⚫ **Noir**   |

---

## ✅ Bonnes pratiques

* Toujours inclure **au moins un `EVEN`** pour les personnages actifs.
* Toujours décrire les `ASSO` avec **au moins deux `2 NOTE`** si possible.
* Ajouter un `QUOT` quand une citation révèle le caractère ou l’idéologie.
* Rester cohérent avec l’univers : séparer les lieux fictifs (ex: `Three Body In-game World`) des lieux réels.

---

Souhaites-tu que je convertisse ce guide en `.md` ou `.txt` prêt à l’intégrer à ton repo ou outil ?
