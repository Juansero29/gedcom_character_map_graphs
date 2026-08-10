window.I18N = {
  defaultLang: "en",
  langs: ["en", "fr", "es"],
  labels: {
    en: "English",
    fr: "Français",
    es: "Español",
  },
  strings: {
    en: {
      pageTitle: "Character Maps — GEDCOM Graphs",
      eyebrow: "Literary graphs",
      brandTitle: "Character Maps",
      brandSubtitle:
        "Explore casts, bloodlines, and alliances chapter by chapter.",
      filterBooks: "Filter books…",
      booksAria: "Available books",
      openCustom: "Open custom .GED",
      sourceReadme: "Source & README",
      library: "Library",
      hideLibrary: "Hide library",
      showLibrary: "Show library",
      settingsTitle: "Settings",
      settingsHint: "Language, layout, and graph spacing",
      settingsClose: "Close settings",
      settingsLanguage: "Language",
      settingsLayout: "Layout",
      helpTitle: "Controls",
      helpHint: "How to use the site",
      helpClose: "Close help",
      helpIntro: "Quick guide to the main controls.",
      helpSectionLibrary: "Library",
      helpLibraryBody:
        "Open a book, then a chapter snapshot. Upload your own .GED from the footer.",
      helpSectionGraph: "Graph",
      helpClick:
        "Click a character to focus their neighborhood. Use the chip to open their profile.",
      helpDblClick:
        "Double-click for the family nucleus (parents, children, siblings). Double-click again to return to the neighborhood.",
      helpHover:
        "Hover a character to preview links. While focused, hover another to see the path between them.",
      helpTouch:
        "On touch: tap = focus; long-press = preview; pinch or drag = pan and zoom.",
      helpZoom:
        "Use + / − (bottom right) or scroll/pinch to zoom. Drag the background to pan.",
      helpSectionTools: "Tools",
      helpFilters:
        "Filters (top right): search, kinship depth, link types, sex, birth years, living status.",
      helpSettings:
        "Settings: language, layout (genealogy / chronological / free), and horizontal spread.",
      helpLegend: "Legend (bottom right): meaning of colors and link styles.",
      helpNarrative:
        "Chapter timeline (when available): step through key events to highlight the cast, and scrub story time to update ages.",
      searchCharacters: "Search characters…",
      layoutGenealogy: "Genealogy",
      layoutChrono: "Chronological",
      layoutForce: "Free",
      layoutGenealogyHint:
        "Top = ancestors, bottom = descendants — by kinship, not dates",
      layoutChronoHint: "Top = born earlier, bottom = born later",
      layoutForceHint: "Classic free-floating force layout",
      generationLabel: "Gen. {n}",
      generationAncestors: "Ancestors ↑",
      generationDescendants: "↓ Descendants",
      horizontalSpread: "Spread",
      horizontalSpreadHint:
        "Horizontal spacing of the graph — higher = wider, easier to read names",
      filtersTitle: "Filters",
      filtersHint: "Search, kinship depth, and character filters",
      filtersClose: "Close filters",
      filtersReset: "Reset filters",
      filterSex: "Sex",
      filterSexAll: "All",
      filterSexMale: "Men",
      filterSexFemale: "Women",
      filterBirth: "Birth year",
      filterBirthAfter: "Born after",
      filterBirthBefore: "Born before",
      filterVitality: "Living status",
      filterVitalityAll: "All",
      filterVitalityLiving: "Living",
      filterVitalityDeceased: "Deceased",
      filterBookEvidence: "Only with first mention in the book",
      filterLinkKind: "Links",
      filterLinkKindAll: "All links",
      filterLinkKindBlood: "Blood only",
      filterLinkKindOther: "Other only",
      sheetFamilyNucleus: "Show family nucleus",
      sheetFamilyNucleusHint:
        "Highlight only parents, children, and siblings (no spouses or other associations)",
      sheetNucleusOptions: "Family nucleus options",
      sheetNucleusAll: "All",
      sheetNucleusParents: "Parents only",
      sheetNucleusChildren: "Children only",
      sheetNucleusSiblings: "Siblings only",
      linkDepth: "Depth",
      linkDepthMode: "Depth mode",
      linkDepthModeUpto: "Up to",
      linkDepthModeExact: "Only",
      linkDepthModeAll: "All blood",
      linkDepthModeUptoShort: "≤",
      linkDepthModeExactShort: "=",
      linkDepthModeAllShort: "all",
      linkDepthHint:
        "Kinship depth. “Up to” = degrees 1…N; “Only” = paths of exact degree N; “All blood” = every family link of any degree (associations hidden). 0 = no links; max = family diameter",
      legendTitle: "Legend",
      legendToggleHint: "Show or hide the graph legend",
      zoomControls: "Zoom controls",
      zoomIn: "Zoom in",
      zoomOut: "Zoom out",
      legendMale: "Man",
      legendFemale: "Woman",
      legendFamily: "Blood / family link",
      legendAssociation: "Other association",
      legendDeceased: "Deceased",
      narrativeTitle: "Chapter timeline",
      narrativeToggleHint: "Show or hide the chapter timeline",
      narrativeClose: "Close",
      narrativeScrub: "Scrub story time (ages)",
      narrativeSpan: "Story time span: {span}",
      narrativeLocation: "Setting: {location}",
      narrativeEvents: "Chapter events",
      narrativeEventOf: "Event {n} of {total}",
      narrativePrevEvent: "Previous event",
      narrativeNextEvent: "Next event",
      narrativeCast: "Characters in this scene",
      narrativeAge: "Age at this moment",
      narrativeAgeValue: "{age} years old",
      narrativeAgeApprox: "~{age} years old",
      narrativeAgeAtDeath: "Age at death",
      narrativeWouldBeAge: "Age if still alive",
      narrativeDead: "Already deceased at this moment",
      narrativeDeadLabel: "Since death",
      narrativeDeadSince: "Deceased ({when})",
      narrativeDeadFor: "Deceased for {years} years",
      narrativeDeadForApprox: "Deceased for ~{years} years",
      narrativeDeadForMonths: "Deceased for {months} months",
      deadForShort: "† {years} yrs",
      deadForShortApprox: "† ~{years} yrs",
      deadForShortMonths: "† {months} mo.",
      deadAgeShort: "†{age}",
      deadAgeShortApprox: "†~{age}",
      narrativeNoAge: "Age unknown",
      narrativeInfant: "{months} mo.",
      yearsShort: "{age} yrs",
      yearsShortApprox: "~{age} yrs",
      timelineEarlier: "Earlier ↑",
      timelineLater: "↓ Later",
      emptyTitle: "Pick a book to begin",
      emptyBody:
        "Choose a title in the library, then open a chapter snapshot to map its characters.",
      close: "Close",
      focusChipOpen: "Open sheet",
      focusChipNeighborhood: "Neighborhood",
      focusChipClear: "Clear selection",
      pairNoRelation: "No documented family link between these two.",
      pairAssocOnly: "No blood path — association only if a dashed link exists.",
      snapshots_one: "1 snapshot",
      snapshots_other: "{n} snapshots",
      chapterN: "Chapter {n}",
      upToChapterN: "Up to chapter {n}",
      fullMap: "Full map",
      prologueAndChapter1: "Prologue & chapter 1",
      customFile: "Custom file",
      uploadedGed: "Uploaded .GED",
      graph: "Graph",
      noBooks: "No books found under /ged.",
      noLibraryData:
        "No library data found. Start `node server.js` locally, or ensure ged/catalog.json is present.",
      couldNotLoad: "Could not load {file}: {error}",
      discoveredBlurb: "Discovered from the /ged folder.",
      sex: "Sex",
      nickname: "Nickname",
      nicknames: "Nicknames",
      email: "Email",
      occupation: "Occupation",
      birth: "Birth",
      death: "Death",
      notes: "Notes",
      events: "Events",
      firstMentions: "First named in the book",
      missingFirstMention:
        "No quotation recorded yet for the first time this character is named.",
      quotes: "Quotes",
      relation: "Relation",
      unknown: "Unknown",
      noNotes: "No notes.",
      event: "Event",
      at: "at",
      spouse: "Spouse",
      parent: "Parent",
      sibling: "Sibling",
      personLinks: "Relationships",
      bloodLinks: "Blood & family ties",
      otherLinks: "Other ties",
      sheetRelSearch: "Find a link by name",
      sheetRelSearchPlaceholder: "Type a first or last name…",
      sheetRelSearchHits: "{n} link(s) matching “{query}”",
      sheetRelSearchNone: "No relationship with anyone matching “{query}”",
      noBloodLinks: "No blood or family ties to other characters in this graph.",
      noOtherLinks: "No non-family associations recorded for this character.",
      kinDegree: "Degree {degree}",
      kinIs: "is",
      kinPathWhoIs: "who is",
      kinPathShowDetail: "Show how they are related",
      kinPathHideDetail: "Hide path detail",
      kinRoleFather: "father",
      kinRoleMother: "mother",
      kinRoleParent: "parent",
      kinRoleSon: "son",
      kinRoleDaughter: "daughter",
      kinRoleChild: "child",
      kinRoleHusband: "husband",
      kinRoleWife: "wife",
      kinRoleSpouse: "spouse",
      kinRoleBrother: "brother",
      kinRoleSister: "sister",
      kinRoleSibling: "sibling",
      kinRoleUncle: "uncle",
      kinRoleAunt: "aunt",
      kinRoleNephew: "nephew",
      kinRoleNiece: "niece",
      kinRoleCousinM: "cousin",
      kinRoleCousinF: "cousin",
      kinRoleBrotherInLaw: "brother-in-law",
      kinRoleSisterInLaw: "sister-in-law",
      kinRoleSonInLaw: "son-in-law",
      kinRoleDaughterInLaw: "daughter-in-law",
      kinRoleFatherInLaw: "father-in-law",
      kinRoleMotherInLaw: "mother-in-law",
      kinRoleStepfather: "stepfather",
      kinRoleStepmother: "stepmother",
      kinRoleStepson: "stepson",
      kinRoleStepdaughter: "stepdaughter",
      kinRoleRelative: "related to",
      kinParentOf: "parent",
      kinChildOf: "child",
      spouseOf: "spouse",
      siblingOf: "sibling",
      kinGrandparentOf: "grandparent",
      kinGrandchildOf: "grandchild",
      kinGreatGrandparentOf: "great-grandparent",
      kinGreatGrandchildOf: "great-grandchild",
      kinGreatGreatGrandparentOf: "great-great-grandparent",
      kinGreatGreatGrandchildOf: "great-great-grandchild",
      kinUncleAuntOf: "uncle/aunt",
      kinNephewNieceOf: "nephew/niece",
      kinCousinOf: "cousin",
      kinChildInLawOf: "child-in-law",
      kinParentInLawOf: "parent-in-law",
      kinSpouseChildOf: "step-parent",
      kinStepParentOf: "stepchild",
      kinSiblingInLawOf: "sibling-in-law",
      kinAncestorDegreeOf: "ancestor (degree {degree})",
      kinDescendantDegreeOf: "descendant (degree {degree})",
      kinFamilyDegreeOf: "family relation (degree {degree})",
      assocRelOf: "{subject} {is} {relation} {ofObject}",
      relationContext: "Why this link",
      bookEvidence: "Evidence from the book",
      missingBookEvidence: "No direct quotation recorded for this relationship yet.",
      blurbs: {
        "les-rois-maudits/le-roi-de-fer":
          "Philip the Fair, Isabella of England, and the Templars’ curse.",
        "01-three-body-problem":
          "Character map built chapter by chapter through the first novel.",
        "a-song-of-ice-and-fire-game-of-thrones":
          "A wide cast map of Westeros and beyond.",
        "greek-mythology": "Gods, heroes, and their tangled bloodlines.",
        "the-simpsons": "Springfield’s sprawling family and neighbors.",
      },
      chapterTitles: {
        "/ged/a-song-of-ice-and-fire-game-of-thrones/ASOIAF.ged": "ASOIAF cast",
        "/ged/greek-mythology/greek-myth.ged": "Olympians & heroes",
        "/ged/the-simpsons/the-simpsons.ged": "The Simpsons",
      },
    },
    fr: {
      pageTitle: "Cartes de personnages — Graphes GEDCOM",
      eyebrow: "Graphes littéraires",
      brandTitle: "Cartes de personnages",
      brandSubtitle:
        "Explorez les distributions, lignées et alliances chapitre après chapitre.",
      filterBooks: "Filtrer les livres…",
      booksAria: "Livres disponibles",
      openCustom: "Ouvrir un .GED personnalisé",
      sourceReadme: "Code source & README",
      library: "Bibliothèque",
      hideLibrary: "Masquer la bibliothèque",
      showLibrary: "Afficher la bibliothèque",
      settingsTitle: "Paramètres",
      settingsHint: "Langue, disposition et espacement du graphe",
      settingsClose: "Fermer les paramètres",
      settingsLanguage: "Langue",
      settingsLayout: "Disposition",
      helpTitle: "Contrôles",
      helpHint: "Comment utiliser le site",
      helpClose: "Fermer l’aide",
      helpIntro: "Petit guide des contrôles principaux.",
      helpSectionLibrary: "Bibliothèque",
      helpLibraryBody:
        "Ouvrez un livre, puis un snapshot de chapitre. Importez votre propre .GED depuis le pied de page.",
      helpSectionGraph: "Graphe",
      helpClick:
        "Cliquez un personnage pour focaliser son voisinage. Utilisez la pastille pour ouvrir sa fiche.",
      helpDblClick:
        "Double-clic pour le noyau familial (parents, enfants, fratrie). Un second double-clic revient au voisinage.",
      helpHover:
        "Survolez un personnage pour prévisualiser les liens. En focus, survolez un autre pour voir le chemin entre eux.",
      helpTouch:
        "Sur tactile : tap = focus ; appui long = prévisualisation ; pincer ou glisser = pan et zoom.",
      helpZoom:
        "Utilisez + / − (bas droite) ou molette/pincement pour zoomer. Glissez le fond pour vous déplacer.",
      helpSectionTools: "Outils",
      helpFilters:
        "Filtres (haut droite) : recherche, profondeur de parenté, types de liens, sexe, années de naissance, statut vital.",
      helpSettings:
        "Paramètres : langue, disposition (généalogique / chronologique / libre) et étalement horizontal.",
      helpLegend: "Légende (bas droite) : sens des couleurs et des styles de liens.",
      helpNarrative:
        "Frise du chapitre (si disponible) : parcourez les événements pour mettre en avant les personnages, et le curseur pour les âges.",
      searchCharacters: "Rechercher des personnages…",
      layoutGenealogy: "Généalogique",
      layoutChrono: "Chronologique",
      layoutForce: "Libre",
      layoutGenealogyHint:
        "Haut = ancêtres, bas = descendants — par parenté, sans dates",
      layoutChronoHint: "Haut = nés plus tôt, bas = nés plus tard",
      layoutForceHint: "Disposition libre par forces",
      generationLabel: "Gén. {n}",
      generationAncestors: "Ancêtres ↑",
      generationDescendants: "↓ Descendants",
      horizontalSpread: "Étalement",
      horizontalSpreadHint:
        "Espacement horizontal du graphe — plus élevé = plus large, noms plus lisibles",
      filtersTitle: "Filtres",
      filtersHint: "Recherche, profondeur de parenté et filtres de personnages",
      filtersClose: "Fermer les filtres",
      filtersReset: "Réinitialiser",
      filterSex: "Sexe",
      filterSexAll: "Tous",
      filterSexMale: "Hommes",
      filterSexFemale: "Femmes",
      filterBirth: "Année de naissance",
      filterBirthAfter: "Né(e) après",
      filterBirthBefore: "Né(e) avant",
      filterVitality: "Statut vital",
      filterVitalityAll: "Tous",
      filterVitalityLiving: "Vivants",
      filterVitalityDeceased: "Décédés",
      filterBookEvidence: "Seulement avec première mention dans le livre",
      filterLinkKind: "Liens",
      filterLinkKindAll: "Tous les liens",
      filterLinkKindBlood: "Liens de sang",
      filterLinkKindOther: "Autres liens",
      sheetFamilyNucleus: "Afficher le noyau familial",
      sheetFamilyNucleusHint:
        "Mettre en surbrillance seulement parents, enfants et frères/sœurs (sans conjoints ni associations)",
      sheetNucleusOptions: "Options du noyau familial",
      sheetNucleusAll: "Tout",
      sheetNucleusParents: "Parents seulement",
      sheetNucleusChildren: "Enfants seulement",
      sheetNucleusSiblings: "Frères et sœurs",
      linkDepth: "Profondeur",
      linkDepthMode: "Mode de profondeur",
      linkDepthModeUpto: "Jusqu’à",
      linkDepthModeExact: "Seulement",
      linkDepthModeAll: "Tous (sang)",
      linkDepthModeUptoShort: "≤",
      linkDepthModeExactShort: "=",
      linkDepthModeAllShort: "tous",
      linkDepthHint:
        "Profondeur de parenté. « Jusqu’à » = degrés 1…N ; « Seulement » = chemins de degré exact N ; « Tous (sang) » = tous les liens familiaux, tout degré (ASSO masquées). 0 = aucun lien ; max = diamètre familial",
      legendTitle: "Légende",
      legendToggleHint: "Afficher ou masquer la légende du graphe",
      zoomControls: "Contrôles de zoom",
      zoomIn: "Zoom avant",
      zoomOut: "Zoom arrière",
      legendMale: "Homme",
      legendFemale: "Femme",
      legendFamily: "Lien de sang / famille",
      legendAssociation: "Autre association",
      legendDeceased: "Décédé(e)",
      narrativeTitle: "Frise du chapitre",
      narrativeToggleHint: "Afficher ou masquer la frise du chapitre",
      narrativeClose: "Fermer",
      narrativeScrub: "Temps narratif (âges)",
      narrativeSpan: "Durée dans le récit : {span}",
      narrativeLocation: "Lieu : {location}",
      narrativeEvents: "Événements du chapitre",
      narrativeEventOf: "Événement {n} sur {total}",
      narrativePrevEvent: "Événement précédent",
      narrativeNextEvent: "Événement suivant",
      narrativeCast: "Personnages de la scène",
      narrativeAge: "Âge à cet instant",
      narrativeAgeValue: "{age} ans",
      narrativeAgeApprox: "~{age} ans",
      narrativeAgeAtDeath: "Âge au décès",
      narrativeWouldBeAge: "Âge s’il·elle vivait encore",
      narrativeDead: "Déjà décédé(e) à cet instant",
      narrativeDeadLabel: "Depuis le décès",
      narrativeDeadSince: "Décédé(e) ({when})",
      narrativeDeadFor: "Décédé(e) depuis {years} ans",
      narrativeDeadForApprox: "Décédé(e) depuis ~{years} ans",
      narrativeDeadForMonths: "Décédé(e) depuis {months} mois",
      deadForShort: "† {years} ans",
      deadForShortApprox: "† ~{years} ans",
      deadForShortMonths: "† {months} mois",
      deadAgeShort: "†{age}",
      deadAgeShortApprox: "†~{age}",
      narrativeNoAge: "Âge inconnu",
      narrativeInfant: "{months} mois",
      yearsShort: "{age} ans",
      yearsShortApprox: "~{age} ans",
      timelineEarlier: "Plus tôt ↑",
      timelineLater: "↓ Plus tard",
      emptyTitle: "Choisissez un livre pour commencer",
      emptyBody:
        "Sélectionnez un titre dans la bibliothèque, puis ouvrez un instantané de chapitre pour cartographier ses personnages.",
      close: "Fermer",
      focusChipOpen: "Ouvrir la fiche",
      focusChipNeighborhood: "Voisinage",
      focusChipClear: "Effacer la sélection",
      pairNoRelation: "Aucun lien de famille documenté entre ces deux personnages.",
      pairAssocOnly: "Pas de chemin de sang — seulement une association s’il existe un lien en pointillés.",
      snapshots_one: "1 instantané",
      snapshots_other: "{n} instantanés",
      chapterN: "Chapitre {n}",
      upToChapterN: "Jusqu’au chapitre {n}",
      fullMap: "Carte complète",
      prologueAndChapter1: "Prologue & chapitre 1",
      customFile: "Fichier personnalisé",
      uploadedGed: ".GED importé",
      graph: "Graphe",
      noBooks: "Aucun livre trouvé sous /ged.",
      noLibraryData:
        "Aucune donnée de bibliothèque. Lancez `node server.js` en local, ou assurez-vous que ged/catalog.json est présent.",
      couldNotLoad: "Impossible de charger {file} : {error}",
      discoveredBlurb: "Découvert dans le dossier /ged.",
      sex: "Sexe",
      nickname: "Surnom",
      nicknames: "Surnoms",
      email: "E-mail",
      occupation: "Occupation",
      birth: "Naissance",
      death: "Décès",
      notes: "Notes",
      events: "Événements",
      firstMentions: "Première(s) mention(s) dans le livre",
      missingFirstMention:
        "Aucune citation n’est encore enregistrée pour la première fois où ce personnage est nommé.",
      quotes: "Citations",
      relation: "Relation",
      unknown: "Inconnu",
      noNotes: "Aucune note.",
      event: "Événement",
      at: "à",
      spouse: "Époux / épouse",
      parent: "Parent",
      sibling: "Frère / sœur",
      personLinks: "Relations",
      bloodLinks: "Liens de sang & famille",
      otherLinks: "Autres liens",
      sheetRelSearch: "Chercher un lien par nom",
      sheetRelSearchPlaceholder: "Saisir un prénom ou un nom…",
      sheetRelSearchHits: "{n} lien(s) correspondant à « {query} »",
      sheetRelSearchNone: "Aucun lien avec une personne correspondant à « {query} »",
      noBloodLinks: "Aucun lien de sang ou de famille avec d’autres personnages de ce graphe.",
      noOtherLinks: "Aucune association hors famille enregistrée pour ce personnage.",
      kinDegree: "Degré {degree}",
      kinIs: "est",
      kinPathWhoIs: "qui est",
      kinPathShowDetail: "Voir le détail du lien",
      kinPathHideDetail: "Masquer le détail",
      kinRoleFather: "père",
      kinRoleMother: "mère",
      kinRoleParent: "parent",
      kinRoleSon: "fils",
      kinRoleDaughter: "fille",
      kinRoleChild: "enfant",
      kinRoleHusband: "époux",
      kinRoleWife: "épouse",
      kinRoleSpouse: "époux/épouse",
      kinRoleBrother: "frère",
      kinRoleSister: "sœur",
      kinRoleSibling: "frère/sœur",
      kinRoleUncle: "oncle",
      kinRoleAunt: "tante",
      kinRoleNephew: "neveu",
      kinRoleNiece: "nièce",
      kinRoleCousinM: "cousin",
      kinRoleCousinF: "cousine",
      kinRoleBrotherInLaw: "beau-frère",
      kinRoleSisterInLaw: "belle-sœur",
      kinRoleSonInLaw: "gendre",
      kinRoleDaughterInLaw: "belle-fille",
      kinRoleFatherInLaw: "beau-père",
      kinRoleMotherInLaw: "belle-mère",
      kinRoleStepfather: "beau-père",
      kinRoleStepmother: "belle-mère",
      kinRoleStepson: "beau-fils",
      kinRoleStepdaughter: "belle-fille",
      kinRoleRelative: "parent(e)",
      kinParentOf: "parent",
      kinChildOf: "enfant",
      spouseOf: "époux/épouse",
      siblingOf: "frère/sœur",
      kinGrandparentOf: "grand-parent",
      kinGrandchildOf: "petit-enfant",
      kinGreatGrandparentOf: "arrière-grand-parent",
      kinGreatGrandchildOf: "arrière-petit-enfant",
      kinGreatGreatGrandparentOf: "trisaïeul(e)",
      kinGreatGreatGrandchildOf: "arrière-arrière-petit-enfant",
      kinUncleAuntOf: "oncle/tante",
      kinNephewNieceOf: "neveu/nièce",
      kinCousinOf: "cousin(e)",
      kinChildInLawOf: "gendre/belle-fille",
      kinParentInLawOf: "beau-parent",
      kinSpouseChildOf: "beau-parent",
      kinStepParentOf: "beau-fils/belle-fille",
      kinSiblingInLawOf: "beau-frère/belle-sœur",
      kinAncestorDegreeOf: "ancêtre (degré {degree})",
      kinDescendantDegreeOf: "descendant(e) (degré {degree})",
      kinFamilyDegreeOf: "parenté (degré {degree})",
      assocRelOf: "{subject} {is} {relation} {ofObject}",
      relationContext: "Pourquoi ce lien",
      bookEvidence: "Preuve tirée du livre",
      missingBookEvidence:
        "Aucune citation directe n’est encore enregistrée pour cette relation.",
      blurbs: {
        "les-rois-maudits/le-roi-de-fer":
          "Philippe le Bel, Isabelle d’Angleterre et la malédiction des Templiers.",
        "01-three-body-problem":
          "Carte des personnages construite chapitre par chapitre pour le premier roman.",
        "a-song-of-ice-and-fire-game-of-thrones":
          "Une vaste carte des personnages de Westeros et au-delà.",
        "greek-mythology":
          "Dieux, héros et leurs lignées enchevêtrées.",
        "the-simpsons":
          "La famille et le voisinage étendus de Springfield.",
      },
      chapterTitles: {
        "/ged/a-song-of-ice-and-fire-game-of-thrones/ASOIAF.ged":
          "Distribution ASOIAF",
        "/ged/greek-mythology/greek-myth.ged": "Olympiens & héros",
        "/ged/the-simpsons/the-simpsons.ged": "Les Simpson",
      },
    },
    es: {
      pageTitle: "Mapas de personajes — Grafos GEDCOM",
      eyebrow: "Grafos literarios",
      brandTitle: "Mapas de personajes",
      brandSubtitle:
        "Explora elencos, linajes y alianzas capítulo a capítulo.",
      filterBooks: "Filtrar libros…",
      booksAria: "Libros disponibles",
      openCustom: "Abrir .GED personalizado",
      sourceReadme: "Código y README",
      library: "Biblioteca",
      hideLibrary: "Ocultar biblioteca",
      showLibrary: "Mostrar biblioteca",
      settingsTitle: "Ajustes",
      settingsHint: "Idioma, disposición y espaciado del grafo",
      settingsClose: "Cerrar ajustes",
      settingsLanguage: "Idioma",
      settingsLayout: "Disposición",
      helpTitle: "Controles",
      helpHint: "Cómo usar el sitio",
      helpClose: "Cerrar ayuda",
      helpIntro: "Guía rápida de los controles principales.",
      helpSectionLibrary: "Biblioteca",
      helpLibraryBody:
        "Abre un libro y luego una captura de capítulo. Sube tu propio .GED desde el pie de página.",
      helpSectionGraph: "Grafo",
      helpClick:
        "Haz clic en un personaje para enfocar su vecindario. Usa la pastilla para abrir su ficha.",
      helpDblClick:
        "Doble clic para el núcleo familiar (padres, hijos, hermanos). Otro doble clic vuelve al vecindario.",
      helpHover:
        "Pasa el cursor sobre un personaje para previsualizar vínculos. En foco, pasa sobre otro para ver el camino entre ellos.",
      helpTouch:
        "En táctil: toque = foco; pulsación larga = vista previa; pellizcar o arrastrar = pan y zoom.",
      helpZoom:
        "Usa + / − (abajo a la derecha) o rueda/pellizco para hacer zoom. Arrastra el fondo para desplazarte.",
      helpSectionTools: "Herramientas",
      helpFilters:
        "Filtros (arriba a la derecha): búsqueda, profundidad de parentesco, tipos de vínculo, sexo, años de nacimiento, estado vital.",
      helpSettings:
        "Ajustes: idioma, disposición (genealógico / cronológico / libre) y amplitud horizontal.",
      helpLegend: "Leyenda (abajo a la derecha): significado de colores y estilos de vínculo.",
      helpNarrative:
        "Friso del capítulo (si está disponible): recorre los eventos para resaltar el elenco, y el control deslizante para las edades.",
      searchCharacters: "Buscar personajes…",
      layoutGenealogy: "Genealógico",
      layoutChrono: "Cronológico",
      layoutForce: "Libre",
      layoutGenealogyHint:
        "Arriba = antepasados, abajo = descendientes — por parentesco, sin fechas",
      layoutChronoHint: "Arriba = nacidos antes, abajo = nacidos después",
      layoutForceHint: "Disposición libre por fuerzas",
      generationLabel: "Gen. {n}",
      generationAncestors: "Antepasados ↑",
      generationDescendants: "↓ Descendientes",
      horizontalSpread: "Amplitud",
      horizontalSpreadHint:
        "Espaciado horizontal del grafo — más alto = más ancho, nombres más legibles",
      filtersTitle: "Filtros",
      filtersHint: "Búsqueda, profundidad de parentesco y filtros de personajes",
      filtersClose: "Cerrar filtros",
      filtersReset: "Restablecer",
      filterSex: "Sexo",
      filterSexAll: "Todos",
      filterSexMale: "Hombres",
      filterSexFemale: "Mujeres",
      filterBirth: "Año de nacimiento",
      filterBirthAfter: "Nacido/a después de",
      filterBirthBefore: "Nacido/a antes de",
      filterVitality: "Estado vital",
      filterVitalityAll: "Todos",
      filterVitalityLiving: "Vivos",
      filterVitalityDeceased: "Fallecidos",
      filterBookEvidence: "Solo con primera mención en el libro",
      filterLinkKind: "Vínculos",
      filterLinkKindAll: "Todos los vínculos",
      filterLinkKindBlood: "Solo de sangre",
      filterLinkKindOther: "Solo otros",
      sheetFamilyNucleus: "Mostrar el núcleo familiar",
      sheetFamilyNucleusHint:
        "Resaltar solo padres, hijos y hermanos (sin cónyuges ni otras asociaciones)",
      sheetNucleusOptions: "Opciones del núcleo familiar",
      sheetNucleusAll: "Todo",
      sheetNucleusParents: "Solo padres",
      sheetNucleusChildren: "Solo hijos",
      sheetNucleusSiblings: "Solo hermanos",
      linkDepth: "Profundidad",
      linkDepthMode: "Modo de profundidad",
      linkDepthModeUpto: "Hasta",
      linkDepthModeExact: "Solo",
      linkDepthModeAll: "Todos (sangre)",
      linkDepthModeUptoShort: "≤",
      linkDepthModeExactShort: "=",
      linkDepthModeAllShort: "todos",
      linkDepthHint:
        "Profundidad de parentesco. « Hasta » = grados 1…N; « Solo » = caminos de grado exacto N; « Todos (sangre) » = todos los vínculos familiares, cualquier grado (ASSO ocultas). 0 = sin vínculos; máx. = diámetro familiar",
      legendTitle: "Leyenda",
      legendToggleHint: "Mostrar u ocultar la leyenda del grafo",
      zoomControls: "Controles de zoom",
      zoomIn: "Acercar",
      zoomOut: "Alejar",
      legendMale: "Hombre",
      legendFemale: "Mujer",
      legendFamily: "Vínculo de sangre / familia",
      legendAssociation: "Otra asociación",
      legendDeceased: "Fallecido/a",
      narrativeTitle: "Friso del capítulo",
      narrativeToggleHint: "Mostrar u ocultar el friso del capítulo",
      narrativeClose: "Cerrar",
      narrativeScrub: "Tiempo narrativo (edades)",
      narrativeSpan: "Duración en el relato: {span}",
      narrativeLocation: "Lugar: {location}",
      narrativeEvents: "Eventos del capítulo",
      narrativeEventOf: "Evento {n} de {total}",
      narrativePrevEvent: "Evento anterior",
      narrativeNextEvent: "Evento siguiente",
      narrativeCast: "Personajes de la escena",
      narrativeAge: "Edad en este momento",
      narrativeAgeValue: "{age} años",
      narrativeAgeApprox: "~{age} años",
      narrativeAgeAtDeath: "Edad al fallecer",
      narrativeWouldBeAge: "Edad si siguiera con vida",
      narrativeDead: "Ya fallecido/a en este momento",
      narrativeDeadLabel: "Desde el fallecimiento",
      narrativeDeadSince: "Fallecido/a ({when})",
      narrativeDeadFor: "Fallecido/a desde hace {years} años",
      narrativeDeadForApprox: "Fallecido/a desde hace ~{years} años",
      narrativeDeadForMonths: "Fallecido/a desde hace {months} meses",
      deadForShort: "† {years} años",
      deadForShortApprox: "† ~{years} años",
      deadForShortMonths: "† {months} meses",
      deadAgeShort: "†{age}",
      deadAgeShortApprox: "†~{age}",
      narrativeNoAge: "Edad desconocida",
      narrativeInfant: "{months} meses",
      yearsShort: "{age} años",
      yearsShortApprox: "~{age} años",
      timelineEarlier: "Más temprano ↑",
      timelineLater: "↓ Más tarde",
      emptyTitle: "Elige un libro para empezar",
      emptyBody:
        "Selecciona un título en la biblioteca y abre una captura de capítulo para mapear sus personajes.",
      close: "Cerrar",
      focusChipOpen: "Abrir ficha",
      focusChipNeighborhood: "Vecindario",
      focusChipClear: "Borrar selección",
      pairNoRelation: "No hay vínculo familiar documentado entre estos dos.",
      pairAssocOnly: "Sin camino de sangre: solo asociación si hay un enlace de puntos.",
      snapshots_one: "1 captura",
      snapshots_other: "{n} capturas",
      chapterN: "Capítulo {n}",
      upToChapterN: "Hasta el capítulo {n}",
      fullMap: "Mapa completo",
      prologueAndChapter1: "Prólogo y capítulo 1",
      customFile: "Archivo personalizado",
      uploadedGed: ".GED cargado",
      graph: "Grafo",
      noBooks: "No se encontraron libros en /ged.",
      noLibraryData:
        "No hay datos de biblioteca. Ejecuta `node server.js` en local o asegúrate de que exista ged/catalog.json.",
      couldNotLoad: "No se pudo cargar {file}: {error}",
      discoveredBlurb: "Descubierto en la carpeta /ged.",
      sex: "Sexo",
      nickname: "Apodo",
      nicknames: "Apodos",
      email: "Correo",
      occupation: "Ocupación",
      birth: "Nacimiento",
      death: "Fallecimiento",
      notes: "Notas",
      events: "Eventos",
      firstMentions: "Primera(s) mención(es) en el libro",
      missingFirstMention:
        "Aún no hay una cita registrada de la primera vez que se nombra a este personaje.",
      quotes: "Citas",
      relation: "Relación",
      unknown: "Desconocido",
      noNotes: "Sin notas.",
      event: "Evento",
      at: "en",
      spouse: "Cónyuge",
      parent: "Progenitor",
      sibling: "Hermano/a",
      personLinks: "Relaciones",
      bloodLinks: "Vínculos de sangre y familia",
      otherLinks: "Otros vínculos",
      sheetRelSearch: "Buscar un vínculo por nombre",
      sheetRelSearchPlaceholder: "Escribe un nombre o apellido…",
      sheetRelSearchHits: "{n} vínculo(s) que coinciden con « {query} »",
      sheetRelSearchNone: "Sin relación con nadie que coincida con « {query} »",
      noBloodLinks: "Sin vínculos de sangre o familia con otros personajes de este grafo.",
      noOtherLinks: "Sin asociaciones fuera de la familia para este personaje.",
      kinDegree: "Grado {degree}",
      kinIs: "es",
      kinPathWhoIs: "que es",
      kinPathShowDetail: "Ver el detalle del vínculo",
      kinPathHideDetail: "Ocultar el detalle",
      kinRoleFather: "padre",
      kinRoleMother: "madre",
      kinRoleParent: "progenitor/a",
      kinRoleSon: "hijo",
      kinRoleDaughter: "hija",
      kinRoleChild: "hijo/a",
      kinRoleHusband: "esposo",
      kinRoleWife: "esposa",
      kinRoleSpouse: "cónyuge",
      kinRoleBrother: "hermano",
      kinRoleSister: "hermana",
      kinRoleSibling: "hermano/a",
      kinRoleUncle: "tío",
      kinRoleAunt: "tía",
      kinRoleNephew: "sobrino",
      kinRoleNiece: "sobrina",
      kinRoleCousinM: "primo",
      kinRoleCousinF: "prima",
      kinRoleBrotherInLaw: "cuñado",
      kinRoleSisterInLaw: "cuñada",
      kinRoleSonInLaw: "yerno",
      kinRoleDaughterInLaw: "nuera",
      kinRoleFatherInLaw: "suegro",
      kinRoleMotherInLaw: "suegra",
      kinRoleStepfather: "padrastro",
      kinRoleStepmother: "madrastra",
      kinRoleStepson: "hijastro",
      kinRoleStepdaughter: "hijastra",
      kinRoleRelative: "pariente",
      kinParentOf: "progenitor/a",
      kinChildOf: "hijo/a",
      spouseOf: "cónyuge",
      siblingOf: "hermano/a",
      kinGrandparentOf: "abuelo/a",
      kinGrandchildOf: "nieto/a",
      kinGreatGrandparentOf: "bisabuelo/a",
      kinGreatGrandchildOf: "bisnieto/a",
      kinGreatGreatGrandparentOf: "tatarabuelo/a",
      kinGreatGreatGrandchildOf: "tataranieto/a",
      kinUncleAuntOf: "tío/a",
      kinNephewNieceOf: "sobrino/a",
      kinCousinOf: "primo/a",
      kinChildInLawOf: "yerno/nuera",
      kinParentInLawOf: "suegro/a",
      kinSpouseChildOf: "padrastro/madrastra",
      kinStepParentOf: "hijastro/a",
      kinSiblingInLawOf: "cuñado/a",
      kinAncestorDegreeOf: "ancestro (grado {degree})",
      kinDescendantDegreeOf: "descendiente (grado {degree})",
      kinFamilyDegreeOf: "parentesco (grado {degree})",
      assocRelOf: "{subject} {is} {relation} {ofObject}",
      relationContext: "Por qué este vínculo",
      bookEvidence: "Prueba del libro",
      missingBookEvidence:
        "Todavía no hay una cita directa registrada para esta relación.",
      blurbs: {
        "les-rois-maudits/le-roi-de-fer":
          "Felipe el Hermoso, Isabel de Inglaterra y la maldición de los Templarios.",
        "01-three-body-problem":
          "Mapa de personajes construido capítulo a capítulo del primer libro.",
        "a-song-of-ice-and-fire-game-of-thrones":
          "Un amplio mapa del elenco de Poniente y más allá.",
        "greek-mythology":
          "Dioses, héroes y sus linajes entrelazados.",
        "the-simpsons":
          "La extensa familia y vecindario de Springfield.",
      },
      chapterTitles: {
        "/ged/a-song-of-ice-and-fire-game-of-thrones/ASOIAF.ged":
          "Elenco ASOIAF",
        "/ged/greek-mythology/greek-myth.ged": "Olímpicos y héroes",
        "/ged/the-simpsons/the-simpsons.ged": "Los Simpson",
      },
    },
  },
};

