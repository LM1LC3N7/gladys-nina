# NINA (alertes allemandes)

**Connecteur non officiel, sans lien avec le BBK** (Bundesamt für
Bevölkerungsschutz und Katastrophenhilfe, l'Office fédéral allemand de la
protection de la population). Il amène dans Gladys les alertes officielles
que l'application d'alerte NINA affiche pour la commune de votre maison :
protection civile (MoWaS, KATWARN, BIWAPP), fortes intempéries (DWD), crues
et messages de police. Il lit l'API publique NINA de warnung.bund.de : sans
compte ni clé. Source : BBK / NINA (warnung.bund.de).

> **Ce n'est pas un système de sécurité.** L'intégration lit les alertes
> toutes les quelques minutes et peut en manquer ou en retarder une. Fiez-vous
> toujours aux canaux officiels : l'application NINA, les sirènes, la
> diffusion cellulaire, la radio et la télévision.

## Ce que vous obtenez

| Surface                                         | Contenu                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Un appareil par **maison située en Allemagne**  | le nombre d'alertes en cours, la gravité la plus haute (0 aucune, 1 mineure, 2 modérée, 3 sévère, 4 extrême) et le titre de l'alerte la plus grave                                                                                                                                                  |
| Un appareil par **commune saisie** (facultatif) | la même chose, pour une commune ou un district entier que vous saisissez (maison de vacances, ville de la famille, maison sans emplacement)                                                                                                                                                         |
| Déclencheurs de scène                           | **Alerte NINA émise** (gravité minimale, source) et **Alerte NINA terminée** (fin d'alerte, expirée ou retirée)                                                                                                                                                                                     |
| Action de scène                                 | **Alertes NINA** d'une maison : nombre, gravité la plus haute, titres et un résumé prêt à envoyer                                                                                                                                                                                                   |
| Widget                                          | **Alertes NINA** : l'état d'un coup d'œil (une coche verte, ou le nombre d'alertes dans la couleur de la plus grave), les alertes en cours avec leur gravité, leur source et leur heure ; touchez-en une pour le texte officiel et le lien vers warnung.bund.de ; les fins d'alerte restent listées |

## Installation

1. Renseignez l'emplacement de votre maison dans Gladys (**Paramètres →
   Maisons**) et acceptez l'accès à la localisation en installant
   l'intégration.
2. Ouvrez **Découverte** : l'intégration trouve la commune de votre maison
   comme le fait l'application officielle (sa grille de l'Allemagne, puis le
   contour des communes) et propose un appareil « NINA Maison ». Ajoutez-le.
3. Facultatif : saisissez d'autres communes dans **Communes à surveiller**,
   séparées par des virgules, par leur nom (`Alsdorf`) ou leur ARS, la clé
   régionale officielle à 12 chiffres (`053340004004`). Pour un nom porté par
   plusieurs communes, ajoutez le district : `Neuenkirchen (Diepholz)`. Un nom
   de district ou son code à 5 chiffres (`05334`) surveille tout le district.
   Le bouton **Chercher une commune** donne les noms exacts et les ARS : une
   ligne de sa réponse (`Sandhausen (Rhein-Neckar-Kreis) – 082260076076`) se
   colle telle quelle. Enregistrez, rouvrez **Découverte** et ajoutez les appareils.
4. Placez le widget **Alertes NINA** sur un tableau de bord et choisissez
   l'appareil.

Le bouton **Tester NINA** indique dans quelle commune chaque maison a été
trouvée et combien d'alertes sont en cours.

## Sources et langues

- **Sources à garder** : comme dans l'application NINA. Si l'intégration DWD
  vous donne déjà les avertissements météo, décochez ici « Fortes
  intempéries (DWD) ».
