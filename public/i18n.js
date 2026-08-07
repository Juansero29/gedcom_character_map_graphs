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
      searchCharacters: "Search characters…",
      layoutHierarchy: "Hierarchy",
      layoutForce: "Free",
      layoutHierarchyHint: "Top = born earlier, bottom = born later",
      layoutForceHint: "Classic free-floating force layout",
      horizontalSpread: "Spread",
      horizontalSpreadHint:
        "Horizontal spacing of the graph — higher = wider, easier to read names",
      legendTitle: "Legend",
      legendToggleHint: "Show or hide the graph legend",
      legendMale: "Man",
      legendFemale: "Woman",
      legendFamily: "Blood / family link",
      legendAssociation: "Other association",
      legendDeceased: "Deceased",
      narrativeTitle: "Narrative time",
      narrativeScrub: "Move through the chapter",
      narrativeSpan: "Story time span: {span}",
      narrativeLocation: "Setting: {location}",
      narrativeAge: "Age at this moment",
      narrativeAgeValue: "{age} years old",
      narrativeAgeApprox: "~{age} years old",
      narrativeDead: "Already deceased at this moment",
      narrativeDeadSince: "Deceased ({when})",
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
      searchCharacters: "Rechercher des personnages…",
      layoutHierarchy: "Hiérarchie",
      layoutForce: "Libre",
      layoutHierarchyHint: "Haut = nés plus tôt, bas = nés plus tard",
      layoutForceHint: "Disposition libre par forces",
      horizontalSpread: "Étalement",
      horizontalSpreadHint:
        "Espacement horizontal du graphe — plus élevé = plus large, noms plus lisibles",
      legendTitle: "Légende",
      legendToggleHint: "Afficher ou masquer la légende du graphe",
      legendMale: "Homme",
      legendFemale: "Femme",
      legendFamily: "Lien de sang / famille",
      legendAssociation: "Autre association",
      legendDeceased: "Décédé(e)",
      narrativeTitle: "Temps narratif",
      narrativeScrub: "Parcourir le chapitre",
      narrativeSpan: "Durée dans le récit : {span}",
      narrativeLocation: "Lieu : {location}",
      narrativeAge: "Âge à cet instant",
      narrativeAgeValue: "{age} ans",
      narrativeAgeApprox: "~{age} ans",
      narrativeDead: "Déjà décédé(e) à cet instant",
      narrativeDeadSince: "Décédé(e) ({when})",
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
      searchCharacters: "Buscar personajes…",
      layoutHierarchy: "Jerarquía",
      layoutForce: "Libre",
      layoutHierarchyHint: "Arriba = nacidos antes, abajo = nacidos después",
      layoutForceHint: "Disposición libre por fuerzas",
      horizontalSpread: "Amplitud",
      horizontalSpreadHint:
        "Espaciado horizontal del grafo — más alto = más ancho, nombres más legibles",
      legendTitle: "Leyenda",
      legendToggleHint: "Mostrar u ocultar la leyenda del grafo",
      legendMale: "Hombre",
      legendFemale: "Mujer",
      legendFamily: "Vínculo de sangre / familia",
      legendAssociation: "Otra asociación",
      legendDeceased: "Fallecido/a",
      narrativeTitle: "Tiempo narrativo",
      narrativeScrub: "Recorrer el capítulo",
      narrativeSpan: "Duración en el relato: {span}",
      narrativeLocation: "Lugar: {location}",
      narrativeAge: "Edad en este momento",
      narrativeAgeValue: "{age} años",
      narrativeAgeApprox: "~{age} años",
      narrativeDead: "Ya fallecido/a en este momento",
      narrativeDeadSince: "Fallecido/a ({when})",
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