window.getLang = function getLang() {
  const stored = localStorage.getItem("cm_lang");
  if (stored && window.I18N.strings[stored]) return stored;
  const nav = (navigator.language || "en").slice(0, 2).toLowerCase();
  return window.I18N.strings[nav] ? nav : window.I18N.defaultLang;
};

window.setLang = function setLang(lang) {
  if (!window.I18N.strings[lang]) lang = window.I18N.defaultLang;
  localStorage.setItem("cm_lang", lang);
  document.documentElement.lang = lang;
  return lang;
};

window.t = function t(key, vars = {}) {
  const lang = window.getLang();
  const table = window.I18N.strings[lang] || window.I18N.strings.en;
  let value = key.split(".").reduce((acc, part) => {
    if (acc && typeof acc === "object" && part in acc) return acc[part];
    return undefined;
  }, table);

  if (value === undefined) {
    const fallback = window.I18N.strings.en;
    value = key.split(".").reduce((acc, part) => {
      if (acc && typeof acc === "object" && part in acc) return acc[part];
      return undefined;
    }, fallback);
  }

  if (typeof value !== "string") return key;
  return value.replace(/\{(\w+)\}/g, (_, name) =>
    vars[name] !== undefined ? String(vars[name]) : `{${name}}`
  );
};

window.applyStaticI18n = function applyStaticI18n() {
  document.title = window.t("pageTitle");

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = window.t(el.dataset.i18n);
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.setAttribute("placeholder", window.t(el.dataset.i18nPlaceholder));
  });

  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    el.setAttribute("aria-label", window.t(el.dataset.i18nAria));
  });

  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.setAttribute("title", window.t(el.dataset.i18nTitle));
  });

  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.lang === window.getLang());
  });
};

