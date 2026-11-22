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

But de l'étape : créer dans ton projet Supabase les tables (profils, etc.) et les règles de sécurité.
**Tout se fait dans le navigateur, sans terminal.** Il y a 2 fichiers à copier-coller, **dans l'ordre**.

#### 3.1 Ouvrir l'éditeur SQL de Supabase

1. Va sur https://supabase.com/dashboard et clique sur ton projet **bps**.
2. Dans la barre d'icônes à **gauche**, clique sur **SQL Editor** (icône `>_`).
3. Si un onglet de requête est déjà ouvert avec du texte, clique sur **+** (ou *New query*) pour avoir une page **vide**.

#### 3.2 Copier le 1er fichier

1. Dans un **autre onglet** du navigateur, ouvre ce fichier sur GitHub (connecte-toi à GitHub si besoin) :
   https://github.com/StanNamblard/PBS/blob/claude/social-app-architecture-lb7tbk/supabase/migrations/20261122000000_phase1_identity.sql
2. Au-dessus du code, à droite, clique sur l'icône **« Copy raw file »** (deux petits carrés superposés).
   👉 Ne sélectionne pas le texte à la souris : avec ce bouton, tu es sûr de tout copier, de la première à la dernière ligne.

#### 3.3 Exécuter le 1er fichier

1. Reviens sur l'onglet Supabase, clique dans la zone de texte vide et colle (**Cmd + V** sur Mac, **Ctrl + V** sur Windows).
2. Clique sur le bouton vert **Run** en bas à droite (ou **Cmd/Ctrl + Entrée**).
3. Si Supabase affiche une fenêtre d'avertissement du type *« Potential issue detected… destructive operation »*, clique sur **Run this query**. C'est normal : le script contient des instructions de sécurité (« revoke ») que Supabase signale par précaution.
4. ✅ Résultat attendu : en bas, **« Success. No rows returned »**.

#### 3.4 Copier et exécuter le 2e fichier

1. Dans Supabase, ouvre une **nouvelle** requête vide (**+**).
2. Ouvre le 2e fichier sur GitHub et copie-le avec le même bouton :
   https://github.com/StanNamblard/PBS/blob/claude/social-app-architecture-lb7tbk/supabase/migrations/20261122000100_phase1_storage.sql
3. Colle-le dans Supabase, puis **Run**.
4. ✅ Résultat attendu : **« Success. No rows returned »**.

#### 3.5 Vérifier que tout est en place

