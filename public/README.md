# 🧬 How to Create a Narrative GEDCOM File for Novels

This guide explains how to structure a GEDCOM 5.5 file to model **characters, their relationships, and major events** from novels. It is designed to work with **graph-based visualizations** that track character dynamics and story progression.

---

## 📌 BASIC STRUCTURE OF A CHARACTER (`@INDI@` block)

Each meaningful character in the story gets a `@INDI@` block. It should include:

### 1. `1 NAME`

The character's full name, written like:
`Firstname /Lastname/`

### 2. `1 SEX`

* `M` for male
* `F` for female
* (other values are possible but rarely used)

### 3. `1 BIRT` / `1 DEAT` (optional)

Birth and death details if known or estimable:

```gedcom
1 BIRT
2 DATE 1948
2 PLAC China
```

---

## 🧠 `1 NOTE`: Structured Narrative Profile

The `NOTE` section is the core of the character's identity. It follows a structured format with `2 CONT` lines for clarity:

```gedcom
1 NOTE Respected scientist working in the field of nanomaterials.
2 CONT Physical traits: N/A. Mental traits: Intelligent, analytical.
2 CONT Role: Scientist introduced in "The Frontiers of Science", now involved in investigating the mysterious suicides.
2 CONT Political views: Neutral, focused on scientific advancement.
2 CONT Main decisive actions: Agrees to infiltrate the "Frontiers of Science" to gather information.
2 CONT Experiencing unexplained countdown in photos taken with his camera, leading to psychological distress.
```

---

## 🗣 `1 QUOT`: Memorable or Defining Quote

Use this tag to include a quote that reveals the character’s mindset, personality, or ideology:

```gedcom
1 QUOT "Inventing the three laws of mechanics has already made me the greatest, God excepted."
```

---

## 🧭 `1 EVEN`: Key Narrative Events

Any major actions, events, or turning points involving the character should be added as `EVEN` blocks:

```gedcom
1 EVEN
2 TYPE Participates in Three Body game
2 DATE Approx. 200X
2 PLAC Three Body In-game World
2 NOTE Participates in second-level simulation with Newton and Von Neumann.
```

---

## 🧩 `1 ASSO`: Character-to-Character Narrative Links

Important non-familial relationships (colleagues, rivals, mentors, enemies, etc.) should use the `ASSO` structure:

```gedcom
1 ASSO @I0031@
2 RELA In-game companion
2 NOTE Wang meets Von Neumann inside the game.
2 NOTE They discuss the logic behind the Qin I computer together.
2 NOTE Von Neumann shares a final revelation before collapse.
```

### ⚫ These links are **displayed as black edges** on the graph.

They **do not imply family ties**, but instead capture significant story interactions (conversations, conflicts, collaborations, influence…).

---

## 👨‍👩‍👧 `FAM`, `FAMS`, `FAMC`: Family Relationships

### 🔴 These links are **displayed as red edges** on the graph.

### 🧱 `0 @FXXXX@ FAM`

Defines a family group with:

* `1 HUSB` – husband
* `1 WIFE` – wife
* `1 CHIL` – child(ren)

### 🧭 `1 FAMS @FXXXX@` *(Family as Spouse)*

Used in the `@INDI@` block to indicate that this person is a **parent or spouse in a family**.

### 🧭 `1 FAMC @FXXXX@` *(Family as Child)*

Used in the `@INDI@` block to indicate that this person is a **child in a family**.

---

### ✅ Example: Basic Family Structure

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

## 🎨 Graph Visualization Summary

| Relationship Type                                   | GEDCOM Tag(s)             | Edge Color  |
| --------------------------------------------------- | ------------------------- | ----------- |
| **Familial** (parent, child, spouse)                | `FAMC`, `FAMS`, via `FAM` | 🔴 **Red**  |
| **Narrative interaction** (colleague, enemy, ally…) | `ASSO` + `RELA` + `NOTE`  | ⚫ **Black** |

---

## ✅ Best Practices

* Every significant character should have **at least one `EVEN`**.
* Every `ASSO` should contain **at least two `2 NOTE`** entries for depth.
* Include a `QUOT` if a line of dialogue or belief is particularly revealing.
* Maintain consistency between real-world and in-game locations (`Three Body In-game World` for game scenes).