window.translateRelation = function translateRelation(relation) {
  if (!relation) return window.t("unknown");
  const map = {
    Spouse: "spouse",
    Parent: "parent",
    Sibling: "sibling",
  };
  return map[relation] ? window.t(map[relation]) : relation;
};

window.GED_MONTHS = {
  JAN: { en: "Jan", fr: "janv.", es: "ene." },
  FEB: { en: "Feb", fr: "févr.", es: "feb." },
  MAR: { en: "Mar", fr: "mars", es: "mar." },
  APR: { en: "Apr", fr: "avr.", es: "abr." },
  MAY: { en: "May", fr: "mai", es: "may." },
  JUN: { en: "Jun", fr: "juin", es: "jun." },
  JUL: { en: "Jul", fr: "juil.", es: "jul." },
  AUG: { en: "Aug", fr: "août", es: "ago." },
  SEP: { en: "Sep", fr: "sept.", es: "sept." },
  OCT: { en: "Oct", fr: "oct.", es: "oct." },
  NOV: { en: "Nov", fr: "nov.", es: "nov." },
  DEC: { en: "Dec", fr: "déc.", es: "dic." },
};

window.GED_DATE_WORDS = {
  en: {
    about: "about",
    before: "before",
    after: "after",
    between: "between",
    and: "and",
    estimated: "estimated",
    calculated: "calculated",
    from: "from",
    to: "to",
  },
  fr: {
    about: "vers",
    before: "avant",
    after: "après",
    between: "entre",
    and: "et",
    estimated: "estimé",
    calculated: "calculé",
    from: "de",
    to: "à",
  },
  es: {
    about: "hacia",
    before: "antes de",
    after: "después de",
    between: "entre",
    and: "y",
    estimated: "estimado",
    calculated: "calculado",
    from: "desde",
    to: "hasta",
  },
};