- Menu de gauche → **Table Editor** : tu dois voir 4 tables : `age_gate_rejections`, `age_verifications`, `profiles` et `user_private` (vides, c'est normal).
- Menu de gauche → **Storage** : tu dois voir un dossier (*bucket*) `avatars` marqué *Public*.

Si c'est le cas, passe à l'étape 4 🎉

#### En cas d'erreur

| Message affiché | Cause | Solution |
|---|---|---|
| `... already exists` (ex. `type "account_status" already exists`) | Le fichier a déjà été exécuté, en entier ou en partie (une tentative précédente). | Faire la **remise à zéro** ci-dessous, puis recommencer à 3.2. |
| `syntax error at or near ...` | Le copier-coller est incomplet (début ou fin manquant). | Vider la zone de texte, recopier avec le bouton **« Copy raw file »**, relancer. Si l'erreur dit aussi *already exists*, faire d'abord la remise à zéro. |
| `relation "storage.buckets" does not exist` | Le projet Supabase n'a pas fini de démarrer. | Attendre 2 minutes, recharger la page, relancer le 2e fichier. |
| `404` / page introuvable sur GitHub | Tu n'es pas connecté à GitHub avec le compte qui a accès au projet. | Se connecter sur github.com, puis rouvrir le lien. |

**Remise à zéro** (seulement en cas d'erreur `already exists`) : dans Supabase, nouvelle requête vide, colle ce fichier puis **Run** :
https://github.com/StanNamblard/PBS/blob/claude/social-app-architecture-lb7tbk/supabase/reset_phase1.sql
Il efface uniquement ce que les deux fichiers ont créé. Recommence ensuite à l'étape 3.2.

> Toujours bloqué ? Envoie-moi une **capture d'écran du message d'erreur** (en bas de l'éditeur SQL) : je saurai exactement quoi faire.

<details>
<summary>Méthode alternative pour les développeurs (terminal + CLI Supabase)</summary>

Depuis le dossier du projet cloné (voir étape 5) :

```bash
npx supabase login                          # ouvre le navigateur pour t'authentifier
npx supabase link --project-ref TON_REF     # TON_REF = l'identifiant de 20 lettres dans l'URL :
                                            # https://supabase.com/dashboard/project/TON_REF
npx supabase db push                        # applique supabase/migrations
```

Le mot de passe de la base (étape 2) est demandé. **Rien ne s'affiche quand tu le tapes** (c'est normal, pour la sécurité) : tape-le en entier puis appuie sur Entrée.
Si tu as déjà fait la méthode du navigateur, n'utilise pas celle-ci (elle essaierait de tout recréer).
</details>

### 4. Configurer la connexion par email

But de l'étape : que l'email de connexion contienne un **code à 6 chiffres** (à taper dans l'app) au lieu d'un lien. Sans ça, impossible de se connecter dans l'app.

> 💶 **Tout est gratuit.** Supabase bloque la modification des modèles d'emails tant qu'on utilise son service d'envoi par défaut (les champs sont grisés, ou un message demande de configurer un « custom SMTP »). On branche donc d'abord **ta propre adresse Gmail** comme expéditeur : gratuit, jusqu'à ~500 emails par jour, largement assez pour les tests.

#### 4.1 Créer un « mot de passe d'application » Gmail

C'est un mot de passe spécial de 16 lettres qui permet à Supabase d'envoyer des emails depuis ton adresse Gmail. Ce n'est **pas** ton mot de passe habituel.

1. Il faut que la **validation en 2 étapes** soit activée sur ton compte Google : https://myaccount.google.com/signinoptions/twosv (si ce n'est pas le cas, active-la, avec ton numéro de téléphone).
2. Va sur https://myaccount.google.com/apppasswords
3. Dans *Nom de l'application*, tape `Supabase BPS`, puis **Créer**.
4. Google affiche un code de **16 lettres** (ex. `abcd efgh ijkl mnop`). **Copie-le** (sans les espaces) dans une note : il ne sera plus affiché ensuite.

> Tu n'as pas Gmail, ou la page *apppasswords* est indisponible ? Voir l'alternative **Brevo** en bas de l'étape 4.

#### 4.2 Brancher Gmail dans Supabase

1. Supabase → projet **bps** → **Authentication** (icône 👤 à gauche) → **Emails** → onglet **SMTP Settings**.
2. Active **Enable custom SMTP**, puis remplis :

   | Champ | Valeur |
   |---|---|
   | Sender email | ton adresse Gmail (ex. `ton.nom@gmail.com`) |
   | Sender name | `BPS` |
   | Host | `smtp.gmail.com` |
   | Port number | `587` |
   | Minimum interval between emails | `30` (ou laisse la valeur proposée) |
   | Username | ton adresse Gmail (la même) |
   | Password | le code de 16 lettres de l'étape 4.1 (sans espaces) |

3. Clique sur **Save changes**.

#### 4.3 Changer les modèles d'emails

1. Toujours dans **Authentication → Emails**, onglet **Templates**.
2. Clique sur **Magic Link**.
   - *Subject* : `Ton code BPS / Your BPS code`
   - *Body* (le grand champ, mode *Source* s'il y a le choix) : **efface tout**, puis colle le contenu de ce fichier (bouton **« Copy raw file »** sur GitHub) :
     https://github.com/StanNamblard/PBS/blob/claude/social-app-architecture-lb7tbk/supabase/templates/otp.html
   - **Save changes**.
3. Fais exactement la même chose pour **Confirm signup**.

Le texte important dans ce modèle est `{{ .Token }}` : c'est là que Supabase met le code à 6 chiffres.

#### 4.4 Durée de validité du code

**Authentication → Sign In / Providers** → **Email** : vérifie que le fournisseur *Email* est activé. Si le champ **Email OTP Expiration** est modifiable, mets `600` (10 minutes) puis **Save**. S'il ne l'est pas, ce n'est pas grave : laisse la valeur par défaut.

✅ Étape 4 terminée : au premier essai de connexion dans l'app, tu recevras un email « Ton code BPS » contenant 6 chiffres (regarde aussi dans les spams).

**Ça bloque ?**

| Problème | Solution |
|---|---|
| Les modèles restent grisés après 4.2 | Vérifie que **Enable custom SMTP** est bien activé et **enregistré**, puis recharge la page. |
| Pas de page *apppasswords* chez Google | La validation en 2 étapes n'est pas activée (4.1, point 1), ou c'est un compte Gmail professionnel/scolaire qui l'interdit → utilise Brevo. |
| L'email n'arrive pas | Regarde dans les spams. Vérifie le mot de passe de 16 lettres (sans espaces). Attends 1 minute entre deux demandes de code. |
| L'email contient un lien au lieu d'un code | Le modèle n'a pas été enregistré : refais 4.3 pour **Magic Link** et **Confirm signup**. |

<details>
<summary>Alternative à Gmail : Brevo (gratuit, 300 emails/jour)</summary>

1. Crée un compte sur https://www.brevo.com (plan gratuit).
2. Menu **Senders, domains & dedicated IPs** → **Senders** → ajoute ton adresse email et valide-la via l'email reçu.
3. Menu **SMTP & API** → onglet **SMTP** → **Generate a new SMTP key** → copie la clé.
4. Dans Supabase (4.2) : Host `smtp-relay.brevo.com`, Port `587`, Username = l'identifiant « Login » affiché sur la page SMTP de Brevo, Password = la clé SMTP, Sender email = l'adresse validée au point 2.
</details>

### 5. Récupérer le code et le relier à Supabase

But de l'étape : avoir le dossier du projet sur ton ordinateur, et y créer un petit fichier `.env` qui contient l'adresse de ta base Supabase.
Il y a 3 parties : **5.1** récupérer le code, **5.2** copier 2 valeurs dans Supabase, **5.3** les coller dans le fichier `.env`.

#### 5.1 Récupérer le code sur ton ordinateur

1. **Ouvre un terminal** :
   - **Mac** : appuie sur **Cmd + Espace**, tape `Terminal`, appuie sur Entrée.
   - **Windows** : clique sur Démarrer, tape `PowerShell`, appuie sur Entrée.
2. **Va sur ton Bureau** (le projet y sera facile à retrouver). Tape cette ligne puis Entrée :
   ```bash
   cd ~/Desktop
   ```
   (Sur un Windows en français, si erreur : `cd ~/Bureau`.)
3. **Télécharge le projet** : tape (ou copie-colle) cette ligne puis Entrée :
   ```bash
   git clone https://github.com/StanNamblard/PBS.git
   ```
   ✅ Résultat attendu : quelques lignes `Cloning into 'PBS'... done.` et un dossier **PBS** apparaît sur ton Bureau.
4. **Entre dans le dossier et choisis la bonne version** : tape ces 2 lignes, une par une, chacune suivie d'Entrée :
   ```bash
   cd PBS
   git checkout claude/social-app-architecture-lb7tbk
   ```
   ✅ Résultat attendu : `Switched to branch 'claude/social-app-architecture-lb7tbk'` (ou `Already on ...`).
5. **Vérifie** : tape `ls apps/mobile` puis Entrée. Tu dois voir notamment `app.json`, `package.json` et `src`.

**Ça bloque ?**

| Message | Solution |
|---|---|
| `git: command not found` / `git n'est pas reconnu` | Git n'est pas installé. **Mac** : une fenêtre propose d'installer les « outils de ligne de commande » → clique sur *Installer*, attends, puis recommence. **Windows** : installe Git depuis https://git-scm.com/downloads (options par défaut), **ferme et rouvre** PowerShell, recommence. |
| On te demande `Username` / `Password` | Le projet est privé et GitHub n'accepte plus les mots de passe ici. Utilise la **méthode sans Git** ci-dessous. |
| `destination path 'PBS' already exists` | Tu l'as déjà téléchargé. Tape `cd PBS` et continue au point 4. |
| `pathspec ... did not match` au `git checkout` | Tape `git fetch origin` puis refais la commande `git checkout ...`. |

**Méthode sans Git (téléchargement ZIP)** : connecte-toi sur github.com, ouvre
https://github.com/StanNamblard/PBS/tree/claude/social-app-architecture-lb7tbk
→ bouton vert **Code** → **Download ZIP**. Double-clique sur le fichier téléchargé pour le décompresser, renomme le dossier obtenu en **PBS** et place-le sur ton **Bureau**. Puis dans le terminal : `cd ~/Desktop/PBS`.
(Inconvénient : à chaque nouvelle phase, il faudra retélécharger le ZIP.)

#### 5.2 Copier l'URL et la clé dans Supabase

Garde le terminal ouvert, et va dans ton navigateur sur https://supabase.com/dashboard → projet **bps**.

1. **L'URL du projet** : clique sur le bouton **Connect** (en haut de la page du projet). Dans la fenêtre, cherche **Project URL** : une adresse de la forme `https://abcdefghijklmnopqrst.supabase.co`. Copie-la et colle-la temporairement dans une note.
   *(Autre endroit : roue dentée **Project Settings** en bas à gauche → **Data API** → *Project URL*.)*
2. **La clé publique** : roue dentée **Project Settings** → **API Keys**. Copie la clé **Publishable key** (elle commence par `sb_publishable_`). Colle-la aussi dans ta note.
   *(Si tu ne vois que des clés « legacy » : prends celle nommée **anon** / **public**, une longue suite commençant par `eyJ`.)*

> 🔒 **Ne copie JAMAIS** la clé **secret** (`sb_secret_...`) ni **service_role** : elles donnent tous les droits sur ta base. Seule la clé *publishable* / *anon* va dans l'app.

#### 5.3 Créer le fichier `.env`

Ce fichier contient tes 2 valeurs. Il commence par un point : il est donc **invisible** dans le Finder / l'Explorateur, c'est pourquoi on le crée depuis le terminal.

1. Dans le terminal (tu dois être dans le dossier `PBS`), tape ces lignes une par une :

   **Mac :**
   ```bash
   cd apps/mobile
   cp .env.example .env
   open -e .env
   ```
   **Windows :**
   ```bash
   cd apps/mobile
   copy .env.example .env
   notepad .env
   ```
2. Un éditeur de texte s'ouvre (TextEdit ou Bloc-notes) avec ce contenu :
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_KEY=sb_publishable_xxxxxxxxxxxxxxxx
   ```
3. Remplace **tout ce qui est après le `=`** par tes valeurs, ce qui donne par exemple :
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://abcdefghijklmnopqrst.supabase.co
   EXPO_PUBLIC_SUPABASE_KEY=sb_publishable_AbC123...
   ```
   ⚠️ Pas d'espace autour du `=`, pas de guillemets, pas de `/` à la fin de l'URL.
4. Enregistre (**Cmd + S** / **Ctrl + S**) et ferme l'éditeur.
5. **Vérifie** : dans le terminal, tape `cat .env` (Mac) ou `type .env` (Windows) puis Entrée : tes deux lignes doivent s'afficher.

✅ Étape 5 terminée. **Garde le terminal ouvert** : tu es déjà dans le bon dossier (`PBS/apps/mobile`) pour l'étape 6.

> Si l'app affiche plus tard l'écran **« Configuration manquante »**, c'est que le fichier `.env` est mal rempli ou mal placé : il doit être dans `PBS/apps/mobile/` et s'appeler exactement `.env` (pas `.env.txt`). Après l'avoir corrigé, arrête l'app avec **Ctrl + C** dans le terminal et relance `npx expo start`.

### 6. Lancer l'app

But de l'étape : démarrer l'app sur ton ordinateur et l'ouvrir sur ton iPhone grâce à **Expo Go**. Il y a 4 parties.

#### 6.1 Vérifier que Node.js est installé

Dans le terminal, tape puis Entrée :
```bash
node -v
```
✅ Attendu : un numéro de version, par exemple `v22.12.0` (il faut **20 ou plus**).
❌ Si tu vois `command not found` / `n'est pas reconnu` ou une version inférieure à 20 : installe la version **LTS** depuis https://nodejs.org (bouton vert, options par défaut), puis **ferme et rouvre** le terminal et retourne dans le dossier :
```bash
cd ~/Desktop/PBS/apps/mobile
```

> 🪟 **Windows uniquement (à faire une seule fois)** : PowerShell bloque par défaut les commandes `npm` et `npx` (message *« l'exécution de scripts est désactivée sur ce système »*). Pour l'autoriser pour ton compte uniquement, tape :
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
> ```
> Réponds `O` (ou `T` / `Y` selon la question), puis Entrée. **Ferme et rouvre PowerShell**, puis `cd ~/Desktop/PBS/apps/mobile`.
> Si ce n'est pas possible, utilise **Invite de commandes** (Démarrer → tape `cmd`) au lieu de PowerShell : les commandes sont les mêmes, avec `cd %USERPROFILE%\Desktop\PBS\apps\mobile` pour aller dans le dossier.

#### 6.2 Installer les composants de l'app (la première fois seulement)

Vérifie que tu es dans le bon dossier : tape `ls` (Mac) ou `dir` (Windows). Tu dois voir `app.json` et `package.json`. Sinon : `cd ~/Desktop/PBS/apps/mobile`.

Puis tape :
```bash
npm install
```
⏳ Ça dure **2 à 5 minutes**, beaucoup de lignes défilent.
✅ C'est fini quand le terminal te rend la main (tu peux de nouveau taper). Les messages `warn`, `deprecated` ou `vulnerabilities` sont **normaux** : ignore-les, **ne lance pas** `npm audit fix`.

#### 6.3 Démarrer l'app

```bash
npx expo start
```
- Si on te demande `Need to install the following packages ... Ok to proceed? (y)` → tape `y` puis Entrée.
- ✅ Après quelques secondes, un **grand QR code** s'affiche dans le terminal, avec en dessous `Metro waiting on exp://...`.
- **Laisse ce terminal ouvert** tant que tu utilises l'app : c'est lui qui la fait tourner. Pour l'arrêter : **Ctrl + C**.

#### 6.4 Ouvrir l'app sur ton iPhone

1. Installe **Expo Go** depuis l'App Store (gratuit) si ce n'est pas déjà fait.
2. Vérifie que l'iPhone est sur le **même Wi-Fi** que l'ordinateur (pas en 4G/5G).
3. Ouvre l'app **Appareil photo** de l'iPhone (l'appareil photo normal, pas Expo Go) et vise le QR code du terminal.
4. Une bannière jaune **« Ouvrir dans Expo Go »** apparaît : touche-la.
5. Si l'iPhone demande l'autorisation d'accéder au **réseau local** → **Autoriser**.
6. ⏳ La première ouverture prend jusqu'à **1 minute** (une barre de chargement s'affiche).
7. ✅ L'écran noir **« BPS — Un selfie. Un inconnu. Chaque jour. »** apparaît. Passe à l'étape 7 !

**Ça bloque ?**

| Problème | Solution |
|---|---|
| Windows : `l'exécution de scripts est désactivée sur ce système` | Tape `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, réponds `O` (ou `Y`), puis relance la commande. |
| `npm install` affiche `ERR!` et s'arrête | Supprime le dossier `node_modules` s'il existe, vérifie `node -v` (20 ou plus), relance `npm install`. Si ça persiste, envoie-moi une capture des dernières lignes. |
| L'iPhone ne trouve pas l'app / « Could not connect to the server » / chargement sans fin | Arrête avec **Ctrl + C**, puis lance `npx expo start --tunnel`. Si on te propose d'installer `@expo/ngrok` → `y`. Rescanne le nouveau QR code. (Utile aussi sur un Wi-Fi d'entreprise, d'école ou de box qui isole les appareils.) |
| La bannière n'apparaît pas en scannant | Ouvre **Expo Go** → onglet *Home* → **Scan QR code**, ou tape à la main dans Expo Go l'adresse `exp://...` affichée dans le terminal. |
| Expo Go dit que le projet utilise un **SDK incompatible** | Mets à jour Expo Go dans l'App Store, puis réessaie. Sinon envoie-moi une capture. |
| L'app affiche **« Configuration manquante »** | Le fichier `.env` (étape 5.3) est absent ou mal rempli. Corrige-le, **Ctrl + C**, puis `npx expo start` à nouveau. |
| Écran rouge avec une erreur | Envoie-moi une capture de l'écran : je corrige. |

**Les fois suivantes**, pas besoin de tout refaire : ouvre un terminal et tape
```bash
cd ~/Desktop/PBS/apps/mobile
npx expo start
```
puis scanne le QR code. (Quand je livre une nouvelle phase : `git pull` puis `npm install` avant `npx expo start`.)

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