- **Textes** : les alertes sont rédigées en allemand par les autorités. NINA
  traduit le nom de l'événement de la plupart des alertes de protection
  civile (« Nuisance olfactive ») : le titre est affiché en français ou en
  anglais quand la traduction existe, en allemand sinon. Le titre officiel,
  la description et les consignes sont toujours les originaux allemands,
  affichés sans modification (le BBK n'autorise l'usage des alertes que sans
  modification du contenu et à des fins non commerciales). L'option
  **Langue** règle les titres des appareils et des variables de scène ; le
  widget suit la langue de l'utilisateur.
- **Allemand** : la configuration, les boutons et le widget s'affichent en
  allemand quand Gladys est en allemand. Choisissez **Allemand** dans
  l'option **Langue** pour avoir les titres originaux et les noms des
  caractéristiques en allemand. Le guide existe aussi en allemand
  ([docs/de.md](de.md)).

## Scènes

- **Alerte NINA émise** : choisissez l'appareil, la **gravité minimale** et,
  si vous voulez, la **source** (vide : toutes). La scène s'exécute une fois
  par alerte quand elle atteint la gravité choisie : une nouvelle alerte, ou
  une alerte en cours qui s'aggrave. Une nouvelle version d'une alerte de même
  gravité ne la relance pas. Choisissez « Mineure (toute alerte) » pour être
  prévenu de toutes les alertes.
- **Alerte NINA terminée** : mêmes champs, plus la **raison** (vide : toutes)
  : l'autorité a envoyé une fin d'alerte, l'alerte a expiré, ou elle a été
  retirée. La scène s'exécute une fois par alerte qui avait atteint la gravité
  choisie.
- Variables, à insérer dans un message depuis la liste des variables ou à
  écrire `{{triggerEvent.data.<clé>}}` (par exemple
  `{{triggerEvent.data.title}}`) : `title`, `headline`, `description`,
  `instruction`, `severity` (1 à 4), `severity_name`, `source`, `provider`
  (MoWaS, DWD...), `area`, `place`, `sent`, `expires`, `link` (le message
  officiel).

L'action **Alertes NINA** donne `count`, `highest_severity`, `titles` (un par
ligne) et `summary` (« 1 avertissement en cours pour Alsdorf : Nuisance
olfactive (mineur, MoWaS). ») pour un message ou une condition. Les actions
suivantes de la scène les trouvent dans leur liste de variables (écrites
`{{<étape>.<action>.<clé>}}`, par exemple `{{0.0.summary}}` quand cette action
est la première de la scène).

## Fonctionnement

NINA publie les alertes par district. Toutes les 5 minutes (option
**Intervalle de rafraîchissement**, 2 minutes au minimum) l'intégration lit le
district de chaque appareil (une requête, à laquelle le serveur répond « non
modifié » quand rien n'a changé), garde les alertes qui concernent la
commune, exactement comme l'application officielle, et lit le texte complet
d'une alerte une fois par version. La liste des communes de l'application
officielle est lue une fois par jour.

## Dépannage

- **« La maison ... n'est pas dans une commune allemande »** : NINA ne couvre
  que l'Allemagne. Vérifiez l'emplacement de la maison, ou saisissez sa
  commune.
- **« Plusieurs communes s'appellent ... »** : collez la ligne donnée par
  **Chercher une commune**, ou saisissez son ARS ou `Nom (District)`.
- **« NINA (warnung.bund.de) est injoignable »** : l'intégration garde la
  dernière lecture et réessaie à chaque rafraîchissement.
- Une alerte que l'application NINA affiche pour votre **position actuelle**
  (sa fonction de localisation) peut concerner une commune voisine :
  l'intégration suit la commune de la maison.
- Logs : le niveau de log de l'intégration se règle avec la variable
  `LOG_LEVEL`.

## Confidentialité

L'emplacement de la maison ne quitte jamais l'intégration : il est converti en
commune localement, avec les fichiers de l'application officielle.
warnung.bund.de ne reçoit que les demandes d'alertes du district, les
fichiers des communes et le contour des communes autour de la maison.