/** Format a GEDCOM DATE string for the active UI language. */
window.formatGedDate = function formatGedDate(dateStr) {
  if (dateStr == null || dateStr === "") return "";
  const raw = String(dateStr).trim();
  if (
    !raw ||
    /^unknown$/i.test(raw) ||
    /^inconnu(e)?$/i.test(raw) ||
    /^desconocido$/i.test(raw) ||
    raw === "?"
  ) {
    return window.t("unknown");
  }

  const lang = window.getLang();
  const words = window.GED_DATE_WORDS[lang] || window.GED_DATE_WORDS.en;

  const localizeMonthToken = (token) => {
    const key = token.toUpperCase().slice(0, 3);
    const months = window.GED_MONTHS[key];
    return months ? months[lang] || months.en : token;
  };

  const formatSimple = (chunk) => {
    let s = chunk.trim();
    if (!s) return "";

    // Strip/translate leading modifiers: ABT, EST, CAL, BEF, AFT, FROM, TO
    const modMatch = s.match(
      /^(ABT|ABOUT|CIR|CIRCA|EST|CAL|BEF|BEFORE|AFT|AFTER|FROM|TO)\s+(.+)$/i
    );
    let prefix = "";
    if (modMatch) {
      const mod = modMatch[1].toUpperCase();
      s = modMatch[2];
      if (mod === "ABT" || mod === "ABOUT" || mod === "CIR" || mod === "CIRCA") {
        prefix = words.about;
      } else if (mod === "EST") prefix = words.estimated;
      else if (mod === "CAL") prefix = words.calculated;
      else if (mod === "BEF" || mod === "BEFORE") prefix = words.before;
      else if (mod === "AFT" || mod === "AFTER") prefix = words.after;
      else if (mod === "FROM") prefix = words.from;
      else if (mod === "TO") prefix = words.to;
    }

    // D MMM YYYY | MMM YYYY | YYYY
    const full = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{3,4})$/);
    if (full) {
      const day = String(Number(full[1]));
      const month = localizeMonthToken(full[2]);
      const year = full[3];
      const body =
        lang === "en" ? `${day} ${month} ${year}` : `${day} ${month} ${year}`;
      return prefix ? `${prefix} ${body}` : body;
    }

    const monthYear = s.match(/^([A-Za-z]{3,9})\s+(\d{3,4})$/);
    if (monthYear) {
      const body = `${localizeMonthToken(monthYear[1])} ${monthYear[2]}`;
      return prefix ? `${prefix} ${body}` : body;
    }

    const yearOnly = s.match(/^(\d{3,4})$/);
    if (yearOnly) {
      return prefix ? `${prefix} ${yearOnly[1]}` : yearOnly[1];
    }

    // Fallback: replace month abbreviations anywhere in the string
    let body = s.replace(/\b([A-Za-z]{3,9})\b/g, (tok) => {
      const key = tok.toUpperCase().slice(0, 3);
      return window.GED_MONTHS[key]
        ? localizeMonthToken(tok)
        : tok;
    });
    return prefix ? `${prefix} ${body}` : body;
  };

  // BET date AND date
  const bet = raw.match(/^BET(?:WEEN)?\s+(.+?)\s+AND\s+(.+)$/i);
  if (bet) {
    return `${words.between} ${formatSimple(bet[1])} ${words.and} ${formatSimple(
      bet[2]
    )}`;
  }

  // FROM date TO date
  const fromTo = raw.match(/^FROM\s+(.+?)\s+TO\s+(.+)$/i);
  if (fromTo) {
    return `${words.from} ${formatSimple(fromTo[1])} ${words.to} ${formatSimple(
      fromTo[2]
    )}`;
  }

  return formatSimple(raw);
};

window.localizeChapterLabel = function localizeChapterLabel(label, file) {
  if (!label && !file) return "";
  const chapterMatch = String(label || "").match(/^Chapter\s+(\d+)$/i);
  if (chapterMatch) return window.t("chapterN", { n: chapterMatch[1] });
  if (/^Full map$/i.test(label)) return window.t("fullMap");
  if (/^Prologue/i.test(label)) return window.t("prologueAndChapter1");
  const upTo = String(file || "").match(/up-to-chapter-(\d+)/i);
  if (upTo && /^Up to chapter/i.test(label || "")) {
    return window.t("upToChapterN", { n: upTo[1] });
  }
  return label || "";
};

window.localizeChapterTitle = function localizeChapterTitle(title, file) {
  const mapped = window.t(`chapterTitles.${file}`);
  if (mapped && !mapped.startsWith("chapterTitles.")) return mapped;
  return title;
};

window.localizeBookBlurb = function localizeBookBlurb(book) {
  const mapped = window.t(`blurbs.${book.id}`);
  if (mapped && !mapped.startsWith("blurbs.")) return mapped;
  return book.blurb || "";
};
