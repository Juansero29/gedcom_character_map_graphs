#!/usr/bin/env python3
"""Patch up-to-chapter-8.ged — ch.8 « Je cite au tribunal de Dieu… »."""
from pathlib import Path

ROOT = Path("/Users/juansero29/Projects/gedcom_character_map_graphs")
GED = ROOT / "public/ged/les-rois-maudits/le-roi-de-fer"
SRC = GED / "up-to-chapter-7.ged"
DST = GED / "up-to-chapter-8.ged"


def must_replace(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        # Tolerate accidental trailing spaces in old fragments
        stripped = old.rstrip(" ")
        if stripped != old and stripped in text:
            old = stripped
        else:
            raise SystemExit(f"MISSING [{label}]:\n{old[:350]}\n---")
    return text.replace(old, new, 1)


def main() -> None:
    text = SRC.read_text(encoding="utf-8")
    assert text.rstrip().endswith("0 TRLR")

    # --- Philippe le Bel ---
    text = must_replace(
        text,
        """1 NOTE Roi de fer : calme, cruel, raison d'État. Passion pour les chiens (accepte les lévriers de Spinello Tolomei, nomme le plus grand « Lombard »). Au Conseil étroit du 18 mars, ordonne que Molay et Charnay soient brûlés le soir même à l'île aux Juifs.
2 CONT Traits physiques : Yeux immenses à la fixité effrayante ; cils immuables ; menton dans la main pendant le conseil.
2 CONT Traits mentaux : Silence pesant ; paroles rares ; accord immédiat avec les chiens ; commisération pour l'incompétence de Louis.
2 CONT Rôle : Juge suprême du sort des Templiers relaps.
2 CONT Opinions politiques : Novelletés avec Marigny ; refuse de renvoyer l'affaire au pape ; châtiment public pour rébellion publique.
2 CONT Actions décisives principales : Assemble le Conseil étroit ; coupe court aux digressions de Valois ; condamne Molay et Charnay au feu ; exige la présence des seigneurs au supplice ; prend place le soir dans la loggia de la tour de l'Eau face à l'île aux Juifs.""",
        """1 NOTE Roi de fer : calme, cruel, raison d'État. Le soir du 18 mars 1314, debout à la loggia de la tour de l'Eau, il croise le regard de Molay, fait le geste qui allume le bûcher, regarde jusqu'à la main noire de l'anathème, puis déclare n'avoir qu'une erreur : n'avoir pas fait arracher la langue des condamnés avant de les brûler.
2 CONT Traits physiques : Yeux immenses froids qui ne cillent pas ; bague étincelante au doigt quand il donne le signal.
2 CONT Traits mentaux : Impassible devant le supplice ; mesure Molay en silence ; refuse le triomphe de Valois.
2 CONT Rôle : Juge et spectateur du bûcher ; cible nommée de la malédiction de Molay.
2 CONT Opinions politiques : Novelletés avec Marigny ; châtiment public ; regrette seulement de n'avoir pas réduit les condamnés au silence.
2 CONT Actions décisives principales : Ordonne le feu d'un geste ; endure la fumée et la malédiction ; descend avec Nogaret, Marigny et Bouville.""",
        "Philippe NOTE",
    )

    text = must_replace(
        text,
        """1 EVEN
2 TYPE Présence à la loggia du supplice
2 DATE 18 MAR 1314
2 PLAC Tour de l'Eau, jardin du Palais, Paris, France
2 NOTE Le soir, une loggia s'éclaire dans la tour de l'Eau ; le roi et son Conseil y prennent place face à l'île aux Juifs où l'on amène les Templiers.
1 QUOT "Jacques de Molay et Geoffroy de Charnay seront brûlés ce soir dans l'île aux Juifs, face au jardin du Palais."
1 QUOT "La rébellion a été publique ; le châtiment sera public." """,
        """1 EVEN
2 TYPE Présence à la loggia du supplice
2 DATE 18 MAR 1314
2 PLAC Tour de l'Eau, jardin du Palais, Paris, France
2 NOTE Debout contre la balustrade avec son Conseil ; affrontement muet avec Molay ; geste de la main qui donne le signal au bourreau.
1 EVEN
2 TYPE Exécution de Molay et Charnay
2 DATE 18 MAR 1314
2 PLAC Île aux Juifs, Seine, Paris, France
2 NOTE Ordonne le brandon ; regarde Charnay puis Molay brûler ; fixe la main noire levée dans la cendre ; dit à Valois qu'il aurait dû faire arracher leur langue.
1 QUOT "Jacques de Molay et Geoffroy de Charnay seront brûlés ce soir dans l'île aux Juifs, face au jardin du Palais."
1 QUOT "La rébellion a été publique ; le châtiment sera public."
1 QUOT "Non, mon frère, dit-il. Je ne le suis point. J'ai commis une erreur."
1 QUOT "Oui, mon frère, dit le roi. J'aurais dû leur faire arracher la langue avant de les brûler." """,
        "Philippe EVEN+QUOT",
    )

    text = must_replace(
        text,
        """1 ASSO @I0017@
2 RELA Adversaire
2 NOTE Philippe le Bel a monté contre Jacques de Molay et les Templiers le plus vaste procès de l'Histoire.
2 NOTE La veille du vendredi 13 octobre 1307, il embrassait encore Molay et l'appelait son frère.
2 QUOT "La veille encore il m'embrassait et m'appelait son frère, en me donnant la première place aux obsèques de sa belle-sœur l'impératrice de Constantinople…" """,
        """1 ASSO @I0017@
2 RELA Adversaire
2 NOTE A monté le procès du Temple ; le soir du 18 mars, croise le regard de Molay puis ordonne le feu.
2 NOTE Molay le cite, avec Clément et Nogaret, au tribunal de Dieu avant un an, et maudit sa race jusqu'à la treizième génération.
2 QUOT "Pape Clément !… Chevalier Guillaume !… Roi Philippe !… Avant un an, je vous cite à paraître au tribunal de Dieu…"
2 QUOT "La veille encore il m'embrassait et m'appelait son frère, en me donnant la première place aux obsèques de sa belle-sœur l'impératrice de Constantinople…" """,
        "Philippe ASSO Molay",
    )

    # --- Louis ---
    text = must_replace(
        text,
        """1 NOTE Aîné du roi, vingt-cinq ans ; surnommé Louis Hutin (le Disputeur, le Confus). Au Conseil, rit nerveusement et propose de renvoyer les Templiers au pape — rabroué. Le soir, il est dans la loggia face à l'île aux Juifs ; Marguerite, à la Tour de Nesle, rit de savoir qu'il pourrait la voir s'il faisait jour.""",
        """1 NOTE Aîné du roi, vingt-cinq ans ; surnommé Louis Hutin. Au Conseil, rit nerveusement. Le soir, à la loggia, rit niaisement dans la fumée, raille le parrain d'Isabelle, s'inquiète un instant des lumières de Nesle signalées par Charles, puis se plaint de l'odeur de chair brûlée.""",
        "Louis NOTE",
    )

    text = must_replace(
        text,
        """2 CONT Actions décisives principales : Siège au Conseil étroit ; essuie « Louis… taisez-vous » ; prend place le soir dans la loggia de la tour de l'Eau.""",
        """2 CONT Actions décisives principales : Siège au Conseil ; essuie « Louis… taisez-vous » au bûcher comme au Conseil ; rit pendant le supplice ; veut partir à cause de l'odeur.""",
        "Louis CONT",
    )

    text = must_replace(
        text,
        """2 NOTE Présent avec le roi et le Conseil face à l'île aux Juifs ; Marguerite le nargue à distance depuis la Tour de Nesle.""",
        """2 NOTE Présent à la loggia ; rit dans la fumée ; demande à Charles s'il a bien vu des lumières à Nesle ; « Cela pue… Allons-nous-en. »
1 QUOT "Quoi ? Cela ne t'amuse-t-il donc pas de voir rôtir le parrain d'Isabelle ?"
1 QUOT "Cela pue, dit Louis de Navarre. Je trouve vraiment que cela pue trop. Allons-nous-en." """,
        "Louis EVEN note",
    )

    # --- Charles de la Marche ---
    text = must_replace(
        text,
        """1 NOTE Troisième fils du roi, marié à Blanche. Le chapitre 3 confirme qu'il porte les cornes par la grâce de Gautier d'Aunay, écuyer de Poitiers.
2 CONT Traits physiques : Non précisé. Traits mentaux : Non précisé (absent de la Galerie ce matin-là).
2 CONT Rôle : Prince royal ; mari trompé ; le roi annonce qu'il pourra tenir compagnie à Blanche le soir.
2 CONT Opinions politiques : Non précisé.
2 CONT Actions décisives principales : Parti le matin pour la chasse ; absent du Conseil ; le roi ordonne qu'on l'avertisse d'assister au supplice.""",
        """1 NOTE Troisième fils du roi, vingt ans, marié à Blanche. Beau comme une copie affaiblie de son père. À la loggia, détourne la tête du bûcher, signale des lumières à Nesle, songe à Blanche et aux deux enfants morts qu'elle lui a donnés, se demande s'il pourra jamais oublier.
2 CONT Traits physiques : Vingt ans ; élancé, blond et rose ; ressemble au roi Philippe jeune, en moins vigoureux.
2 CONT Traits mentaux : Sensible à l'horreur ; cherche l'oubli auprès de Blanche ; hanté par la mort de ses deux nouveau-nés.
2 CONT Rôle : Spectateur malheureux du supplice ; mari de Blanche.
2 CONT Opinions politiques : Non précisé.
2 CONT Actions décisives principales : Assiste au bûcher ; parle des lumières de Nesle à Louis ; rêve d'oublier dans les bras de Blanche.""",
        "Charles NOTE",
    )

    text = must_replace(
        text,
        """2 QUOT "deux fils de France, l'aîné, Louis, et le puîné, Charles, portaient les cornes par la grâce de deux écuyers"
1 FAMS @F0005@
1 FAMC @F0001@

0 @I0006@ INDI""",
        """2 QUOT "deux fils de France, l'aîné, Louis, et le puîné, Charles, portaient les cornes par la grâce de deux écuyers"
1 EVEN
2 TYPE Présence à la loggia du supplice
2 DATE 18 MAR 1314
2 PLAC Tour de l'Eau, jardin du Palais, Paris, France
2 NOTE Détourne la tête ; murmure qu'il céderait volontiers sa place ; songe à Blanche et à leurs enfants morts.
1 QUOT "Je viens de voir apparaître des lumières chez toi, dans la tour de Nesle, dit-il à Louis, à mi-voix."
1 QUOT "Je leur céderais volontiers ma place, murmura Charles."
1 FAMS @F0005@
1 FAMC @F0001@

0 @I0006@ INDI""",
        "Charles EVEN",
    )

    # --- Valois ---
    text = must_replace(
        text,
        """1 NOTE Frère du roi, ex-empereur titulaire de Constantinople, chef de la réaction féodale. Entre en coup de vent au Conseil, humilie Marigny (« Le Portier »), défend la chevalerie et le Temple, finit par s'en laver les mains. Pronostique à Louis « la fin de la chevalerie ».
2 CONT Traits physiques : Paraît plus âgé que Philippe ; nez gras ; joues couperosées ; panse arrogante ; vêtu de bleu et d'or ; belles mains chargées de bagues.
2 CONT Traits mentaux : Agité, brouillon, orgueilleux ; capable de réformer l'univers mais incapable d'un avis précis ; deteste Marigny.
2 CONT Rôle : Voix des hauts barons au Conseil ; adversaire politique de Marigny et Nogaret.
2 CONT Opinions politiques : Guerre privée, monnaies seigneuriales, chevalerie, soumission au Saint-Siège ; hostile aux « novelletés » et aux assemblées de bourgeois.
2 CONT Actions décisives principales : A conseillé la clémence (avec Isabelle) ; attaque Marigny et Nogaret au Conseil ; refuse un conseil clair ; parle à Louis Hutin de la fin de la chevalerie.""",
        """1 NOTE Frère du roi, chef de la réaction féodale. Au Conseil, humilie Marigny et s'en lave les mains. Au bûcher, tousse ostensiblement dans la fumée, raille Nogaret (« belle image de l'Enfer »), puis demande au roi s'il est content — et s'apprête à triompher quand Philippe parle d'« erreur ».
2 CONT Traits physiques : Paraît plus âgé que Philippe ; nez gras ; joues couperosées ; panse arrogante ; vêtu de bleu et d'or.
2 CONT Traits mentaux : Ostentatoire ; railleur ; prêt à triompher dès que le roi convient d'une faute.
2 CONT Rôle : Voix des barons ; spectateur sarcastique du supplice.
2 CONT Opinions politiques : Chevalerie, Saint-Siège ; hostile aux novelletés.
2 CONT Actions décisives principales : Conseil du matin ; tousse et raille au bûcher ; provoque la réplique du roi sur les langues.""",
        "Valois NOTE",
    )

    # --- Nogaret ---
    text = must_replace(
        text,
        """1 QUOT "Que ceux qui sont retombés dans l'hérésie subissent le châtiment des hérétiques, et sans délai"
0 @I0017@ INDI""",
        """1 QUOT "Que ceux qui sont retombés dans l'hérésie subissent le châtiment des hérétiques, et sans délai"
1 EVEN
2 TYPE Triomphe au bûcher des Templiers
2 DATE 18 MAR 1314
2 PLAC Tour de l'Eau / île aux Juifs, Paris, France
2 NOTE À la loggia, muscles tendus, œil ardent ; savoure sept ans de lutte ; cité nommément par Molay au tribunal de Dieu.
1 QUOT "Allez, grillez, flambez, pensait-il. Vous m'avez assez tenu en échec."
0 @I0017@ INDI""",
        "Nogaret EVEN",
    )

    # Enrich Nogaret ASSO Molay if exists - check Victime reverse on Molay side
    # Add on Nogaret toward Molay if not present
    if "1 ASSO @I0017@\n2 RELA Accusateur / tortionnaire" in text:
        text = must_replace(
            text,
            """1 ASSO @I0017@
2 RELA Accusateur / tortionnaire
2 NOTE A conduit les séances de torture jusqu'à l'aveu forcé de Molay.
2 NOTE Sa voix revient au grand-maître comme un cauchemar.
2 QUOT "Et toujours la voix sinistre de Guillaume de Nogaret : « Mais avouez donc, messire…»" """,
            """1 ASSO @I0017@
2 RELA Accusateur / tortionnaire
2 NOTE L'a torturé jusqu'à l'aveu ; au bûcher savoure sa défaite ; Molay le cite nommément (« Chevalier Guillaume ») au tribunal de Dieu.
2 NOTE Sept ans de procès aboutissent à cette flamme.
2 QUOT "Pape Clément !… Chevalier Guillaume !… Roi Philippe !… Avant un an, je vous cite à paraître au tribunal de Dieu…"
2 QUOT "Et toujours la voix sinistre de Guillaume de Nogaret : « Mais avouez donc, messire…»" """,
            "Nogaret ASSO Molay",
        )
    else:
        # find Nogaret's Molay ASSO
        pass

    # Find Nogaret block ASSO to Molay - might be different wording
    # From earlier: Guillaume has Accusateur / tortionnaire of Jacques
    if "Accusateur / tortionnaire de Jacques" not in text and "2 RELA Accusateur / tortionnaire" in text:
        # already handled or structure different - try alternate
        old_n = """2 RELA Accusateur / tortionnaire
2 NOTE"""
        # skip if already patched
        pass

    # --- Molay: death + curse ---
    text = must_replace(
        text,
        """1 NOTE Prisonnier du Temple, conduit le 18 mars 1314 devant Notre-Dame. Après une sentence au mur, il proteste, retire ses aveux, est déclaré relaps. Le soir même, vu depuis la Tour de Nesle : silhouette grise coiffée d'un chapeau étrange, descendue d'une barque d'armes sur l'île aux Juifs, puis liée au bûcher sous la clameur de la foule.
2 CONT Traits physiques : Apparence de centenaire ; barbe d'ancêtre, bouche édentée ; guenilles ; haute silhouette grise au chapeau étrange sur l'îlot.
2 CONT Traits mentaux : Colère croissante ; murmure « Mensonge… » ; vertige d'impuissance ; puis paix intérieure après la protestation.
2 CONT Rôle : Grand-maître condamné, amené au bûcher sous les yeux de la foule et du roi.
2 CONT Opinions politiques : L'Ordre est innocent et saint ; ses trois vrais ennemis absents restent le roi, Nogaret et le pape.
2 CONT Actions décisives principales : Proteste au parvis ; est remis à la justice du roi ; est amené et lié au bûcher de l'île aux Juifs.""",
        """1 NOTE Grand-maître du Temple. Après la protestation de Notre-Dame, brûlé le 18 mars 1314 à l'île aux Juifs face à la loggia royale. Sous la mitre d'hérétique, refuse de se confesser, parle à Charnay en flammes, crie la honte et cite Clément, Nogaret et Philippe au tribunal de Dieu avant un an — maudits jusqu'à la treizième génération. Sa main noire reste levée dans la cendre.
2 CONT Traits physiques : Barbe tordue par le vent ; mitre de papier ; visage en feu ; main noire d'anathème plantée dans la cendre.
2 CONT Traits mentaux : Inébranlable face au moine ; force prophétique au milieu des flammes ; combat la mort jusqu'à l'effondrement.
2 CONT Rôle : Martyr du Temple ; auteur de la malédiction qui pèse sur le roi, le pape et Nogaret.
2 CONT Opinions politiques : Innocents qui meurent ; Dieu jugera ; anathème sur les trois ennemis et leurs races.
2 CONT Actions décisives principales : Refuse la confession ; console Charnay ; lance la malédiction ; meurt la main levée.""",
        "Molay NOTE",
    )

    text = must_replace(
        text,
        """1 EVEN
2 TYPE Amené et lié au bûcher
2 DATE 18 MAR 1314
2 PLAC Île aux Juifs, Seine, Paris, France
2 NOTE Barque d'armes ; descente sous une croix ; cercle d'archers aux torches ; aides-bourreaux sur les rondins ; on le lie au bûcher sous la clameur.
1 QUOT "Je proteste contre une sentence inique, et j'affirme que les crimes dont on nous charge sont crimes inventés !"
1 QUOT "Je ne suis coupable, répondit Jacques de Molay, que d'avoir cédé à vos cajoleries, menaces et tourments."
1 QUOT "Je retire tout !" """,
        """1 EVEN
2 TYPE Amené et lié au bûcher
2 DATE 18 MAR 1314
2 PLAC Île aux Juifs, Seine, Paris, France
2 NOTE Lié au poteau sous la mitre d'hérétique, côte à côte avec Charnay, face à la loggia royale.
1 EVEN
2 TYPE Exécution au bûcher
2 DATE 18 MAR 1314
2 PLAC Île aux Juifs, Seine, Paris, France
2 NOTE Le brandon est enfoncé sur geste du roi ; après Charnay, les flammes l'atteignent ; il crie la malédiction ; s'effondre, main noire levée.
1 EVEN
2 TYPE Malédiction du grand-maître
2 DATE 18 MAR 1314
2 PLAC Île aux Juifs, Seine, Paris, France
2 NOTE Cite le pape Clément, le chevalier Guillaume (Nogaret) et le roi Philippe au tribunal de Dieu avant un an ; maudit leurs races jusqu'à la treizième génération.
1 DEAT
2 DATE 18 MAR 1314
2 PLAC Île aux Juifs, Seine, Paris, France
2 NOTE Brûlé vif ; la corde se rompt ; son corps tombe dans la fournaise ; sa main reste levée jusqu'à noircir.
1 QUOT "Je proteste contre une sentence inique, et j'affirme que les crimes dont on nous charge sont crimes inventés !"
1 QUOT "Je ne suis coupable, répondit Jacques de Molay, que d'avoir cédé à vos cajoleries, menaces et tourments."
1 QUOT "Je retire tout !"
1 QUOT "Honte ! Honte ! Vous voyez des innocents qui meurent. Honte sur vous tous ! Dieu vous jugera."
1 QUOT "Pape Clément !… Chevalier Guillaume !… Roi Philippe !… Avant un an, je vous cite à paraître au tribunal de Dieu pour y recevoir votre juste châtiment ! Maudits ! Maudits ! Tous maudits jusqu'à la treizième génération de vos races !…" """,
        "Molay death+curse",
    )

    text = must_replace(
        text,
        """1 ASSO @I0001@
2 RELA Adversaire royal
2 NOTE Philippe l'a d'abord embrassé et appelé son frère, puis a fait arrêter tout l'Ordre.
2 NOTE Molay répète ses trois ennemis : Clément, Guillaume, Philippe.
2 QUOT "La veille encore il m'embrassait et m'appelait son frère, en me donnant la première place aux obsèques de sa belle-sœur l'impératrice de Constantinople…" """,
        """1 ASSO @I0001@
2 RELA Adversaire royal
2 NOTE Affrontement muet à la loggia ; le roi ordonne le feu ; Molay le cite au tribunal de Dieu et maudit sa race.
2 NOTE Autrefois embrassé comme frère, puis détruit par le procès.
2 QUOT "Pape Clément !… Chevalier Guillaume !… Roi Philippe !… Avant un an, je vous cite à paraître au tribunal de Dieu…"
2 QUOT "La veille encore il m'embrassait et m'appelait son frère, en me donnant la première place aux obsèques de sa belle-sœur l'impératrice de Constantinople…" """,
        "Molay ASSO Philippe",
    )

    text = must_replace(
        text,
        """1 ASSO @I0016@
2 RELA Victime de torture
2 NOTE Nogaret l'a soumis aux brodequins et à l'étirement jusqu'à l'aveu forcé.
2 NOTE La voix froide du garde des Sceaux hante encore sa cellule.
2 QUOT "Et toujours la voix sinistre de Guillaume de Nogaret : « Mais avouez donc, messire…»" """,
        """1 ASSO @I0016@
2 RELA Victime de torture
2 NOTE Torturé par Nogaret ; au bûcher le nomme « Chevalier Guillaume » et le cite au tribunal de Dieu.
2 NOTE La foule murmure que la malédiction vise le roi, le pape et Nogaret.
2 QUOT "Pape Clément !… Chevalier Guillaume !… Roi Philippe !… Avant un an, je vous cite à paraître au tribunal de Dieu…"
2 QUOT "Et toujours la voix sinistre de Guillaume de Nogaret : « Mais avouez donc, messire…»" """,
        "Molay ASSO Nogaret",
    )

    text = must_replace(
        text,
        """1 ASSO @I0037@
2 RELA Ennemi / maudit
2 NOTE Molay veut la mort atroce du pape Clément avec celles de Nogaret et du roi.
2 NOTE Au parvis, il voudrait atteindre ses trois vrais ennemis absents : le roi, le garde des Sceaux, le pape.
2 QUOT "Qui crèverait ? Clément, Guillaume, Philippe… Le pape, le garde des Sceaux, le roi." """,
        """1 ASSO @I0037@
2 RELA Ennemi / maudit
2 NOTE Au bûcher, cite nommément « Pape Clément » au tribunal de Dieu avant un an et maudit sa race.
2 NOTE Rangé dès le parvis parmi les trois ennemis mortels.
2 QUOT "Pape Clément !… Chevalier Guillaume !… Roi Philippe !… Avant un an, je vous cite à paraître au tribunal de Dieu…"
2 QUOT "Qui crèverait ? Clément, Guillaume, Philippe… Le pape, le garde des Sceaux, le roi." """,
        "Molay ASSO Clément",
    )

    text = must_replace(
        text,
        """1 ASSO @I0033@
2 RELA Ami / mentor
2 NOTE Amitié de longue date ; Molay a fait toute la carrière de Charnay, de dix ans son cadet.
2 NOTE Il le voit comme son successeur et lui serre la main dans le chariot.
2 QUOT "Une longue amitié unissait les deux hommes ; Jacques de Molay avait fait toute la carrière de Charnay, de dix ans son cadet et dans lequel il voyait son successeur." """,
        """1 ASSO @I0033@
2 RELA Ami / mentor
2 NOTE Sur le bûcher, incline le visage vers Charnay en flammes et lui parle ; la foule n'entend que le mot « frère ».
2 NOTE Amitié de longue date ; Charnay est son successeur pressenti.
2 QUOT "le grand-maître inclinait le visage vers son compagnon, et lui parlait ; ... sinon le mot de « frère » par deux fois lancé."
2 QUOT "Une longue amitié unissait les deux hommes ; Jacques de Molay avait fait toute la carrière de Charnay, de dix ans son cadet et dans lequel il voyait son successeur." """,
        "Molay ASSO Charnay",
    )

    # --- Charnay death ---
    text = must_replace(
        text,
        """1 NOTE Précepteur de Normandie, ami et successeur pressenti de Molay. Déclaré relaps avec le grand-maître. Le soir du 18 mars, deuxième haute silhouette grise descendue sur l'île aux Juifs et liée au bûcher avec Molay sous la clameur de la foule.
2 CONT Traits physiques : Cicatrice au front ; guenilles ; haute silhouette grise au chapeau étrange, jumelle de celle de Molay sur l'îlot.
2 CONT Traits mentaux : Fureur égale à celle de Molay ; paix après avoir parlé ; docilité épuisée au retour vers le chariot.
2 CONT Rôle : Second condamné amené au bûcher avec le grand-maître.
2 CONT Opinions politiques : Victimes de complots et de fausses promesses ; l'Ordre est innocent.
2 CONT Actions décisives principales : Proteste au parvis ; est amené et lié au bûcher de l'île aux Juifs.""",
        """1 NOTE Précepteur de Normandie, ami de Molay. Brûlé le premier le 18 mars 1314 à l'île aux Juifs : le feu le plie, sa mitre tombe, il hurle et tente de s'arracher au poteau, puis n'est plus qu'un objet qui noircit et s'effondre en cendre tandis que Molay lui parle.
2 CONT Traits physiques : Mitre de papier consumée ; corps plié malgré la corde ; devient cendre dans le brasier.
2 CONT Traits mentaux : Pathétique recul quand le feu court ; hurle et halète ; reçoit les paroles de Molay.
2 CONT Rôle : Premier des deux Templiers consumés sous les yeux du roi.
2 CONT Opinions politiques : Innocence de l'Ordre.
2 CONT Actions décisives principales : Proteste au parvis ; meurt le premier sur le bûcher.""",
        "Charnay NOTE",
    )

    text = must_replace(
        text,
        """1 EVEN
2 TYPE Amené et lié au bûcher
2 DATE 18 MAR 1314
2 PLAC Île aux Juifs, Seine, Paris, France
2 NOTE Amené avec Molay dans la barque d'armes ; lié au bûcher sous la clameur de la foule.
1 ASSO @I0040@
2 RELA Adversaire""",
        """1 EVEN
2 TYPE Amené et lié au bûcher
2 DATE 18 MAR 1314
2 PLAC Île aux Juifs, Seine, Paris, France
2 NOTE Lié au poteau à côté de Molay, sous la mitre d'hérétique.
1 EVEN
2 TYPE Exécution au bûcher
2 DATE 18 MAR 1314
2 PLAC Île aux Juifs, Seine, Paris, France
2 NOTE Atteint le premier par les flammes ; s'effondre en cendre avant Molay.
1 DEAT
2 DATE 18 MAR 1314
2 PLAC Île aux Juifs, Seine, Paris, France
2 NOTE Brûlé vif ; son corps noircit, crépite et s'effondre dans la cendre.
1 ASSO @I0040@
2 RELA Adversaire""",
        "Charnay death",
    )

    # --- Alain de Pareilles ---
    text = must_replace(
        text,
        """1 NOTE Homme aux cheveux couleur d'acier, cotte de mailles, casque au creux du bras ; air d'ennui permanent. Conduit Molay et les dignitaires à Notre-Dame le 18 mars 1314.
2 CONT Traits physiques : Cheveux couleur d'acier en mèches courtes ; front carré ; cotte de mailles.
2 CONT Traits mentaux : Visage fermé, ennui professionnel devant les supplices.
2 CONT Rôle : Bras armé du roi pour les conduites au jugement.
2 CONT Opinions politiques : Exécute les ordres royaux sans commentaire.
2 CONT Actions décisives principales : Confirme que « c'est chose jugée » ; au parvis, forme une chaîne d'archers contre la foule ; sur ordre du prévôt, remmène les prisonniers au Temple.""",
        """1 NOTE Capitaine des archers, air ennuyé. Le soir du 18 mars, à cheval devant ses hommes sur l'île aux Juifs, relais le geste du roi vers le bourreau, fait éteindre les torches quand le brasier s'allume.
2 CONT Traits physiques : Chapeau de fer ; à cheval en avant des archers.
2 CONT Traits mentaux : Ennui professionnel ; exécutant précis.
2 CONT Rôle : Bras armé du supplice ; intermédiaire entre loggia et bourreau.
2 CONT Opinions politiques : Exécute les ordres royaux.
2 CONT Actions décisives principales : Conduit les dignitaires à Notre-Dame ; au bûcher, répète le geste royal et ordonne d'éteindre les torches.""",
        "Alain NOTE",
    )

    text = must_replace(
        text,
        """1 ASSO @I0017@
2 RELA Conducteur
2 NOTE Escorte Molay du Temple à Notre-Dame, puis le remmène au Temple après la protestation.
2 NOTE Immobile devant ses soldats pendant la lecture du jugement.
2 QUOT "Ramenez les prisonniers au Temple ! cria-t-il à Alain de Pareilles." """,
        """1 ASSO @I0017@
2 RELA Conducteur
2 NOTE Escorte Molay à Notre-Dame ; au bûcher, transmet l'ordre royal qui allume le brandon.
2 NOTE Fait éteindre les torches des archers quand les flammes jaillissent.
2 QUOT "Alain de Pareilles se tourna vers la loggia royale comme s'il demandait un ordre"
2 QUOT "Ramenez les prisonniers au Temple ! cria-t-il à Alain de Pareilles." """,
        "Alain ASSO Molay",
    )

    # --- Clément enrich ---
    text = must_replace(
        text,
        """1 NOTE Pape dépendant de Philippe le Bel ; Molay le maudit avec Nogaret et le roi. Espoir illusoire du visiteur général ; crainte d'un sort à la Boniface.
2 CONT Traits physiques : non précisés. Traits mentaux : Craintif, dépendant du roi selon le récit populaire.
2 CONT Rôle : Troisième ennemi nommé par Molay ; horizon politique du procès.
2 CONT Opinions politiques : A cédé au roi de France contre le Temple.
2 CONT Actions décisives principales : (Rapportées) a laissé condamner malgré lui ; objet de la haine de Molay.""",
        """1 NOTE Pape dépendant de Philippe le Bel. Au bûcher, Molay le cite nommément au tribunal de Dieu avant un an et maudit sa race jusqu'à la treizième génération ; la foule murmure que la malédiction vise le roi, le pape et Nogaret.
2 CONT Traits physiques : Non précisé (hors scène). Traits mentaux : Craintif, dépendant du roi selon le récit.
2 CONT Rôle : Première cible nommée de la malédiction du grand-maître.
2 CONT Opinions politiques : A cédé au roi contre le Temple.
2 CONT Actions décisives principales : Objet de l'anathème public de Molay.""",
        "Clément NOTE",
    )

    text = must_replace(
        text,
        """1 ASSO @I0017@
2 RELA Ennemi maudit
2 NOTE Molay veut sa mort dans d'atroces souffrances.
2 NOTE Rangé avec Guillaume et Philippe parmi les trois noms abhorrés.
2 QUOT "Qui crèverait ? Clément, Guillaume, Philippe…" """,
        """1 ASSO @I0017@
2 RELA Ennemi maudit
2 NOTE Cité en tête de la malédiction du bûcher : « Pape Clément !… » au tribunal de Dieu avant un an.
2 NOTE Rangé avec Guillaume et Philippe parmi les trois noms abhorrés.
2 QUOT "Pape Clément !… Chevalier Guillaume !… Roi Philippe !… Avant un an, je vous cite à paraître au tribunal de Dieu…"
2 QUOT "Qui crèverait ? Clément, Guillaume, Philippe…" """,
        "Clément ASSO Molay",
    )

    # --- Marigny light enrich ---
    marker = """1 FAMC @F0015@

0 @I0016@ INDI"""
    if marker in text and "Il le fallait, il le fallait" not in text:
        text = text.replace(
            marker,
            """1 EVEN
2 TYPE Présence à la loggia du supplice
2 DATE 18 MAR 1314
2 PLAC Tour de l'Eau, jardin du Palais, Paris, France
2 NOTE Se force à l'impassibilité du roi ; se répète « Il le fallait » ; se protège les yeux de l'éclat des flammes ; descend avec le roi après la malédiction.
1 QUOT "Il le fallait, il le fallait"
1 FAMC @F0015@

0 @I0016@ INDI""",
            1,
        )

    # Bouville — optional EVEN if portrait still thin
    if "0 @I0052@ INDI" in text and "priait sans se faire remarquer" not in text:
        text = must_replace(
            text,
            """0 @I0052@ INDI
1 NAME Hugues /de Bouville/
2 NICK Bouville
1 SEX M
1 BIRT
2 DATE ABT 1264
2 PLAC France
1 OCCU Premier chambellan ; grand chambellan du roi""",
            """0 @I0052@ INDI
1 NAME Hugues /de Bouville/
2 NICK Bouville
1 SEX M
1 BIRT
2 DATE ABT 1264
2 PLAC France
1 OCCU Premier chambellan ; grand chambellan du roi
1 EVEN
2 TYPE Présence à la loggia du supplice
2 DATE 18 MAR 1314
2 PLAC Tour de l'Eau, jardin du Palais, Paris, France
2 NOTE Prie sans se faire remarquer pendant que brûlent Molay et Charnay ; redescend avec le roi.""",
            "Bouville EVEN",
        )

    # --- F0005 children dead ---
    text = must_replace(
        text,
        """0 @F0005@ FAM
1 HUSB @I0005@
1 WIFE @I0012@
1 NOTE Mariage de Charles de France et Blanche de Bourgogne, fille de Mahaut.

1 QUOT "et puis ma douce Blanchette à votre beau Charles" """,
        """0 @F0005@ FAM
1 HUSB @I0005@
1 WIFE @I0012@
1 CHIL @I0063@
2 NOTE Premier des deux enfants de Charles et Blanche, mort presque aussitôt qu'apparu.
2 QUOT "le souvenir des deux enfants que Blanche lui avait donnés et qui étaient morts presque aussitôt qu'apparus"
1 CHIL @I0064@
2 NOTE Second enfant de Charles et Blanche, mort presque aussitôt qu'apparu.
2 QUOT "deux petites créatures qu'il revoyait, inertes, dans leurs langes brodés"
1 NOTE Mariage de Charles de France et Blanche de Bourgogne, fille de Mahaut ; deux nouveau-nés morts.
1 QUOT "et puis ma douce Blanchette à votre beau Charles" """,
        "F0005 children",
    )

    # --- Append new INDIs before TRLR ---
    new_indis = """
0 @I0061@ INDI
1 NAME /Moine du bûcher/
2 NICK le moine à la croix
1 SEX M
1 BIRT
2 DATE Inconnu
2 PLAC France
1 OCCU Moine ; exhortateur des condamnés
1 QUOT "Dans un instant vous allez comparaître devant Dieu. Il est temps encore de confesser vos fautes et de vous repentir… Je vous en adjure pour la dernière fois…"
2 TYPE Première mention
1 NOTE Moine qui tend un crucifix à longue hampe vers Molay et Charnay liés au poteau, les adjure de se confesser, puis s'agenouille pour prier en latin pendant que le bourreau prépare le brandon.
2 CONT Traits physiques : Non précisé. Traits mentaux : Zèle d'exhortation.
2 CONT Rôle : Dernière voix de l'Église avant le feu.
2 CONT Opinions politiques : Confession et repentir des condamnés.
2 CONT Actions décisives principales : Adjure les Templiers ; prie au pied du bûcher.
1 ASSO @I0017@
2 RELA Exhortateur
2 NOTE Tend le crucifix vers Molay et l'adjure de se confesser.
2 NOTE Molay et Charnay restent immobiles et ne répondent pas.
2 QUOT "Dans un instant vous allez comparaître devant Dieu. Il est temps encore de confesser vos fautes et de vous repentir…"
2 QUOT "Ils refusent de se confesser ; ils ne se repentent point, murmura-t-on dans l'assistance."
1 ASSO @I0033@
2 RELA Exhortateur
2 NOTE Adjure aussi le précepteur de Normandie.
2 NOTE Les deux condamnés restent silencieux.
2 QUOT "Dans un instant vous allez comparaître devant Dieu. Il est temps encore de confesser vos fautes et de vous repentir…"

0 @I0062@ INDI
1 NAME /Maître bourreau/
2 NICK le maître bourreau
1 SEX M
1 BIRT
2 DATE Inconnu
2 PLAC Paris, France
1 OCCU Maître bourreau
1 QUOT "Le maître bourreau prit de la main d'un de ses aides le brandon d'étoupe allumée qu'il fit tournoyer plusieurs fois pour en aviver la flamme."
2 TYPE Première mention
1 NOTE Bourreau encapuchonné de rouge qui, sur le signal transmis par Alain de Pareilles, enfonce le brandon dans les fagots du bûcher de Molay et Charnay.
2 CONT Traits physiques : Encapuchonné de rouge, comme ses aides.
2 CONT Traits mentaux : Souci du travail bien fait autour des rondins et fagots.
2 CONT Rôle : Exécutant du supplice sur l'île aux Juifs.
2 CONT Opinions politiques : Non précisé.
2 CONT Actions décisives principales : Avive le brandon ; enfonce le feu dans les fagots sur ordre.
1 EVEN
2 TYPE Mise à feu du bûcher
2 DATE 18 MAR 1314
2 PLAC Île aux Juifs, Seine, Paris, France
2 NOTE Sur le geste relayé depuis la loggia, enfonce le brandon d'étoupe dans les fagots.
1 ASSO @I0034@
2 RELA Exécutant
2 NOTE Reçoit le signal d'Alain de Pareilles, qui répète le geste du roi.
2 NOTE Enfonce alors le brandon dans le bûcher.
2 QUOT "Alain de Pareilles répéta le geste à l'intention du bourreau et celui-ci enfonça le brandon d'étoupe dans les fagots."
1 ASSO @I0017@
2 RELA Bourreau
2 NOTE Met le feu au bûcher où Molay est lié.
2 NOTE Ses aides attisent ensuite le foyer avec des crocs de fer.
2 QUOT "celui-ci enfonça le brandon d'étoupe dans les fagots."
1 ASSO @I0033@
2 RELA Bourreau
2 NOTE Le feu atteint Charnay le premier.
2 NOTE Les aides-bourreaux ajoutent des bûches pendant le supplice.
2 QUOT "Le précepteur de Normandie fut atteint le premier."

0 @I0063@ INDI
1 NAME /Enfant de Charles et Blanche/ l'aîné
2 NICK premier enfant mort-né ou mort-né tôt
1 SEX U
1 BIRT
2 DATE Inconnu
2 PLAC France
1 DEAT
2 DATE Inconnu
2 PLAC France
2 NOTE Mort presque aussitôt qu'apparu ; Charles s'en souvient pendant le bûcher.
1 QUOT "le souvenir des deux enfants que Blanche lui avait donnés et qui étaient morts presque aussitôt qu'apparus"
2 TYPE Première mention
1 NOTE Premier des deux enfants de Charles de la Marche et Blanche de Bourgogne, mort presque aussitôt après la naissance ; souvenir douloureux de Charles pendant le supplice des Templiers.
2 CONT Traits physiques : Petite créature inerte dans des langes brodés.
2 CONT Traits mentaux : Non précisé.
2 CONT Rôle : Enfant mort du couple princier ; ancrage du malaise de Charles.
2 CONT Opinions politiques : Non précisé.
2 CONT Actions décisives principales : Non précisé.
1 FAMC @F0005@

0 @I0064@ INDI
1 NAME /Enfant de Charles et Blanche/ le cadet
2 NICK second enfant mort-né ou mort-né tôt
1 SEX U
1 BIRT
2 DATE Inconnu
2 PLAC France
1 DEAT
2 DATE Inconnu
2 PLAC France
2 NOTE Mort presque aussitôt qu'apparu, comme son aîné.
1 QUOT "deux petites créatures qu'il revoyait, inertes, dans leurs langes brodés"
2 TYPE Première mention
1 NOTE Second enfant de Charles et Blanche, mort presque aussitôt après la naissance ; Charles se demande si d'autres enfants vivront.
2 CONT Traits physiques : Petite créature inerte dans des langes brodés.
2 CONT Traits mentaux : Non précisé.
2 CONT Rôle : Second enfant mort du couple ; hante le prince au bûcher.
2 CONT Opinions politiques : Non précisé.
2 CONT Actions décisives principales : Non précisé.
1 FAMC @F0005@

"""

    if not text.rstrip().endswith("0 TRLR"):
        raise SystemExit("TRLR missing before append")
    text = text.rstrip()[:-6] + new_indis + "\n0 TRLR\n"

    # Patch Nogaret ASSO Molay if still old
    old_nog = """1 ASSO @I0017@
2 RELA Accusateur / tortionnaire
2 NOTE A conduit les séances de torture jusqu'à l'aveu forcé de Molay.
2 NOTE Sa voix revient au grand-maître comme un cauchemar.
2 QUOT "Et toujours la voix sinistre de Guillaume de Nogaret : « Mais avouez donc, messire…»" """
    # This is on Molay side already patched. Nogaret's own ASSO:
    # From ch6: Guillaume de Nogaret est Accusateur / tortionnaire de Jacques
    # Find on Nogaret block
    import re

    m = re.search(
        r"(?m)^0 @I0016@ INDI\n(.*?)(?=^0 @I0017@ INDI)", text, re.S
    )
    if m and "tribunal de Dieu" not in m.group(1):
        block = m.group(1)
        old = """1 ASSO @I0017@
2 RELA Accusateur / tortionnaire
2 NOTE"""
        if old in block:
            # more precise
            sub = re.search(
                r"1 ASSO @I0017@\n2 RELA Accusateur / tortionnaire\n2 NOTE .+\n2 NOTE .+\n2 QUOT .+",
                block,
            )
            if sub:
                new_asso = """1 ASSO @I0017@
2 RELA Accusateur / tortionnaire
2 NOTE Au bûcher, savoure le triomphe de sept ans de procès ; Molay le cite nommément au tribunal de Dieu.
2 NOTE La foule murmure que la malédiction vise aussi Nogaret.
2 QUOT "Pape Clément !… Chevalier Guillaume !… Roi Philippe !… Avant un an, je vous cite à paraître au tribunal de Dieu…"
2 QUOT "Allez, grillez, flambez, pensait-il. Vous m'avez assez tenu en échec." """
                text = text.replace(sub.group(0), new_asso, 1)

    # Blanche enrich for dead children memory from Charles POV - light NOTE update
    text = must_replace(
        text,
        """1 NOTE Épouse de Charles de France, sœur de Jeanne. Dix-huit ans, extravagante et candide en apparence ; maîtresse de Gautier d'Aunay. Le soir du 18 mars, à la Tour, elle s'étend avec lui, refuse de quitter le lit pour voir le supplice, et lui offre son aumônière.""",
        """1 NOTE Épouse de Charles de France, sœur de Jeanne ; maîtresse de Gautier d'Aunay. A donné à Charles deux enfants morts presque aussitôt. Le soir du 18 mars, à la Tour de Nesle avec Gautier tandis que Charles, à la loggia, songe à elle pour oublier le bûcher.""",
        "Blanche NOTE",
    )

    DST.write_text(text, encoding="utf-8")

    # smoke
    assert DST.read_text(encoding="utf-8").rstrip().endswith("0 TRLR")
    assert "1 DEAT" in re.search(
        r"(?m)^0 @I0017@ INDI\n(.*?)(?=^0 )", text, re.S
    ).group(1)
    assert "1 DEAT" in re.search(
        r"(?m)^0 @I0033@ INDI\n(.*?)(?=^0 )", text, re.S
    ).group(1)
    assert "tribunal de Dieu" in text
    assert "@I0064@" in text
    print("OK", DST, "chars", len(text))
    print("INDI", len(re.findall(r"(?m)^0 @I\d+@ INDI", text)))
    print("FAM", len(re.findall(r"(?m)^0 @F\d+@ FAM", text)))


if __name__ == "__main__":
    main()
