# design-lab

Un labo ouvert pour tester des idées visuelles avant qu'elles deviennent propres. Chaque expérimentation est une page indépendante, sans framework : HTML, CSS et JavaScript, servis par Vite. Tout le monde peut proposer la sienne.

## Les premières expérimentations

La liste complète, à jour, est sur la page d'accueil du labo.

| Nom | Auteur | Idée |
|---|---|---|
| [hand-drawn](experiments/hand-drawn/) | [@aladinAK](https://github.com/aladinAK) | Une page dessinée à la main : un croquis qui se trace au chargement, des box au trait de stylo, et un crayon pour dessiner partout sur la page. |
| [old-tv](experiments/old-tv/) | [@aladinAK](https://github.com/aladinAK) | Une vieille télé cathodique. Elle s'allume à l'arrivée, on zappe avec ses vrais boutons, et chaque changement de chaîne passe par un effet VHS. |

Les chaînes de `old-tv` sont des vidéos YouTube intégrées. Elles appartiennent à leurs auteurs respectifs.

## Lancer le projet

Prérequis : Node 20.11+ et pnpm.

```bash
pnpm install
pnpm dev      # serveur local, ouvre la page d'accueil du labo
pnpm build    # build de production dans dist/
pnpm preview  # sert le build
```

## Contribuer

Le labo est ouvert : chacun peut y poser son expérimentation.

```bash
pnpm new nom-de-l-experimentation
```

Le script crée `experiments/nom-de-l-experimentation/` à partir du template. Remplis son `meta.json` (pseudo GitHub, technique, état) : la page apparaît automatiquement dans la liste de l'accueil, sans toucher à `index.html`. Ouvre ensuite une pull request.

Les étapes complètes et les règles sont dans [CONTRIBUTING.md](CONTRIBUTING.md).

## Structure

```
index.html          page d'accueil du labo
home.css, home.js   style et interactions de l'accueil
shared/base.css     reset commun à toutes les pages
experiments/        une expérimentation par dossier (index.html + meta.json)
scripts/new.js      création d'une expérimentation depuis le template
vite.config.js      une page par dossier, liste de l'accueil générée depuis les meta.json
```

## Licence

Code sous licence [MIT](LICENSE). En contribuant, tu acceptes que ton expérimentation soit publiée sous cette licence. Les médias intégrés (vidéos YouTube, etc.) restent la propriété de leurs auteurs.
