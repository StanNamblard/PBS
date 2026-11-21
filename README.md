# BPS

Réseau social 18+ : chaque jour, échange de selfies simultané avec un inconnu.
Nom provisoire. Architecture détaillée : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

```
apps/mobile/   App iOS + Android (Expo, React Native, TypeScript)
supabase/      Base de données (migrations SQL), tests de sécurité, config
docs/          Architecture et guides
```

## Avancement

| Phase | Contenu | État |
|---|---|---|
| 0 | Architecture | ✅ |
| 1 | Projet, base de données, connexion, contrôle d'âge | ✅ à tester sur ton iPhone |
| 2 | Profil, publications, stories, follow | ⏳ |
| 3 | Selfie du jour, matching, déblocage, notifications | ⏳ |
| 4 | QR code | ⏳ |
| 5 | Messagerie + boîte Demandes | ⏳ |
| 6 | Modération, signalement, RGPD, back-office | ⏳ |
| 7 | Finitions, 10 langues, publication | ⏳ |

---

## Tester sur ton iPhone (guide pas à pas)

Compte environ 30 minutes la première fois.

### 1. Installer les outils sur ton ordinateur (une seule fois)

1. **Node.js** (version « LTS ») : https://nodejs.org → télécharger et installer.
2. **Git** : https://git-scm.com/downloads (déjà présent sur Mac : ouvre le Terminal et tape `git --version`).
3. Sur ton **iPhone** : installe l'app **Expo Go** depuis l'App Store.

Pour taper les commandes : **Terminal** sur Mac, **PowerShell** sur Windows.

### 2. Créer le projet Supabase (la base de données)

1. Va sur https://supabase.com → *Start your project* → connecte-toi avec GitHub.
2. *New project* :
   - Name : `bps`
   - Database password : clique sur *Generate* et **garde-le précieusement** (gestionnaire de mots de passe).
   - Region : **Central EU (Frankfurt)** (obligatoire pour le RGPD).
   - Plan : Free pour l'instant.
3. Attends 1 à 2 minutes que le projet soit prêt.

> ⚠️ Un projet gratuit se met en pause après 7 jours sans activité. Il suffit de cliquer « Restore » dans le tableau de bord.

### 3. Installer la base de données

Dans un terminal :

```bash
git clone https://github.com/StanNamblard/PBS.git
cd PBS
git checkout claude/social-app-architecture-lb7tbk

npx supabase login                          # ouvre le navigateur pour t'authentifier
npx supabase link --project-ref TON_REF     # TON_REF = les lettres dans l'URL du projet :
                                            # https://supabase.com/dashboard/project/TON_REF
npx supabase db push                        # crée les tables et les règles de sécurité
```

(Le mot de passe de la base est demandé : c'est celui de l'étape 2.)

*Alternative sans terminal :* dans Supabase → **SQL Editor**, copie-colle puis exécute (*Run*) le contenu de chaque fichier de `supabase/migrations/`, **dans l'ordre**.

### 4. Configurer la connexion par email

Dans le tableau de bord Supabase :

1. **Authentication → Sign In / Providers → Email** : vérifie que *Email* est activé. Mets *Email OTP Expiration* à `600` secondes.
2. **Authentication → Emails → Templates** : pour **Magic Link** *et* **Confirm signup**, remplace le contenu par celui du fichier `supabase/templates/otp.html`. Ainsi l'email contient un **code à 6 chiffres** au lieu d'un lien.

> ⚠️ Le service d'email intégré de Supabase n'envoie que **quelques emails par heure**. C'est suffisant pour tester seul. Avant d'inviter des testeurs, il faudra brancher un service d'envoi (ex. Resend, gratuit jusqu'à 3 000 emails/mois). Je te guiderai.

### 5. Relier l'app à Supabase

1. Supabase → **Project Settings → API Keys** : copie l'**URL du projet** et la clé **publishable** (commence par `sb_publishable_`, ou la clé « anon » sur les anciens projets).
2. Dans le dossier `apps/mobile`, copie le fichier `.env.example` en `.env` et colle ces deux valeurs.
   *Ne mets JAMAIS la clé « secret » / « service_role » dans ce fichier.*

### 6. Lancer l'app

```bash
cd apps/mobile
npm install          # la première fois seulement (quelques minutes)
npx expo start
```

Un QR code s'affiche dans le terminal. Ouvre l'app **Appareil photo** de l'iPhone, vise le QR code, puis touche la bannière : l'app s'ouvre dans Expo Go.
(L'ordinateur et l'iPhone doivent être sur le même Wi-Fi. Sinon : `npx expo start --tunnel`.)

### 7. Ce que tu peux tester

1. Écran d'accueil → *Commencer* → saisis ton email → entre le code reçu.
2. **Date de naissance** :
   - Essaie d'abord avec un **autre email** et une date de **moins de 18 ans** → l'app se bloque. Elle reste bloquée sur ce téléphone, même avec un autre compte (c'est voulu). Pour tes tests uniquement, un bouton « [DEV] Réinitialiser » permet de débloquer le téléphone ; il n'existera pas dans l'app publiée. Le compte mineur, lui, reste bloqué côté serveur.
   - Avec une date de plus de 18 ans → étape suivante. La date ne peut plus être modifiée.
3. Coche les 3 consentements → crée ton profil (photo, pseudo avec vérification de disponibilité en direct, bio, pays).
4. Tu arrives sur les onglets : Accueil, Messages, **le gros bouton selfie au centre**, QR, Profil. Les fonctionnalités des phases suivantes y sont signalées.
5. Profil → ⚙️ Paramètres : thème clair/sombre/système, langue, déconnexion.

> « Continuer avec Apple » n'apparaît pas dans Expo Go : il faut un build de développement, donc le compte Apple Developer (voir plus bas). Google viendra avec le même build.

---

## Pour les développeurs

```bash
# App
cd apps/mobile
npm run typecheck      # TypeScript
npm test               # tests unitaires (Jest)

# Base de données : migrations + tests pgTAP sur un Postgres local (sans Docker)
bash supabase/tests/local/run.sh
# ou, avec Docker et la CLI Supabase :
npx supabase start && npx supabase test db
```

Conventions :
- Toute règle de sécurité vit **côté serveur** (RLS + fonctions SQL `security definer`) et a un test dans `supabase/tests/database/`.
- Les textes de l'interface sont dans `apps/mobile/src/locales/*.json` (jamais en dur dans les écrans).
- Les couleurs et polices viennent de `apps/mobile/src/theme/tokens.ts`.

## Comptes nécessaires

| Compte | Quand | Coût |
|---|---|---|
| Supabase | maintenant | gratuit → 25 $/mois au lancement |
| Expo (expo.dev) | phase 3 (builds) | gratuit |
| Apple Developer Program, compte **individuel** | avant la phase 3 (notifications push) | 99 $/an |
| Google Play Console | phase 7 | 25 $ une fois |
