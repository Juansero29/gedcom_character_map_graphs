#!/usr/bin/env python3
"""Patch up-to-chapter-7.ged with chapter 7 (La Tour des amours) content.

Exact string replacements only — no greedy whole-file regex rewrites.
"""
from pathlib import Path

ROOT = Path('/Users/juansero29/Projects/gedcom_character_map_graphs')
GED_DIR = ROOT / 'public/ged/les-rois-maudits/le-roi-de-fer'
SRC = GED_DIR / 'up-to-chapter-6.ged'
DST = GED_DIR / 'up-to-chapter-7.ged'


def must_replace(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'MISSING [{label}]:\n---\n{old[:400]}\n---')
    return text.replace(old, new, 1)


def main() -> None:
    if not DST.exists() or DST.stat().st_size < 1000:
        DST.write_text(SRC.read_text(encoding='utf-8'), encoding='utf-8')
    text = DST.read_text(encoding='utf-8')
    assert text.rstrip().endswith('0 TRLR'), 'GED must end with 0 TRLR'

    # ------------------------------------------------------------------
    # 1) Valois: illegal kinship ASSO Oncle → Mentor politique
    # ------------------------------------------------------------------
    text = must_replace(
        text,
        '''1 ASSO @I0003@
2 RELA Oncle
2 NOTE Après le conseil, lui dit que ce jour marque la fin de la chevalerie.
2 NOTE Louis Hutin est son neveu et interlocuteur.
2 QUOT "Mon neveu, dit Charles de Valois à Louis Hutin, nous aurons assisté ce jour à la fin de la chevalerie."''',
        '''1 ASSO @I0003@
2 RELA Mentor politique
2 NOTE Après le conseil, lui dit que ce jour marque la fin de la chevalerie.
2 NOTE Louis l'écoute ; le lien de sang oncle/neveu est déjà porté par les FAM (Philippe III → Valois ; Philippe le Bel → Louis).
2 QUOT "Mon neveu, dit Charles de Valois à Louis Hutin, nous aurons assisté ce jour à la fin de la chevalerie."''',
        'Valois Oncle→Mentor',
    )

    # ------------------------------------------------------------------
    # 2) Philippe d'Aunay (@I0041@) — NOTE/CONT + EVEN + ASSO enrich
    # ------------------------------------------------------------------
    text = must_replace(
        text,
        '''1 NOTE Bel écuyer de Valois, amant de Marguerite depuis quatre ans. Faible et pris : jaloux jusqu'à la rage, puis rassuré par un mot d'espoir. Se demande si la petite Jeanne est sa fille. Croisé par Robert à la sortie de Nesle ; ment maladroitement.
2 CONT Traits physiques : Beau garçon ; « oiseau au joli plumage » selon Robert ; longs cils ; menton blanc.
2 CONT Traits mentaux : Revendication et colère ; lâcheté amoureuse ; vanité blesse ; reprend confiance pour une parole.
2 CONT Rôle : Visiteur de l'hôtel de Nesle ; proie des filets d'Artois.
2 CONT Opinions politiques : Non précisé.
2 CONT Actions décisives principales : Apporte la ceinture ; dispute l'aumônière ; ment à Robert ; repart radieux.''',
        '''1 NOTE Bel écuyer de Valois, amant de Marguerite depuis quatre ans. Le soir du 18 mars, prévenu par Jeanne, il gagne la Tour de Nesle en barque avec son frère Gautier. Jaloux encore de l'aumônière le matin, il reçoit la bourse en cadeau, puis s'offre à Marguerite tandis qu'on lie les Templiers au bûcher.
2 CONT Traits physiques : Beau garçon ; « oiseau au joli plumage » selon Robert ; longs cils ; menton blanc ; contraste vivant avec Louis Hutin.
2 CONT Traits mentaux : Passion ravagée ou exaltée ; jalousie prompte ; tendresse ardente dès qu'il est rassuré ; dit aimer Marguerite parce qu'il ne la comprend pas.
2 CONT Rôle : Amant de la reine de Navarre à la Tour des amours ; témoin, depuis la meurtrière, de l'amenée des Templiers.
2 CONT Opinions politiques : Non précisé.
2 CONT Actions décisives principales : Traverse la Seine de nuit ; reçoit l'aumônière ; contemple l'île aux Juifs avec Marguerite ; s'unit à elle au moment où le bûcher est prêt.''',
        'Philippe NOTE',
    )

    text = must_replace(
        text,
        '''2 NOTE Antichambre, entrevue sous l'œil de Comminges, sortie face à Robert d'Artois.
1 ASSO @I0010@
2 RELA Amant
2 NOTE Amant de Marguerite depuis quatre ans.
2 NOTE Souffre de ses caprices et l'accuse sans preuve d'autres amants.
2 QUOT "Philippe d'Aunay, écuyer de Monseigneur de Valois, était depuis quatre ans l'amant de Marguerite de Bourgogne"''',
        '''2 NOTE Antichambre, entrevue sous l'œil de Comminges, sortie face à Robert d'Artois.
1 EVEN
2 TYPE Rendez-vous à la Tour de Nesle
2 DATE 18 MAR 1314
2 PLAC Tour de Nesle, Paris, France
2 NOTE Nuit : barque depuis le Louvre ; poterne ; chambre à jasmin ; amours avec Marguerite pendant qu'on amène Molay et Charnay au bûcher.
1 QUOT "Si je t'aime si fort, murmura-t-il, je crois bien que c'est parce que je ne te comprends pas."
1 QUOT "Ce bonhomme ne me plaît pas, il parle trop."
1 ASSO @I0010@
2 RELA Amant
2 NOTE Amant de Marguerite depuis quatre ans ; ce soir-là elle l'appelle à la Tour et s'offre à lui.
2 NOTE Elle lui donne l'aumônière qui l'avait irrité le matin, puis le tire vers la fenêtre pour voir le bûcher.
2 QUOT "Philippe d'Aunay, écuyer de Monseigneur de Valois, était depuis quatre ans l'amant de Marguerite de Bourgogne"
2 QUOT "Si je t'aime si fort, murmura-t-il, je crois bien que c'est parce que je ne te comprends pas."''',
        'Philippe EVEN+ASSO Marguerite',
    )

    text = must_replace(
        text,
        '''1 ASSO @I0011@
2 RELA Protégé
2 NOTE Jeanne favorise ses rendez-vous avec Marguerite et lui fournit des prétextes.
2 NOTE Elle le réprimande pour sa « sotte jalousie » et menace de le faire envoyer en Valois.
2 QUOT "épouse constante mais entremetteuse bénévole"''',
        '''1 ASSO @I0011@
2 RELA Protégé
2 NOTE Jeanne favorise ses rendez-vous avec Marguerite ; ce soir encore, c'est elle qui l'a prévenu.
2 NOTE Elle le réprimande pour sa jalousie et menace parfois de le faire envoyer en Valois.
2 QUOT "— Comment as-tu été prévenu ? — Par Jeanne, comme toujours."
2 QUOT "Chère comtesse Jeanne, que de grâces nous lui devons."''',
        'Philippe ASSO Jeanne',
    )

    text = must_replace(
        text,
        '''1 ASSO @I0025@
2 RELA Observé
2 NOTE La veuve Comminges le toise pendant l'entrevue ; il ne la connaît pas.
2 NOTE Elle fera rapport à Robert.
2 QUOT "il se sentait observé par la dame de parage"
1 FAMC @F0016@''',
        '''1 ASSO @I0025@
2 RELA Observé
2 NOTE La veuve Comminges le toise pendant l'entrevue ; il ne la connaît pas.
2 NOTE Elle fera rapport à Robert.
2 QUOT "il se sentait observé par la dame de parage"
1 ASSO @I0059@
2 RELA Passager
2 NOTE Emprunte avec Gautier la barque du vieux passeur, du Louvre à la Tour de Nesle.
2 NOTE Se méfie du batelier trop bavard sur le supplice des Templiers.
2 QUOT "Ce bonhomme ne me plaît pas, il parle trop."
2 QUOT "Plus vite, bonhomme, dit l'un des passagers."
1 FAMC @F0016@''',
        'Philippe ASSO batelier',
    )

    # ------------------------------------------------------------------
    # 3) Gautier d'Aunay (@I0042@)
    # ------------------------------------------------------------------
    text = must_replace(
        text,
        '''1 NOTE Frère aîné de Philippe d'Aunay ; écuyer de Poitiers ; amant de Blanche. La Tour de Nesle lui sert aussi d'asile avec Blanche, sous prétexte de visites à Marguerite.
2 CONT Traits physiques : Non précisé (hors scène). Traits mentaux : Dit « plus agréable » que Philippe par Blanche ; « mieux traité » selon son frère.
2 CONT Rôle : Second amant du scandale des brus ; pendant de Philippe auprès de Blanche.
2 CONT Opinions politiques : Non précisé.
2 CONT Actions décisives principales : Liaison avec Blanche ; ce soir-là privé de la tour de Nesle comme les autres.
1 ASSO @I0012@
2 RELA Amant
2 NOTE Maîtresse : Blanche, épouse de Charles de France.
2 NOTE Blanche le fait saluer par Philippe : elle « soupirera » après lui.
2 QUOT "Blanche se trouvait être la maîtresse de son frère, Gautier d'Aunay, écuyer du comte de Poitiers"
1 ASSO @I0004@
2 RELA Écuyer
2 NOTE Au service de Monseigneur de Poitiers.
2 NOTE Son maître ignore, ici, l'adultère qu'il entretient avec Blanche.
2 QUOT "un frère qui est à Monseigneur de Poitiers"
1 FAMC @F0016@''',
        '''1 NOTE Frère aîné de Philippe (d'une vingtaine de mois) ; écuyer de Poitiers ; amant de Blanche. Marié à une Montmorency, dont il a déjà trois enfants. Le soir du 18 mars, il gagne la Tour de Nesle avec Philippe et s'unit à Blanche tandis qu'on prépare le bûcher des Templiers.
2 CONT Traits physiques : Plus court, plus solide et plus blond que Philippe ; cou large ; joues rosées.
2 CONT Traits mentaux : Prend la vie avec amusement ; moins ravagé par la passion que son frère ; s'interroge sur les motifs de Blanche.
2 CONT Rôle : Amant de Blanche à la Tour des amours ; paie grassement le batelier.
2 CONT Opinions politiques : Non précisé.
2 CONT Actions décisives principales : Rendez-vous nocturne ; reçoit l'aumônière de Blanche ; reste étendu avec elle pendant que Marguerite regarde le supplice.
1 QUOT "Moi aussi, Philippe, je me sens bien aise."
1 QUOT "Je me demande toujours, dit-il, en se chauffant, pourquoi Blanche m'a pris pour amant"
1 EVEN
2 TYPE Rendez-vous à la Tour de Nesle
2 DATE 18 MAR 1314
2 PLAC Tour de Nesle, Paris, France
2 NOTE Arrive en barque avec Philippe ; s'étend avec Blanche tandis que, sur l'île aux Juifs, on lie les Templiers au bûcher.
1 ASSO @I0012@
2 RELA Amant
2 NOTE Maîtresse : Blanche, épouse de Charles de France ; ce soir-là ils s'étendent ensemble dans la Tour.
2 NOTE Il savoure sa chance tout en trouvant Charles plus beau que lui, « toute l'apparence du roi Philippe ».
2 QUOT "Blanche se trouvait être la maîtresse de son frère, Gautier d'Aunay, écuyer du comte de Poitiers"
2 QUOT "Alors, s'écria Blanche, je ne veux pas que mon bel amant soit moins aimé et moins paré que le tien."
1 ASSO @I0004@
2 RELA Écuyer
2 NOTE Au service de Monseigneur de Poitiers, absent ce soir-là.
2 NOTE Son maître ignore l'adultère qu'il entretient avec Blanche.
2 QUOT "un frère qui est à Monseigneur de Poitiers"
1 ASSO @I0059@
2 RELA Passager
2 NOTE Engage le passeur pour attendre « la moitié de la nuit » et le paie un sou d'argent.
2 NOTE Lui promet autant pour le retour.
2 QUOT "Alors, bonhomme, c'est bien convenu, lui dit Gautier d'Aunay ; tu nous attends sans t'éloigner"
2 QUOT "La moitié de la nuit sera assez, dit Gautier."
1 ASSO @I0060@
2 RELA Époux
2 NOTE Marié, et bien marié, à une Montmorency ; trois enfants déjà.
2 NOTE Le récit le montre amant de Blanche sans nommer davantage son ménage légitime.
2 QUOT "Il était marié, et bien marié, à une Montmorency, dont il avait déjà trois enfants."
2 QUOT "Gautier d'Aunay était d'une vingtaine de mois l'aîné de son frère Philippe"
1 FAMS @F0019@
1 FAMC @F0016@''',
        'Gautier block',
    )

    # Wait — Époux is kinship/spouse ASSO which skill forbids when FAM exists.
    # Fix: remove ASSO to wife; only FAMS @F0019@ (marriage is FAM).
    text = must_replace(
        text,
        '''1 ASSO @I0060@
2 RELA Époux
2 NOTE Marié, et bien marié, à une Montmorency ; trois enfants déjà.
2 NOTE Le récit le montre amant de Blanche sans nommer davantage son ménage légitime.
2 QUOT "Il était marié, et bien marié, à une Montmorency, dont il avait déjà trois enfants."
2 QUOT "Gautier d'Aunay était d'une vingtaine de mois l'aîné de son frère Philippe"
1 FAMS @F0019@
1 FAMC @F0016@''',
        '''1 FAMS @F0019@
1 FAMC @F0016@''',
        'Gautier remove spouse ASSO (use FAM)',
    )

    # ------------------------------------------------------------------
    # 4) Marguerite (@I0010@)
    # ------------------------------------------------------------------
    text = must_replace(
        text,
        '''1 NOTE Reine de Navarre à l'hôtel de Nesle. Petite, cheveu noir, teint ambré, « le plus beau corps du monde ». Depuis quatre ans amante de Philippe d'Aunay : savoure de tromper Louis et d'irriter son amant. A fait aménager la Tour pour les recevoir ; sent le soupçon monter (Louis, Comminges).
2 CONT Traits physiques : Petite ; cheveu noir ; teint ambré ; bouche ronde sensuelle ; menton court à fossette ; gorge charnue ; yeux sombres veloutés ; pieds nus petits et potelés ; bâille comme un chat.
2 CONT Traits mentaux : Fantasque ; ironique ; cruelle par jeu ; habile à ne pas se trahir ; lasse des querelles d'amant ; émue quand le regard de Philippe « mendie le bonheur ».
2 CONT Rôle : Cœur du chapitre ; maîtresse qui tient et torture Philippe d'Aunay sous l'œil de Comminges.
2 CONT Opinions politiques : Non précisé.
2 CONT Actions décisives principales : Reçoit Philippe en robe de maison ; écrit « Prudence » puis le brûle ; tease sur l'aumônière ; embrasse sa fille Jeanne ; rétablit la complicité amoureuse en espoir d'une nuit libre.''',
        '''1 NOTE Reine de Navarre à l'hôtel de Nesle. Petite, cheveu noir, teint ambré, « le plus beau corps du monde ». Depuis quatre ans amante de Philippe d'Aunay. Le soir du 18 mars, à la Tour des amours, elle lui offre l'aumônière, le tire à la meurtrière pour voir amener les Templiers, rit de Louis dans la loggia, puis s'offre à Philippe tandis qu'on lie les condamnés au bûcher.
2 CONT Traits physiques : Petite ; cheveu noir ; teint ambré ; front bombé ; bouche ronde sensuelle ; menton court à fossette ; gorge charnue ; yeux sombres veloutés ; épaules ambrées.
2 CONT Traits mentaux : Fantasque ; ironique ; cruelle par jeu le matin, tendre et offerte le soir ; curiosité trouble devant le supplice ; plaisir à narguer Louis à distance.
2 CONT Rôle : Maîtresse de la Tour des amours ; organise le rendez-vous nocturne avec Blanche.
2 CONT Opinions politiques : Non précisé.
2 CONT Actions décisives principales : Donne l'aumônière à Philippe ; ouvre le vitrail sur l'île aux Juifs ; se dévêt face à la nuit ; s'unit à Philippe au moment où l'on lie les Templiers.''',
        'Marguerite NOTE',
    )

    text = must_replace(
        text,
        '''1 EVEN
2 TYPE Entrevue avec Philippe d'Aunay
2 DATE 18 MAR 1314
2 PLAC Hôtel de Nesle, Paris, France
2 NOTE Ceinture de Jeanne ; aumônière mystérieuse ; message « Prudence » brûlé ; espoir d'une nuit si Louis est retenu au Conseil.
1 QUOT "Je t'aime."
1 QUOT "La prudence, dit alors Philippe, est une bonne excuse pour éloigner un amant et en accueillir d'autres."
1 QUOT "On vous aime et vous ne cessez de gronder."''',
        '''1 EVEN
2 TYPE Entrevue avec Philippe d'Aunay
2 DATE 18 MAR 1314
2 PLAC Hôtel de Nesle, Paris, France
2 NOTE Ceinture de Jeanne ; aumônière mystérieuse ; message « Prudence » brûlé ; espoir d'une nuit si Louis est retenu au Conseil.
1 EVEN
2 TYPE Nuit à la Tour des amours
2 DATE 18 MAR 1314
2 PLAC Tour de Nesle, Paris, France
2 NOTE Reçoit Philippe ; offre l'aumônière ; contemple depuis la meurtrière l'amenée des Templiers et la loggia du roi ; s'unit à son amant tandis qu'on lie Molay et Charnay.
1 QUOT "Je t'aime."
1 QUOT "La prudence, dit alors Philippe, est une bonne excuse pour éloigner un amant et en accueillir d'autres."
1 QUOT "On vous aime et vous ne cessez de gronder."
1 QUOT "Entendez-vous ? Les Templiers… On les amène-au bûcher."
1 QUOT "Ils vont brûler, ils vont griller, dit-elle d'une voix haletante et rauque, et nous pendant ce temps…"''',
        'Marguerite EVEN+QUOT',
    )

    text = must_replace(
        text,
        '''1 ASSO @I0041@
2 RELA Maîtresse
2 NOTE Amour de quatre ans ; elle chuchote « Je t'aime », le fait souffrir, puis lui rend espoir.
2 NOTE A transformé la Tour en chambre d'amour pour lui.
2 QUOT "Elle savourait le double plaisir de tromper son mari et d'irriter son amant."''',
        '''1 ASSO @I0041@
2 RELA Maîtresse
2 NOTE Amour de quatre ans ; le soir du 18 mars elle l'appelle à la Tour, lui donne l'aumônière et s'offre à lui.
2 NOTE Elle l'entraîne à la fenêtre pour voir le bûcher, puis se rapproche de la cheminée avant de s'unir à lui.
2 QUOT "Elle savourait le double plaisir de tromper son mari et d'irriter son amant."
2 QUOT "Que tu es sot, que tu es jaloux, que tu me plais !"''',
        'Marguerite ASSO Philippe',
    )

    text = must_replace(
        text,
        '''1 ASSO @I0012@
2 RELA Complice
2 NOTE Blanche partage la Tour comme asile amoureux avec Gautier.
2 NOTE Marguerite se veut « tout à la fois complaisante et complice ».
2 QUOT "Puis, quand son frère aîné Gautier était devenu l'amant de Blanche, la Tour avait également servi d'asile au nouveau couple."''',
        '''1 ASSO @I0012@
2 RELA Complice
2 NOTE Blanche partage la Tour comme asile amoureux avec Gautier ; ce soir-là toutes deux accueillent les frères d'Aunay.
2 NOTE Marguerite invite Blanche à montrer son aumônière ; Blanche refuse de quitter le lit pour voir le supplice.
2 QUOT "Puis, quand son frère aîné Gautier était devenu l'amant de Blanche, la Tour avait également servi d'asile au nouveau couple."
2 QUOT "Blanche, Gautier, venez voir ! dit Marguerite."''',
        'Marguerite ASSO Blanche',
    )

    # ------------------------------------------------------------------
    # 5) Jeanne (@I0011@)
    # ------------------------------------------------------------------
    text = must_replace(
        text,
        '''1 NOTE Comtesse de Poitiers, fille de Mahaut. Le chapitre 3 la montre grande, élancée, œil de lévrier : épouse constante de Philippe de Poitiers, pas encore maîtresse de personne, mais entremetteuse des amours de Marguerite et Blanche.
2 CONT Traits physiques : À peine vingt et un ans ; grande, élancée ; cheveux blond cendré ; long œil oblique de lévrier ; robe de velours gris clair, surcot bordé d'hermine.
2 CONT Traits mentaux : Peureuse devant le roi ; hauteur envers Philippe d'Aunay ; lasse de passer pour prude ; trouble plaisir à vivre les amours d'autrui ; fidèle à son mari.
2 CONT Rôle : Entremetteuse bénévole ; garde du secret des deux autres brus.
2 CONT Opinions politiques : Non précisé.
2 CONT Actions décisives principales : Présente Philippe d'Aunay au roi ; réprimande la jalousie de l'écuyer ; achète une ceinture pour Marguerite « une dernière fois ».''',
        '''1 NOTE Comtesse de Poitiers, fille de Mahaut. Épouse constante de Philippe de Poitiers, pas maîtresse de personne, mais entremetteuse des amours de Marguerite et Blanche. Dès que les époux sont absents le 18 mars, c'est elle qui porte le message de rendez-vous aux frères d'Aunay.
2 CONT Traits physiques : À peine vingt et un ans ; grande, élancée ; cheveux blond cendré ; long œil oblique de lévrier ; robe de velours gris clair, surcot bordé d'hermine.
2 CONT Traits mentaux : Peureuse devant le roi ; hauteur envers Philippe d'Aunay ; lasse de passer pour prude ; trouble plaisir à vivre les amours d'autrui ; fidèle à son mari ; serviable.
2 CONT Rôle : Entremetteuse bénévole ; messagère de la nuit du 18 mars.
2 CONT Opinions politiques : Non précisé.
2 CONT Actions décisives principales : Présente Philippe d'Aunay au roi ; réprimande sa jalousie ; achète une ceinture pour Marguerite ; prévient les amants du rendez-vous nocturne.''',
        'Jeanne NOTE',
    )

    text = must_replace(
        text,
        '''1 ASSO @I0041@
2 RELA Entremetteuse
2 NOTE Elle combine les rendez-vous de Marguerite et Philippe d'Aunay ; menace de le faire envoyer en Valois.
2 NOTE Elle lui fournit le prétexte d'une ceinture à porter à l'hôtel de Nesle.
2 QUOT "épouse constante mais entremetteuse bénévole, qui prenait un trouble plaisir à vivre les amours d'autrui"''',
        '''1 ASSO @I0041@
2 RELA Entremetteuse
2 NOTE Elle combine les rendez-vous de Marguerite et Philippe d'Aunay ; ce soir encore, c'est elle qui l'a prévenu.
2 NOTE Elle lui fournit le prétexte d'une ceinture et porte le message dès que les époux sont absents.
2 QUOT "épouse constante mais entremetteuse bénévole, qui prenait un trouble plaisir à vivre les amours d'autrui"
2 QUOT "— Comment as-tu été prévenu ? — Par Jeanne, comme toujours."''',
        'Jeanne ASSO Philippe',
    )

    text = must_replace(
        text,
        '''1 ASSO @I0010@
2 RELA Entremetteuse
2 NOTE Elle favorise l'intrigue de Marguerite et Philippe d'Aunay sans être elle-même maîtresse de personne.
2 NOTE Elle envoie l'écuyer à l'hôtel de Nesle avec une ceinture-prétexte.
2 QUOT "Allons, je vais être bonne. Je vais acheter pour Marguerite quelque pièce de parure que vous irez lui porter de ma part. Mais c'est la dernière fois."''',
        '''1 ASSO @I0010@
2 RELA Entremetteuse
2 NOTE Elle favorise l'intrigue de Marguerite et Philippe d'Aunay sans être elle-même maîtresse de personne.
2 NOTE Le soir du 18 mars, serviable une fois de plus, elle se charge du message de rendez-vous à la Tour.
2 QUOT "Allons, je vais être bonne. Je vais acheter pour Marguerite quelque pièce de parure que vous irez lui porter de ma part. Mais c'est la dernière fois."
2 QUOT "Et c'était la comtesse de Poitiers, serviable une fois de plus aux amours des autres, qui s'était chargée du message."''',
        'Jeanne ASSO Marguerite',
    )

    # ------------------------------------------------------------------
    # 6) Blanche (@I0012@)
    # ------------------------------------------------------------------
    text = must_replace(
        text,
        '''1 NOTE Épouse de Charles de France, sœur de Jeanne. Dix-huit ans, extravagante et candide en apparence ; maîtresse de Gautier d'Aunay. Seule à oser plaisanter le roi face à face.
2 CONT Traits physiques : Plus petite, ronde, rose ; fossettes ; blondeur chaude ; yeux marron clair brillants ; petites dents transparentes ; robe brodée de perles et d'or.
2 CONT Traits mentaux : Spontanée, audacieuse, habile à dissimuler ; donne le change au roi en avouant « dire du mal » de lui pour les nuits sans maris.
2 CONT Rôle : Adultère confirmée ; complice de l'intrigue avec Marguerite.
2 CONT Opinions politiques : Non précisé.
2 CONT Actions décisives principales : Sauve le groupe par sa présence d'esprit devant Philippe le Bel ; renonce ce soir à la tour de Nesle.
1 QUOT "C'est que… nous disions du mal de vous."
1 QUOT "En tout cas, ce soir, point de tour de Nesle"''',
        '''1 NOTE Épouse de Charles de France, sœur de Jeanne. Dix-huit ans, extravagante et candide en apparence ; maîtresse de Gautier d'Aunay. Le soir du 18 mars, à la Tour, elle s'étend avec lui, refuse de quitter le lit pour voir le supplice, et lui offre son aumônière.
2 CONT Traits physiques : Plus petite, ronde, rose ; fossettes ; blondeur chaude ; yeux marron clair brillants ; petites dents transparentes ; corps aux reflets de nacre.
2 CONT Traits mentaux : Spontanée, audacieuse ; s'abandonne au plaisir ; parfois détourne les yeux ; refuse de bouger quand Marguerite appelle à la fenêtre.
2 CONT Rôle : Adultère confirmée ; amante de Gautier à la Tour des amours.
2 CONT Opinions politiques : Non précisé.
2 CONT Actions décisives principales : Sauve le groupe devant le roi ; donne son aumônière à Gautier ; reste étendue avec lui pendant l'amenée des Templiers.
1 QUOT "C'est que… nous disions du mal de vous."
1 QUOT "En tout cas, ce soir, point de tour de Nesle"
1 QUOT "Ah ! Non, je ne veux bouger d'ici ; je suis trop bien."
1 QUOT "Alors, s'écria Blanche, je ne veux pas que mon bel amant soit moins aimé et moins paré que le tien."
1 EVEN
2 TYPE Nuit à la Tour des amours
2 DATE 18 MAR 1314
2 PLAC Tour de Nesle, Paris, France
2 NOTE S'étend avec Gautier ; offre l'aumônière ; refuse de regarder le bûcher.''',
        'Blanche NOTE+EVEN',
    )

    text = must_replace(
        text,
        '''1 ASSO @I0042@
2 RELA Maîtresse
2 NOTE Maîtresse de Gautier d'Aunay, frère de Philippe et écuyer de Poitiers.
2 NOTE Elle charge Philippe de dire à Gautier qu'elle « soupirera » après lui ce soir.
2 QUOT "Blanche se trouvait être la maîtresse de son frère, Gautier d'Aunay, écuyer du comte de Poitiers"''',
        '''1 ASSO @I0042@
2 RELA Maîtresse
2 NOTE Maîtresse de Gautier d'Aunay ; ce soir-là elle s'étend avec lui dans la Tour et lui donne son aumônière.
2 NOTE Elle refuse de quitter le lit pour voir amener les Templiers.
2 QUOT "Blanche se trouvait être la maîtresse de son frère, Gautier d'Aunay, écuyer du comte de Poitiers"
2 QUOT "Ah ! Non, je ne veux bouger d'ici ; je suis trop bien."''',
        'Blanche ASSO Gautier',
    )

    text = must_replace(
        text,
        '''1 ASSO @I0010@
2 RELA Complice
2 NOTE Partage avec Marguerite le secret des amours et des nuits à la tour de Nesle.
2 NOTE Ce soir-là, elle constate : « point de tour de Nesle ».
2 QUOT "l'intrigue des deux autres brus royales"''',
        '''1 ASSO @I0010@
2 RELA Complice
2 NOTE Partage avec Marguerite le secret des amours et des nuits à la tour de Nesle.
2 NOTE Ce soir du 18 mars, elles accueillent ensemble les frères d'Aunay ; Blanche s'inquiète un instant de l'imprudence de l'aumônière offerte.
2 QUOT "l'intrigue des deux autres brus royales"
2 QUOT "N'est-ce pas bien imprudent, Marguerite, ce que tu fais là ?"''',
        'Blanche ASSO Marguerite',
    )

    # ------------------------------------------------------------------
    # 7) Molay (@I0017@) — amené/lié, pas DEAT
    # ------------------------------------------------------------------
    text = must_replace(
        text,
        '''1 NOTE Prisonnier du Temple, conduit le 18 mars 1314 devant Notre-Dame. Après une sentence au mur (prison perpétuelle) présentée comme clémence, il proteste à pleine voix, retire ses aveux obtenus sous la torture, affirme l'innocence de l'Ordre — et est déclaré relaps avec Charnay.
2 CONT Traits physiques : Apparence de centenaire ; barbe d'ancêtre, bouche édentée ; guenilles ; tempes décharnées où le sang bat ; groupe des quatre « sculpté dans la cendre ».
2 CONT Traits mentaux : Colère croissante ; murmure « Mensonge… » ; vertige d'impuissance ; puis paix intérieure après la protestation.
2 CONT Rôle : Grand-maître qui brise le scénario du jugement public.
2 CONT Opinions politiques : L'Ordre est innocent et saint ; ses trois vrais ennemis absents restent le roi, Nogaret et le pape.
2 CONT Actions décisives principales : Avoue sous la torture puis retire tout au parvis ; proteste contre la sentence ; est remis à la justice du roi comme relaps et renvoyé au Temple.''',
        '''1 NOTE Prisonnier du Temple, conduit le 18 mars 1314 devant Notre-Dame. Après une sentence au mur, il proteste, retire ses aveux, est déclaré relaps. Le soir même, vu depuis la Tour de Nesle : silhouette grise coiffée d'un chapeau étrange, descendue d'une barque d'armes sur l'île aux Juifs, puis liée au bûcher — le feu n'est pas encore mis.
2 CONT Traits physiques : Apparence de centenaire ; barbe d'ancêtre, bouche édentée ; guenilles ; haute silhouette grise au chapeau étrange sur l'îlot.
2 CONT Traits mentaux : Colère croissante ; murmure « Mensonge… » ; vertige d'impuissance ; puis paix intérieure après la protestation.
2 CONT Rôle : Grand-maître condamné, amené au bûcher sous les yeux de la foule et du roi.
2 CONT Opinions politiques : L'Ordre est innocent et saint ; ses trois vrais ennemis absents restent le roi, Nogaret et le pape.
2 CONT Actions décisives principales : Proteste au parvis ; est remis à la justice du roi ; est amené et lié au bûcher de l'île aux Juifs.''',
        'Molay NOTE',
    )

    text = must_replace(
        text,
        '''1 EVEN
2 TYPE Condamnation royale au feu
2 DATE 18 MAR 1314
2 PLAC Conseil étroit, Palais de la Cité, Paris, France
2 NOTE Philippe le Bel ordonne qu'il soit brûlé le soir même à l'île aux Juifs avec Geoffroy de Charnay.
1 QUOT "Je proteste contre une sentence inique, et j'affirme que les crimes dont on nous charge sont crimes inventés !"''',
        '''1 EVEN
2 TYPE Condamnation royale au feu
2 DATE 18 MAR 1314
2 PLAC Conseil étroit, Palais de la Cité, Paris, France
2 NOTE Philippe le Bel ordonne qu'il soit brûlé le soir même à l'île aux Juifs avec Geoffroy de Charnay.
1 EVEN
2 TYPE Amené et lié au bûcher
2 DATE 18 MAR 1314
2 PLAC Île aux Juifs, Seine, Paris, France
2 NOTE Barque d'armes ; descente sous une croix ; cercle d'archers aux torches ; aides-bourreaux sur les rondins ; on le lie au bûcher — le feu n'est pas encore mis.
1 QUOT "Je proteste contre une sentence inique, et j'affirme que les crimes dont on nous charge sont crimes inventés !"''',
        'Molay EVEN amené',
    )

    # ------------------------------------------------------------------
    # 8) Charnay (@I0033@)
    # ------------------------------------------------------------------
    text = must_replace(
        text,
        '''1 NOTE Précepteur de Normandie, ami et successeur pressenti de Molay. Au parvis, sa cicatrice blanchit de fureur ; il rejoint la protestation du grand-maître et affirme leur innocence devant Dieu. Déclaré relaps avec Molay.
2 CONT Traits physiques : Cicatrice au front devenue blanche sur un front cramoisi ; guenilles comme les autres.
2 CONT Traits mentaux : Fureur égale à celle de Molay ; paix après avoir parlé ; docilité épuisée au retour vers le chariot.
2 CONT Rôle : Second protestataire ; unique appui fort du grand-maître.
2 CONT Opinions politiques : Victimes de complots et de fausses promesses ; l'Ordre est innocent.
2 CONT Actions décisives principales : Paie les fers ; serre la main de Molay ; accuse Marigny de haine et de vindicte ; est renvoyé au Temple.''',
        '''1 NOTE Précepteur de Normandie, ami et successeur pressenti de Molay. Déclaré relaps avec le grand-maître. Le soir du 18 mars, deuxième haute silhouette grise descendue sur l'île aux Juifs et liée au bûcher avec Molay — le feu n'est pas encore mis.
2 CONT Traits physiques : Cicatrice au front ; guenilles ; haute silhouette grise au chapeau étrange, jumelle de celle de Molay sur l'îlot.
2 CONT Traits mentaux : Fureur égale à celle de Molay ; paix après avoir parlé ; docilité épuisée au retour vers le chariot.
2 CONT Rôle : Second condamné amené au bûcher avec le grand-maître.
2 CONT Opinions politiques : Victimes de complots et de fausses promesses ; l'Ordre est innocent.
2 CONT Actions décisives principales : Proteste au parvis ; est amené et lié au bûcher de l'île aux Juifs.''',
        'Charnay NOTE',
    )

    text = must_replace(
        text,
        '''1 EVEN
2 TYPE Condamnation royale au feu
2 DATE 18 MAR 1314
2 PLAC Conseil étroit, Palais de la Cité, Paris, France
2 NOTE Condamné avec Molay à être brûlé le soir à l'île aux Juifs.
1 ASSO @I0040@''',
        '''1 EVEN
2 TYPE Condamnation royale au feu
2 DATE 18 MAR 1314
2 PLAC Conseil étroit, Palais de la Cité, Paris, France
2 NOTE Condamné avec Molay à être brûlé le soir à l'île aux Juifs.
1 EVEN
2 TYPE Amené et lié au bûcher
2 DATE 18 MAR 1314
2 PLAC Île aux Juifs, Seine, Paris, France
2 NOTE Amené avec Molay dans la barque d'armes ; lié au bûcher sous la clameur de la foule — le feu n'est pas encore mis.
1 ASSO @I0040@''',
        'Charnay EVEN amené',
    )

    # ------------------------------------------------------------------
    # 9) Philippe le Bel (@I0001@) — loggia
    # ------------------------------------------------------------------
    text = must_replace(
        text,
        '''2 CONT Actions décisives principales : Assemble le Conseil étroit ; coupe court aux digressions de Valois ; condamne Molay et Charnay au feu ; exige la présence des seigneurs (et de Charles) au supplice.''',
        '''2 CONT Actions décisives principales : Assemble le Conseil étroit ; coupe court aux digressions de Valois ; condamne Molay et Charnay au feu ; exige la présence des seigneurs au supplice ; prend place le soir dans la loggia de la tour de l'Eau face à l'île aux Juifs.''',
        'Roi actions',
    )

    text = must_replace(
        text,
        '''1 EVEN
2 TYPE Conseil étroit — condamnation au feu
2 DATE 18 MAR 1314
2 PLAC Palais de la Cité, Paris, France
2 NOTE Ordonne que Jacques de Molay et Geoffroy de Charnay soient brûlés le soir à l'île aux Juifs ; Nogaret rédige l'arrêt.
1 QUOT "Jacques de Molay et Geoffroy de Charnay seront brûlés ce soir dans l'île aux Juifs, face au jardin du Palais."''',
        '''1 EVEN
2 TYPE Conseil étroit — condamnation au feu
2 DATE 18 MAR 1314
2 PLAC Palais de la Cité, Paris, France
2 NOTE Ordonne que Jacques de Molay et Geoffroy de Charnay soient brûlés le soir à l'île aux Juifs ; Nogaret rédige l'arrêt.
1 EVEN
2 TYPE Présence à la loggia du supplice
2 DATE 18 MAR 1314
2 PLAC Tour de l'Eau, jardin du Palais, Paris, France
2 NOTE Le soir, une loggia s'éclaire dans la tour de l'Eau ; le roi et son Conseil y prennent place face à l'île aux Juifs où l'on amène les Templiers.
1 QUOT "Jacques de Molay et Geoffroy de Charnay seront brûlés ce soir dans l'île aux Juifs, face au jardin du Palais."''',
        'Roi EVEN loggia',
    )

    # ------------------------------------------------------------------
    # 10) Louis (@I0003@)
    # ------------------------------------------------------------------
    text = must_replace(
        text,
        '''1 NOTE Aîné du roi, vingt-cinq ans ; surnommé Louis Hutin (le Disputeur, le Confus). Au Conseil, rit nerveusement de l'aboiement de Lombard, propose naïvement de renvoyer les Templiers au pape — rabroué par son père.
2 CONT Traits physiques : Quelques traits du père ; regard fuyant ; cheveux sans lustre.
2 CONT Traits mentaux : Cervelle d'adolescent ; sot, incompétent aux yeux du roi ; fou rire malvenu.
2 CONT Rôle : Roi de Navarre siégeant à la gauche du père ; héritier dont Philippe doute.
2 CONT Opinions politiques : Suggère de confier les Templiers au pape (rejeté).
2 CONT Actions décisives principales : Siège au Conseil étroit ; essuie « Louis… taisez-vous » ; entend Valois lui prédire la fin de la chevalerie.''',
        '''1 NOTE Aîné du roi, vingt-cinq ans ; surnommé Louis Hutin (le Disputeur, le Confus). Au Conseil, rit nerveusement et propose de renvoyer les Templiers au pape — rabroué. Le soir, il est dans la loggia face à l'île aux Juifs ; Marguerite, à la Tour de Nesle, rit de savoir qu'il pourrait la voir s'il faisait jour.
2 CONT Traits physiques : Quelques traits du père ; regard fuyant (regard bas) ; cheveux sans lustre ; poitrine creuse selon Gautier d'Aunay.
2 CONT Traits mentaux : Cervelle d'adolescent ; sot, incompétent aux yeux du roi ; fou rire malvenu ; mari trompé sans le savoir.
2 CONT Rôle : Roi de Navarre à la gauche du père ; spectateur du supplice depuis la loggia.
2 CONT Opinions politiques : Suggère de confier les Templiers au pape (rejeté).
2 CONT Actions décisives principales : Siège au Conseil étroit ; essuie « Louis… taisez-vous » ; prend place le soir dans la loggia de la tour de l'Eau.''',
        'Louis NOTE',
    )

    text = must_replace(
        text,
        '''1 EVEN
2 TYPE Soupçon d'adultère de son épouse
2 DATE MAR 1314
2 PLAC Hôtel de Nesle, Paris, France
2 NOTE Robert d'Artois rapporte à Isabelle que Marguerite reçoit des amants quand Louis est absent.
1 ASSO @I0014@''',
        '''1 EVEN
2 TYPE Soupçon d'adultère de son épouse
2 DATE MAR 1314
2 PLAC Hôtel de Nesle, Paris, France
2 NOTE Robert d'Artois rapporte à Isabelle que Marguerite reçoit des amants quand Louis est absent.
1 EVEN
2 TYPE Présence à la loggia du supplice
2 DATE 18 MAR 1314
2 PLAC Tour de l'Eau, jardin du Palais, Paris, France
2 NOTE Présent avec le roi et le Conseil face à l'île aux Juifs ; Marguerite le nargue à distance depuis la Tour de Nesle.
1 QUOT "Parce que Louis est là-bas, répondit-elle, et que, s'il faisait jour, il pourrait me voir."
1 ASSO @I0014@''',
        'Louis EVEN loggia',
    )

    # ------------------------------------------------------------------
    # 11) New INDIs + FAM before TRLR
    # ------------------------------------------------------------------
    new_records = '''
0 @I0059@ INDI
1 NAME /Batelier de la Seine/
2 NICK le vieux passeur
1 SEX M
1 BIRT
2 DATE ABT 1261
2 PLAC Paris, France
1 OCCU Batelier ; passeur sur la Seine
1 QUOT "Un vrai temps de mécréant, ce jour d'hui, dit le batelier qui pesait lentement sur ses rames."
2 TYPE Première mention
1 NOTE Vieux passeur loqueteux, geignard, qui rame les frères d'Aunay du Louvre à la Tour de Nesle le soir du 18 mars 1314. Bavard sur le supplice des Templiers ; payé grassement pour attendre.
2 CONT Traits physiques : Vêtu de loques ; cinquante-trois ans à la Saint-Michel ; plus assez fort pour ramer vite.
2 CONT Traits mentaux : Geignard ; bavard ; cupide ; se complaît à prendre un ton plaintif.
2 CONT Rôle : Passeur nocturne des amants vers la Tour de Nesle.
2 CONT Opinions politiques : Curieux du spectacle royal — « vous n'allez donc point voir griller les Templiers ? »
2 CONT Actions décisives principales : Embarque Philippe et Gautier ; parle du roi et des princesses au supplice ; accepte d'attendre la moitié de la nuit pour un sou d'argent.
1 QUOT "Alors, mes gentilshommes, vous n'allez donc point voir griller les Templiers ?"
1 QUOT "Toute la vie si vous voulez, mon jeune seigneur, du moment que vous me payez pour cela"
1 EVEN
2 TYPE Traversée nocturne Louvre — Tour de Nesle
2 DATE 18 MAR 1314
2 PLAC Seine, Paris, France
2 NOTE Conduit les deux frères d'Aunay ; reste à attendre sans se laisser voir.
1 ASSO @I0041@
2 RELA Passeur
2 NOTE Embarque Philippe d'Aunay du Louvre vers la Tour de Nesle.
2 NOTE Philippe se méfie de son bavardage sur les Templiers.
2 QUOT "Ce bonhomme ne me plaît pas, il parle trop."
2 QUOT "Un vrai temps de mécréant, ce jour d'hui, dit le batelier qui pesait lentement sur ses rames."
1 ASSO @I0042@
2 RELA Passeur
2 NOTE Gautier l'engage à attendre la moitié de la nuit et le paie un sou d'argent.
2 NOTE Il salue bien bas et promet de rester sans s'éloigner.
2 QUOT "Alors, bonhomme, c'est bien convenu, lui dit Gautier d'Aunay ; tu nous attends sans t'éloigner"
2 QUOT "Toute la vie si vous voulez, mon jeune seigneur, du moment que vous me payez pour cela"

0 @I0060@ INDI
1 NAME /de Montmorency/
1 SEX F
1 BIRT
2 DATE Inconnu
2 PLAC France
1 OCCU Épouse de Gautier d'Aunay
1 QUOT "Il était marié, et bien marié, à une Montmorency, dont il avait déjà trois enfants."
2 TYPE Première mention
1 NOTE Épouse de Gautier d'Aunay, issue de la maison de Montmorency ; le récit ne lui donne pas de prénom. Mère de trois enfants déjà nés au 18 mars 1314.
2 CONT Traits physiques : Non précisé.
2 CONT Traits mentaux : Non précisé.
2 CONT Rôle : Épouse légitime de Gautier ; contraste du ménage avec l'adultère de la Tour de Nesle.
2 CONT Opinions politiques : Non précisé.
2 CONT Actions décisives principales : Non précisé (hors scène).
1 FAMS @F0019@

0 @F0019@ FAM
1 HUSB @I0042@
1 WIFE @I0060@
1 NOTE Mariage de Gautier d'Aunay avec une Montmorency ; trois enfants déjà nés (non nommés dans le récit).
1 QUOT "Il était marié, et bien marié, à une Montmorency, dont il avait déjà trois enfants."

'''

    if '0 @I0059@ INDI' in text:
        raise SystemExit('I0059 already present')
    if not text.rstrip().endswith('0 TRLR'):
        raise SystemExit('TRLR missing before insert')
    text = text.rstrip()
    if not text.endswith('0 TRLR'):
        raise SystemExit('unexpected end')
    text = text[: -len('0 TRLR')].rstrip() + '\n' + new_records + '0 TRLR\n'

    DST.write_text(text, encoding='utf-8')

    # ------------------------------------------------------------------
    # Verify
    # ------------------------------------------------------------------
    import re
    t = DST.read_text(encoding='utf-8')
    indi = len(re.findall(r'(?m)^0 @I\d+@ INDI', t))
    fam = len(re.findall(r'(?m)^0 @F\d+@ FAM', t))
    oncle = len(re.findall(r'(?m)^2 RELA Oncle\s*$', t))
    molay = re.search(r'(?m)^0 @I0017@ INDI\n(.*?)(?=^0 @)', t, re.S).group(0)
    molay_deat = '1 DEAT' in molay
    assert t.rstrip().endswith('0 TRLR')
    assert '0 @I0059@ INDI' in t and '0 @I0060@ INDI' in t and '0 @F0019@ FAM' in t
    assert '2 RELA Mentor politique' in t
    assert oncle == 0
    assert not molay_deat
    print('OK')
    print(f'path={DST}')
    print(f'INDI={indi} FAM={fam}')
    print(f'RELA Oncle count={oncle}')
    print(f'Molay DEAT={molay_deat}')
    print(f'new IDs: I0059 batelier, I0060 Montmorency, F0019')
    print(f'size={DST.stat().st_size}')


if __name__ == '__main__':
    main()
