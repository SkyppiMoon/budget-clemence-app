# Le Budget de Clémence

Application web mobile de suivi de budget, extraite du fichier HTML monolithique d'origine.

## Structure

```text
budget-clemence/
├── index.html
├── css/style.css
├── js/
│   ├── config.js
│   ├── supabase.js
│   ├── database.js
│   ├── auth.js
│   └── app.js
├── sql/database.sql
├── .gitignore
└── README.md
```

## Fonctionnement

- `index.html` contient la structure de l'interface.
- `css/style.css` contient tous les styles.
- `js/app.js` contient la logique fonctionnelle existante.
- `js/database.js` sauvegarde les données dans Supabase lorsque l'utilisateur est connecté.
- Sans configuration Supabase ou sans session, les données sont conservées dans `localStorage`.
- `js/auth.js` fournit les fonctions de connexion par lien magique et de déconnexion.

## Installation locale

Les modules JavaScript ne doivent pas être ouverts directement avec `file://`.
Lancer un petit serveur HTTP depuis le dossier :

```bash
python -m http.server 8000
```

Puis ouvrir `http://localhost:8000`.

## Configuration Supabase

1. Créer un projet sur Supabase.
2. Ouvrir **SQL Editor** et exécuter `sql/database.sql`.
3. Dans **Project Settings > API**, récupérer :
   - l'URL du projet ;
   - la clé publique `anon`.
4. Les renseigner dans `js/config.js`.
5. Dans **Authentication > URL Configuration**, ajouter l'URL locale et l'URL de production dans les URLs autorisées.

La clé `anon` peut être présente dans le navigateur. Ne jamais placer la clé `service_role` dans ce projet.

## Publication GitHub Pages

1. Créer un dépôt GitHub.
2. Envoyer le contenu de ce dossier sur la branche `main`.
3. Aller dans **Settings > Pages**.
4. Choisir **Deploy from a branch**, branche `main`, dossier `/root`.
5. Ajouter l'URL GitHub Pages dans les URLs de redirection Supabase.

## Authentification

Les fonctions suivantes sont disponibles dans `js/auth.js` :

```js
signInWithEmail('adresse@email.fr');
signOut();
```

L'interface de connexion n'est pas encore affichée dans la page. L'application continue donc à fonctionner localement tant qu'aucun écran de connexion n'est ajouté.

## Budgets mensuels par catégorie

La version actuelle permet de définir, pour chaque mois :

- un budget différent pour une même catégorie ;
- l'inclusion ou l'exclusion ponctuelle d'une catégorie ;
- la conservation des dépenses réelles même si la catégorie est exclue du budget prévu.

Avant d'utiliser cette fonctionnalité, exécuter dans Supabase :

```text
sql/category-monthly-budgets.sql
```

Lors de la première ouverture d'un mois, l'application initialise automatiquement le budget mensuel de chaque catégorie à partir de son budget par défaut.
