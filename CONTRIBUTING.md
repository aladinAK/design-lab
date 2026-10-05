# Contribuer au design-lab

Le labo est ouvert : n'importe qui peut y poser une expérimentation visuelle. Une idée, une page, un dossier. Elle n'a pas besoin d'être finie.

## Ajouter ton expérimentation

1. Forke le dépôt, puis clone ton fork.
2. Installe les dépendances : `pnpm install` (Node 20.11+ et pnpm requis).
3. Crée ton dossier : `pnpm new mon-idee` (nom en kebab-case).
4. Remplis `experiments/mon-idee/meta.json` :

   ```json
   {
     "author": "ton-pseudo-github",
     "tech": "css · canvas",
     "note": "",
     "status": "en cours",
     "date": "2026-10-05"
   }
   ```

   - `author` : ton pseudo GitHub, affiché `@pseudo` sur l'accueil.
   - `tech` : les techniques utilisées, en quelques mots.
   - `note` : une petite annotation à côté du nom (facultatif).
   - `status` : `en cours`, `terminé`… ce que tu veux.
   - `date` : remplie par `pnpm new`, elle fixe l'ordre dans la liste.

5. Lance `pnpm dev` et expérimente. Ta page apparaît toute seule sur l'accueil : pas besoin de toucher à `index.html`.
6. Vérifie que `pnpm build` passe, puis ouvre une pull request.

## Règles du jeu

- **Reste dans ton dossier.** Une pull request ne modifie que `experiments/<ton-dossier>/`. Pour changer l'accueil, l'outillage ou l'expérimentation de quelqu'un d'autre, ouvre d'abord une issue.
- **Pas de framework imposé, pas de build à part.** HTML, CSS et JavaScript dans ton dossier, servis par Vite. Si tu as besoin d'une dépendance, explique pourquoi dans la pull request.
- **Tout ce que ta page utilise vit dans ton dossier** : images, polices, scripts. `shared/base.css` est le seul fichier commun.
- **Garde le lien de retour** `← lab` du template, pour qu'on puisse revenir à l'accueil.
- **Médias : uniquement ce que tu as le droit d'utiliser.** Tes propres images, des ressources libres de droits, ou des intégrations officielles (YouTube, etc.) plutôt que des fichiers téléchargés.
- **Pense au poids.** Compresse les images (WebP, AVIF) quand c'est possible.
- **Respecte `prefers-reduced-motion`** si ta page est très animée.

## Licence

En ouvrant une pull request, tu acceptes que ta contribution soit publiée sous la [licence MIT](LICENSE) du projet.
