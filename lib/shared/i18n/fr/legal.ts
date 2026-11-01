/**
 * The terms and the privacy text of the website (P3-08), as a first draft: what the service does, in plain words, and a bracketed mark where the
 * company or a lawyer must decide something that no code can say ([À COMPLÉTER : …] to fill in, [À VÉRIFIER : …] to check). Nothing here has
 * been read by a lawyer; `LEGAL_REVIEW` (src/legal.ts) says so, and the pages say so to the visitor until it is changed.
 *
 * A text is a title, an introduction and sections. A body is paragraphs separated by an empty line; lines that start with "- " make a list.
 * The bodies are read as they are, not through the message formatter: no braces, no straight apostrophe, and a square bracket only in a mark.
 * The facts come from the code, as it was on the date of the version: what the form asks, what the technicians see before and after a request
 * is given to them (the columns of the views of the server), who else receives data (SMS, e-mail, notifications, card payment), what the browser
 * keeps (the language cookie, the tracking links, the payment return), and what the server deletes by itself (almost nothing).
 */
export const legal = {
  draft: {
    title: 'Version provisoire',
    text: 'Ce texte est un projet : il n’a pas encore été relu par un juriste et il peut changer. Les passages entre crochets ne sont pas encore décidés.',
  },
  version: 'Version du {date}',
  draftVersion: 'Projet du {date}',
  back: 'Retour à l’accueil',
  other: 'À lire aussi',
  contents: 'Sommaire',
  terms: {
    title: 'Conditions générales d’utilisation et de vente',
    intro: 'Ce texte décrit les règles d’utilisation du site Smart-Dépannage et de vente de ses services de dépannage à domicile.',
    sections: {
      parties: {
        title: 'Qui est Smart-Dépannage',
        body: 'Smart-Dépannage met en relation des personnes qui ont besoin d’un dépannage à domicile (par exemple en plomberie, en électricité ou en serrurerie) et des techniciens qui interviennent chez elles.\n\nLe service est exploité par [À COMPLÉTER : raison sociale, forme juridique, registre de commerce, matricule fiscal et adresse du siège].\n\nLes techniciens sont [À COMPLÉTER : leur statut (indépendants ou salariés) et qui répond du travail réalisé].',
      },
      request: {
        title: 'Demander une intervention',
        body: 'Vous pouvez demander une intervention sans créer de compte avec un mot de passe, sauf si un compte existe déjà avec votre numéro ou votre e-mail : le site refuse alors la demande [À COMPLÉTER : que faire dans ce cas, le site n’ayant pas de page de connexion]. Vous décrivez le problème, vous ajoutez des photos (certains services en demandent), vous indiquez l’adresse, votre nom et un numéro de téléphone. Un lien qui permet de suivre la demande s’affiche alors à l’écran. Nous essayons aussi de vous l’envoyer par SMS, et par e-mail si vous avez donné votre e-mail, mais l’envoi n’est pas garanti. Gardez-le : c’est la seule clé de votre demande.\n\n[À COMPLÉTER : que faire si vous perdez le lien].\n\nLes informations que vous donnez servent à choisir un technicien et à préparer l’intervention. Des informations inexactes, ou un numéro qui ne répond pas, peuvent retarder ou empêcher l’intervention.',
      },
      quote: {
        title: 'Devis et prix',
        body: 'Les prix affichés sur le site sont indicatifs. Un devis peut être établi après examen de votre demande.\n\n[À COMPLÉTER : dans quels cas un devis est exigé avant les travaux, sa durée de validité, les frais de déplacement ou d’urgence éventuels].',
      },
      payment: {
        title: 'Paiement et facture',
        body: 'Le règlement se fait selon les moyens proposés pour votre demande. Lorsque le paiement par carte bancaire est proposé, il se fait sur la page d’un prestataire de paiement : Smart-Dépannage ne voit pas votre numéro de carte et ne le conserve pas.\n\n[À COMPLÉTER : quand une facture est établie, ses mentions obligatoires, la TVA, le timbre fiscal et le délai de règlement].',
      },
      cancellation: {
        title: 'Annulation et délais',
        body: 'Vous pouvez suivre votre demande avec le lien de suivi qui s’affiche à l’écran à l’envoi ; nous essayons aussi de vous l’envoyer par SMS, et par e-mail si vous avez donné votre e-mail.\n\n[À COMPLÉTER : comment vous annulez une demande (le site n’a pas de bouton d’annulation : c’est l’équipe qui annule), conditions d’annulation par vous et par le technicien, frais éventuels, délai d’intervention annoncé, et ce qui se passe si aucun technicien n’est disponible].',
      },
      responsibility: {
        title: 'Responsabilité et garanties',
        body: 'Cette partie dit qui répond des travaux réalisés chez vous et dans quelles limites.\n\n[À COMPLÉTER : garantie sur les travaux, limites de responsabilité, assurance, droit de rétractation éventuel].',
      },
      complaints: {
        title: 'Réclamations',
        body: 'Si l’intervention ne s’est pas passée comme prévu, vous pouvez le signaler à l’équipe depuis la page de suivi de votre demande. L’équipe examine le signalement ; le technicien de la demande peut le lire et y répondre.\n\n[À COMPLÉTER : comment et sous quel délai l’équipe vous recontacte (par exemple par téléphone, au numéro indiqué dans la demande), médiation éventuelle].',
      },
      data: {
        title: 'Données personnelles',
        body: 'Les informations que vous donnez sont traitées comme l’explique la politique de confidentialité de ce site.',
      },
      law: {
        title: 'Droit applicable et litiges',
        body: '[À COMPLÉTER : droit applicable, tribunal compétent, règlement amiable des litiges].',
      },
      changes: {
        title: 'Modification des conditions',
        body: 'Ces conditions peuvent changer. La version en vigueur est celle de cette page.\n\n[À COMPLÉTER : la version qui s’applique à votre demande, la conservation des versions successives et la preuve de la version vue au moment de la demande].\n\n[À VÉRIFIER : aujourd’hui le système n’enregistre ni la version affichée ni l’acceptation des conditions au moment d’une demande].\n\n[À COMPLÉTER : comment les changements importants sont annoncés].',
      },
    },
  },
  privacy: {
    title: 'Politique de confidentialité',
    intro: 'Ce texte explique quelles informations Smart-Dépannage reçoit quand vous utilisez le site, à quoi elles servent et qui peut les voir.',
    sections: {
      controller: {
        title: 'Qui traite vos données',
        body: 'Vos données sont traitées par [À COMPLÉTER : identité du responsable du traitement et adresse].\n\n[À COMPLÉTER : numéro de la déclaration ou de l’autorisation auprès de l’Instance nationale de protection des données personnelles, si elle est requise].',
      },
      collected: {
        title: 'Les informations que nous recevons',
        body: 'Quand vous demandez une intervention, vous nous donnez :\n- le type de problème, sa description et vos photos ;\n- l’adresse de l’intervention, et votre position si vous choisissez de la joindre ;\n- votre nom et votre numéro de téléphone, et si vous le voulez votre e-mail ;\n- vos précisions pour accéder au lieu, si vous en donnez.\n\nSans compte ne veut pas dire sans trace : un profil, sans mot de passe, est créé avec votre nom, votre téléphone, votre e-mail si vous en avez donné un, et la langue de la page, et une nouvelle demande faite avec le même numéro de téléphone (et le même e-mail, si vous en aviez donné un) y est rattachée. Vos photos sont réenregistrées sans leurs métadonnées (la position GPS de la photo, par exemple, est supprimée), mais le nom du fichier est conservé.\n\nLa suite de la demande ajoute vos questions sur un devis, le paiement, votre avis et vos signalements. Le technicien photographie les lieux avant et après son intervention : la photo est gardée avec la demande, avec l’heure et la position du technicien. Une signature du client peut être enregistrée à la fin de l’intervention. L’équipe peut ajouter des notes internes à votre dossier. Les factures reprennent votre nom, votre téléphone, votre e-mail et votre adresse et sont conservées.\n\nL’adresse IP de l’appareil sert à limiter les envois abusifs. [À VÉRIFIER : journaux d’accès de l’hébergeur et de son réseau de diffusion (adresses IP, adresses des pages visitées, y compris le lien de suivi, durée de conservation)].',
      },
      purposes: {
        title: 'À quoi elles servent',
        body: 'Vos informations servent à :\n- traiter votre demande et envoyer un technicien ;\n- essayer de vous envoyer par SMS, et par e-mail si vous avez donné votre e-mail, le lien de suivi, les devis, les factures et les messages sur l’avancement de la demande ;\n- établir les devis et les factures et recevoir le paiement ;\n- répondre à vos questions et à vos signalements ;\n- publier votre avis et en tirer la note du technicien ;\n- garder les positions envoyées par le technicien pendant l’intervention, pour traiter une réclamation ou un litige ;\n- protéger le service contre les envois automatiques et les abus.\n\n[À VÉRIFIER : le fondement de chaque usage selon la loi organique n° 2004-63, qui n’est peut-être pas celui de cette liste : votre consentement, l’exécution de la demande, une obligation légale].',
      },
      recipients: {
        title: 'Qui peut voir vos informations',
        body: '- L’équipe de Smart-Dépannage : plusieurs rôles (répartition, assistance, comptabilité, administration) voient le dossier complet, photos comprises, chacun pour son travail. Une alerte envoyée à la personne responsable indique le métier demandé et une adresse abrégée.\n- Les techniciens validés par Smart-Dépannage qui peuvent prendre la demande, tant qu’elle ne leur est pas confiée, ceux du métier concerné (de votre zone, si vous avez joint votre position) : ils voient le type de problème, la description, l’adresse, votre position si vous l’avez jointe, et votre nom. Ils ne voient pas votre téléphone, votre e-mail ni vos précisions pour accéder au lieu, et vos photos ne leur sont pas ouvertes. N’écrivez donc pas votre numéro ni un code dans la description.\n- Le technicien à qui la demande est confiée, qu’il l’ait prise lui-même ou que l’équipe la lui ait attribuée, même avant qu’il la confirme : il reçoit en plus votre téléphone, votre e-mail et vos précisions pour accéder au lieu, et peut ouvrir vos photos, pour pouvoir vous joindre et intervenir. Il garde ensuite la demande dans son historique, avec ces informations et l’accès à vos photos ; aucune durée n’est prévue aujourd’hui.\n- Le service de notifications des applications des techniciens (Expo, puis Apple ou Google selon le téléphone) : l’adresse de l’intervention figure dans la notification envoyée au technicien à qui la demande est proposée ou confiée.\n- Le prestataire qui envoie les SMS et les e-mails (dont le SMS envoyé au technicien à qui la demande est confiée, qui contient l’adresse) et, si vous payez par carte, le prestataire de paiement Konnect (qui reçoit le montant et le numéro de la demande), pour ce qui leur est nécessaire.\n- Google, Apple ou l’application de cartes choisie par le technicien, quand le technicien ouvre l’itinéraire vers votre position (si vous l’avez jointe) ; Google, quand l’équipe ouvre sur une carte une position où un technicien a été localisé ou a pris une photo.\n- Le technicien concerné et les utilisateurs connectés qui consultent son profil : votre avis, une fois validé par l’équipe, est publié avec votre nom ; le technicien concerné lit votre note et votre commentaire dès que vous les envoyez, et peut lire vos signalements et y répondre.\n- Toute personne qui possède votre lien de suivi : elle voit la demande (adresse, votre position si vous l’avez jointe, vos coordonnées, précisions pour accéder au lieu, devis, facture, nom et téléphone du technicien, et sa position quand il est en route) et peut agir à votre place : accepter ou refuser un devis, payer, ajouter des photos, laisser un avis, faire un signalement. Le lien passe aussi par le prestataire des SMS et des e-mails, et son adresse peut figurer dans les journaux de l’hébergeur. Il n’a pas de date d’expiration. Ne le partagez pas.\n\n[À COMPLÉTER : l’hébergeur des données, le prestataire des SMS et des e-mails, leurs pays, et les autorités à qui la loi impose de répondre].\n\n[À VÉRIFIER : formalités pour les prestataires situés hors de Tunisie, et faut-il n’afficher que le prénom avec l’avis].',
      },
      retention: {
        title: 'Combien de temps nous les gardons',
        body: '[À COMPLÉTER : durée de conservation des demandes, de leur position et de leur signature, des photos, des messages, du profil créé avec la demande, des notes internes, des factures (obligations comptables), des signalements, des notifications de l’application, du journal des envois, du journal d’audit et de l’historique des techniciens].\n\n[À VÉRIFIER : aujourd’hui le système ne supprime automatiquement ni les demandes, ni les photos, ni les messages, ni les notifications de l’application (qui reprennent, par exemple, l’adresse de l’intervention), ni les factures, ni les signalements, et le technicien garde l’historique de ses missions ; ne sont purgés que la file d’envoi des SMS, des e-mails et des notifications push (le texte d’un message est effacé à l’envoi, la ligne l’est après 30 jours), le journal des appels reçus du prestataire de paiement (90 jours) et les positions des techniciens (7 jours par défaut, plus longtemps en cas de réclamation ouverte ou de litige) ; le journal des envois, avec les numéros et les adresses e-mail, ne l’est pas].\n\n[À COMPLÉTER : les mesures de sécurité et les sauvegardes (où elles sont gardées, combien de temps)].\n\nLes liens de suivi gardés dans votre navigateur restent sur votre appareil jusqu’à ce que vous les supprimiez avec le bouton prévu à cet effet ou que votre navigateur les efface.',
      },
      rights: {
        title: 'Vos droits',
        body: 'Vous pouvez demander à voir les informations que nous avons sur vous, à les faire corriger et, dans la mesure où la loi et nos obligations (par exemple comptables) le permettent, à les faire supprimer, et vous opposer à certains usages, dans les conditions prévues par la loi organique n° 2004-63 du 27 juillet 2004 portant sur la protection des données à caractère personnel [À VÉRIFIER : référence de la loi, si elle est toujours le texte en vigueur, droits à citer et possibilité de saisir l’Instance dans tous les cas].\n\nPour cela, écrivez à [À COMPLÉTER : adresse de contact] en indiquant le numéro de la demande et le numéro de téléphone utilisé [À COMPLÉTER : comment votre identité est vérifiée]. Vous pouvez aussi saisir l’Instance nationale de protection des données personnelles.\n\n[À VÉRIFIER : aujourd’hui le système sait désactiver un profil mais pas supprimer ni anonymiser une demande, et les factures gardent l’identité du client ; la suppression se fait à la main].',
      },
      cookies: {
        title: 'Cookies et données gardées dans votre navigateur',
        body: '- Si vous choisissez une langue avec le bouton prévu, un cookie la retient pendant un an. La langue de la page est aussi transmise à nos serveurs pour vous répondre dans cette langue.\n- Les liens de suivi de vos demandes sont gardés dans votre navigateur, pour que vous puissiez les retrouver : le numéro de la demande et le secret du lien, le nom du service demandé et la date, sans votre nom, votre adresse ni votre téléphone. Ils sont enregistrés dès que vous ouvrez la page de suivi, sur n’importe quel appareil, et cinq au plus sont gardés.\n- Pendant un paiement par carte, le numéro de la demande en cours et le secret du lien sont gardés dans l’onglet. Ils sont ignorés au bout de trois heures et disparaissent à la fermeture de l’onglet.\n\nÀ la date de ce texte, le site n’utilise ni outil de mesure d’audience ni publicité.',
      },
      applicants: {
        title: 'Candidatures de techniciens',
        body: 'Si vous posez votre candidature de technicien sur la page d’inscription des techniciens, vous nous donnez votre nom, votre e-mail, votre téléphone, vos métiers, vos années d’expérience, vos zones d’intervention et une pièce d’identité, et, si vous les indiquez, le nom de votre entreprise, des documents d’entreprise et d’assurance, des numéros et une présentation. Un compte inactif est créé, et nous essayons de vous envoyer un accusé de réception par e-mail et par SMS. Ces documents ne sont vus que par l’équipe de vérification. Une fois votre candidature acceptée, les données de votre compte de technicien (votre position envoyée depuis l’application, vos interventions, vos encaissements) font l’objet d’une information distincte.\n\n[À COMPLÉTER : à quoi servent ces informations, combien de temps les pièces sont gardées, qui d’autre peut les voir, et l’information donnée aux techniciens sur les données de leur compte].',
      },
      changes: {
        title: 'Changements',
        body: 'Cette politique peut changer. La version en vigueur est celle de cette page.\n\n[À COMPLÉTER : comment les changements importants sont annoncés].',
      },
      contact: {
        title: 'Nous contacter',
        body: '[À COMPLÉTER : adresse e-mail, téléphone et adresse postale pour les questions sur les données personnelles].',
      },
    },
  },
} as const;
