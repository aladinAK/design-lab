# design-lab

Un labo pour tester des idées visuelles avant qu'elles deviennent propres. Chaque expérimentation est une page indépendante, sans framework : HTML, CSS et JavaScript, servis par Vite.

## Expérimentations

| Nom | Idée |
|---|---|
| [hand-drawn](experiments/hand-drawn/) | Une page dessinée à la main : un croquis qui se trace au chargement, des box au trait de stylo, et un crayon pour dessiner partout sur la page. |
| [old-tv](experiments/old-tv/) | Une vieille télé cathodique. Elle s'allume à l'arrivée, on zappe avec ses vrais boutons, et chaque changement de chaîne passe par un effet VHS. |

Les chaînes de `old-tv` sont des vidéos YouTube intégrées. Elles appartiennent à leurs auteurs respectifs.

## Lancer le projet

Prérequis : Node 20.11+ et pnpm.

```bash
pnpm install
pnpm dev      # serveur local, ouvre la page d'accueil du labo
pnpm build    # build de production dans dist/
pnpm preview  # sert le build
```

## Ajouter une expérimentation

```bash
pnpm new nom-de-l-experimentation
```

Le script copie `experiments/_template/` dans `experiments/nom-de-l-experimentation/`. Il reste ensuite à ajouter la page dans la liste de `index.html`.

Chaque dossier de `experiments/` qui contient un `index.html` devient automatiquement une page du build. Les dossiers qui commencent par `_` sont ignorés.

## Structure

```
index.html          page d'accueil du labo
home.css, home.js   style et interactions de l'accueil
shared/base.css     reset commun à toutes les pages
experiments/        une expérimentation par dossier
scripts/new.js      création d'une expérimentation depuis le template
```
