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
| 1 | Projet, base de données, connexion, contrôle d'âge | ✅ testé sur iPhone |
| 2 | Profil, publications, stories, follow, compte privé | ✅ testé |
| 3 | Selfie du jour, matching, déblocage, rappels quotidiens | ✅ testé — notifications de match : avec le compte Apple Developer |
| 4 | QR code (mon code + scanner) | ✅ testé |
| 5 | Messagerie temps réel + boîte Demandes + blocage | ✅ testé — notifications de message : avec le compte Apple Developer |
| 6 | Modération auto (Sightengine), signalements, back-office admin, sourdine, export / suppression du compte, brouillons légaux | ✅ à tester (voir « Mettre à jour vers la phase 6 ») |
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
**Tout se fait dans le navigateur, sans terminal.** Il y a plusieurs fichiers à copier-coller, **un par un, dans l'ordre** (liste en 3.4).

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

#### 3.4 Copier et exécuter les fichiers suivants

Pour **chacun** des fichiers ci-dessous, **dans cet ordre** : nouvelle requête vide (**+**) → ouvrir le lien → **« Copy raw file »** → coller dans Supabase → **Run** → attendre **« Success. No rows returned »**.

| # | Fichier | Phase |
|---|---|---|
| 1 | [20261122000000_phase1_identity.sql](https://github.com/StanNamblard/PBS/blob/claude/social-app-architecture-lb7tbk/supabase/migrations/20261122000000_phase1_identity.sql) | 1 (déjà fait en 3.2–3.3) |
| 2 | [20261122000100_phase1_storage.sql](https://github.com/StanNamblard/PBS/blob/claude/social-app-architecture-lb7tbk/supabase/migrations/20261122000100_phase1_storage.sql) | 1 |
| 3 | [20261123000000_phase2_social.sql](https://github.com/StanNamblard/PBS/blob/claude/social-app-architecture-lb7tbk/supabase/migrations/20261123000000_phase2_social.sql) | 2 |
| 4 | [20261123000100_phase2_storage.sql](https://github.com/StanNamblard/PBS/blob/claude/social-app-architecture-lb7tbk/supabase/migrations/20261123000100_phase2_storage.sql) | 2 |
| 5 | [20261124000000_phase3_selfies.sql](https://github.com/StanNamblard/PBS/blob/claude/social-app-architecture-lb7tbk/supabase/migrations/20261124000000_phase3_selfies.sql) | 3 |
| 6 | [20261124000100_phase3_storage.sql](https://github.com/StanNamblard/PBS/blob/claude/social-app-architecture-lb7tbk/supabase/migrations/20261124000100_phase3_storage.sql) | 3 |
| 7 | [20261125000000_phase4_qr.sql](https://github.com/StanNamblard/PBS/blob/claude/social-app-architecture-lb7tbk/supabase/migrations/20261125000000_phase4_qr.sql) | 4 |
| 8 | [20261126000000_phase5_blocks.sql](https://github.com/StanNamblard/PBS/blob/claude/social-app-architecture-lb7tbk/supabase/migrations/20261126000000_phase5_blocks.sql) | 5 |
| 9 | [20261126000100_phase5_messaging.sql](https://github.com/StanNamblard/PBS/blob/claude/social-app-architecture-lb7tbk/supabase/migrations/20261126000100_phase5_messaging.sql) | 5 |
| 10 | [20261127000000_phase6_moderation.sql](https://github.com/StanNamblard/PBS/blob/claude/social-app-architecture-lb7tbk/supabase/migrations/20261127000000_phase6_moderation.sql) | 6 |
| 11 | [20261127000100_phase6_privacy.sql](https://github.com/StanNamblard/PBS/blob/claude/social-app-architecture-lb7tbk/supabase/migrations/20261127000100_phase6_privacy.sql) | 6 |
| 12 | [20261127000200_phase6_server_grants.sql](https://github.com/StanNamblard/PBS/blob/claude/social-app-architecture-lb7tbk/supabase/migrations/20261127000200_phase6_server_grants.sql) | 6 |

#### 3.5 Vérifier que tout est en place

- Menu de gauche → **Table Editor** : tu dois voir les tables `age_gate_rejections`, `age_verifications`, `follows`, `post_media`, `posts`, `profiles`, `stories`, `story_views` et `user_private`.
- Menu de gauche → **Storage** : tu dois voir 4 dossiers (*buckets*) : `avatars` (*Public*), `posts`, `stories` et `selfies` (privés).

Si c'est le cas, passe à l'étape 4 🎉

#### En cas d'erreur

| Message affiché | Cause | Solution |
|---|---|---|
| `... already exists` (ex. `type "account_status" already exists`) | Le fichier a déjà été exécuté, en entier ou en partie (une tentative précédente). | Faire la **remise à zéro** ci-dessous, puis recommencer à 3.2. |
| `syntax error at or near ...` | Le copier-coller est incomplet (début ou fin manquant). | Vider la zone de texte, recopier avec le bouton **« Copy raw file »**, relancer. Si l'erreur dit aussi *already exists*, faire d'abord la remise à zéro. |
| `relation "storage.buckets" does not exist` | Le projet Supabase n'a pas fini de démarrer. | Attendre 2 minutes, recharger la page, relancer le 2e fichier. |
| `404` / page introuvable sur GitHub | Tu n'es pas connecté à GitHub avec le compte qui a accès au projet. | Se connecter sur github.com, puis rouvrir le lien. |

**Remise à zéro** (seulement en cas d'erreur `already exists`) : dans Supabase, nouvelle requête vide, colle ce fichier puis **Run** :
https://github.com/StanNamblard/PBS/blob/claude/social-app-architecture-lb7tbk/supabase/reset.sql
⚠️ Il efface **toutes les données de l'app** (profils, publications…), mais pas les comptes email. Recommence ensuite à l'étape 3.2 et réexécute **tous** les fichiers dans l'ordre.

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

But de l'étape : que l'email de connexion contienne un **code à chiffres** (à taper dans l'app) au lieu d'un lien. Sans ça, impossible de se connecter dans l'app.

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

Le texte important dans ce modèle est `{{ .Token }}` : c'est là que Supabase met le code (6 ou 8 chiffres selon le projet : l'app accepte les deux).

#### 4.4 Durée de validité du code

**Authentication → Sign In / Providers** → **Email** : vérifie que le fournisseur *Email* est activé. Si le champ **Email OTP Expiration** est modifiable, mets `600` (10 minutes) puis **Save**. S'il ne l'est pas, ce n'est pas grave : laisse la valeur par défaut.

✅ Étape 4 terminée : au premier essai de connexion dans l'app, tu recevras un email « Ton code BPS » contenant un code de 6 ou 8 chiffres (regarde aussi dans les spams).

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

## Mettre à jour vers la phase 2 (si la phase 1 est déjà installée)

À faire **une fois** par nouvelle phase. Compte 10 minutes.

### A. Mettre à jour la base de données (navigateur)

Comme à l'étape 3 : Supabase → **SQL Editor** → pour **chaque** fichier ci-dessous, dans l'ordre : nouvelle requête vide (**+**) → **« Copy raw file »** sur GitHub → coller → **Run** → **« Success. No rows returned »**.

1. [20261123000000_phase2_social.sql](https://github.com/StanNamblard/PBS/blob/claude/social-app-architecture-lb7tbk/supabase/migrations/20261123000000_phase2_social.sql)
2. [20261123000100_phase2_storage.sql](https://github.com/StanNamblard/PBS/blob/claude/social-app-architecture-lb7tbk/supabase/migrations/20261123000100_phase2_storage.sql)

✅ Vérification : **Storage** affiche maintenant `avatars`, `posts` et `stories`.
⚠️ **N'exécute pas** à nouveau les fichiers de la phase 1 (erreur *already exists*). Si c'est arrivé : ce n'est pas grave, il suffit d'exécuter les 2 fichiers ci-dessus.

### B. Mettre à jour l'app (terminal)

Si l'app tourne, arrête-la avec **Ctrl + C**, puis :

```bash
cd ~/Desktop/PBS
git checkout -- .
git pull
cd apps/mobile
npm ci
npx expo start -c
```

- `git checkout -- .` annule les petites modifications automatiques faites par l'installation précédente (sinon `git pull` refuse avec *« Your local changes … would be overwritten »*). Ton fichier `.env` n'est **pas** touché.
- `npm ci` installe exactement les versions prévues, sans rien modifier (évite ce problème la fois suivante).
- `-c` vide le cache pour être sûr de voir la nouvelle version. Sur l'iPhone, si l'ancienne version s'affiche encore : secoue le téléphone → **Reload**.

(Méthode ZIP : retélécharge le ZIP, remplace le dossier, **recopie ton fichier `.env`** dans `apps/mobile`, puis `npm install` et `npx expo start`.)

### C. Tester la phase 2

Pour tester les abonnements, il faut **2 comptes sur 2 téléphones** (toi et ton pote), chacun avec Expo Go, l'ordinateur faisant tourner l'app pour les deux (même Wi-Fi, ou `npx expo start --tunnel`).

1. **Publier** : Accueil → icône **＋** en haut à droite → *Publication* → choisis 1 à 10 photos → légende → **Publier**. Elle apparaît dans ton fil et sur ton profil.
2. **Story** : Accueil → rond **Ta story** (avec le ＋) → photo → **Partager la story**. Touche à nouveau ton rond pour la voir : en bas, le nombre de vues 👁 et la corbeille.
3. **Se trouver entre amis** (en attendant le selfie du jour et le QR code) : Profil → ⚙️ → tout en bas **Outils de test** → **Copier** ton identifiant → envoie-le à ton pote (SMS, WhatsApp…) → il le colle dans **Ouvrir un profil par identifiant** → **Ouvrir**. *(Ces outils n'existeront pas dans l'app publiée.)*
4. **Suivre** : sur le profil ouvert → **Suivre**. Les compteurs se mettent à jour ; les publications et la story de l'autre apparaissent dans ton fil (tire vers le bas pour rafraîchir).
5. **Story vue** : quand ton pote regarde ta story, son pseudo apparaît dans la liste 👁 de ta story.
6. **Compte privé** : Profil → ⚙️ → active **Compte privé**. Ton pote se désabonne puis appuie de nouveau sur **Suivre** → le bouton affiche **Demandé** et il ne voit plus tes photos. Chez toi, sur ton Profil : **Demandes d'abonnement (1)** → **Accepter**.
7. **Listes** : touche *Abonnés* / *Abonnements* sur un profil. Sur tes propres abonnés, **Retirer** enlève quelqu'un.
8. **Supprimer** : sur ta publication → **⋯** → *Supprimer*.
9. **Modifier le profil** : Profil → **Modifier le profil** (photo, pseudo, bio, pays).

---

## Mettre à jour vers la phase 3 : le selfie du jour

À faire **une fois**. Compte 15 minutes. (Phase 2 déjà installée.)

### A. Base de données (navigateur)

Supabase → **SQL Editor** → pour **chaque** fichier, dans l'ordre : nouvelle requête vide (**+**) → **« Copy raw file »** sur GitHub → coller → **Run** → **« Success. No rows returned »**.

1. [20261124000000_phase3_selfies.sql](https://github.com/StanNamblard/PBS/blob/claude/social-app-architecture-lb7tbk/supabase/migrations/20261124000000_phase3_selfies.sql)
2. [20261124000100_phase3_storage.sql](https://github.com/StanNamblard/PBS/blob/claude/social-app-architecture-lb7tbk/supabase/migrations/20261124000100_phase3_storage.sql)

✅ Vérification : **Storage** affiche maintenant aussi un dossier `selfies`.

### B. App (terminal)

**Ctrl + C** pour arrêter l'app, puis :

```bash
cd ~/Desktop/PBS
git checkout -- .
git pull
cd apps/mobile
npm ci
npx expo start --tunnel -c
```

`npm ci` est **obligatoire** cette fois : la phase 3 ajoute la caméra et les notifications.

### C. Effacement automatique des photos (navigateur, recommandé)

Les selfies ne sont **plus visibles** après 24 h (bloqué par le serveur). Cette étape les **efface réellement** du stockage, ainsi que les stories expirées (obligation RGPD : ne pas garder de données inutiles).

1. **Créer la fonction** : Supabase → **Edge Functions** (menu de gauche) → **Deploy a new function** → **Via Editor**.
   - Nom de la fonction : `purge-media`
   - Efface le code d'exemple, colle celui-ci (bouton « Copy raw file ») : https://github.com/StanNamblard/PBS/blob/claude/social-app-architecture-lb7tbk/supabase/functions/purge-media/index.ts
   - **Deploy function**.
2. **Autoriser l'appel planifié** : dans la fonction `purge-media` → onglet **Details** (ou *Settings*) → désactive **Enforce JWT verification** (« Verify JWT ») → **Save**.
   *(Sans risque : la fonction ne fait qu'effacer des photos déjà expirées, quel que soit l'appelant.)*
3. **La lancer toutes les heures** : Supabase → **Integrations** → **Cron** → active-le si demandé → **Create job** :
   - Name : `purge-media`
   - Schedule : `0 * * * *` (toutes les heures)
   - Type : **Supabase Edge Function** → Method **POST** → fonction **purge-media**
   - **Create cron job**.
4. **Tester** : dans la fonction `purge-media` → **Test** (ou *Invoke*) → la réponse doit être `{"ok":true,"purged":{...}}`.

> L'interface Supabase change souvent : si un bouton n'a pas exactement ce nom, envoie-moi une capture.

### D. Tester le selfie du jour (à deux téléphones)

1. **Rappels** : à la première ouverture de l'onglet selfie (gros bouton central), l'iPhone demande l'autorisation des **notifications** → **Autoriser**. Sous le bouton s'affiche « Prochaine vague : … » : un rappel arrivera à cette heure-là chaque jour (réglable dans Profil → ⚙️ → Notifications).
2. **Toi** : gros bouton → **Prendre mon selfie** → autorise la caméra → déclencheur → **Envoyer**.
   ✅ Écran « On cherche quelqu'un… » avec le globe et le temps restant (30 min).
3. **Ton pote**, dans les 30 minutes : même chose.
   ✅ Sur **les deux** téléphones : compte à rebours **3… 2… 1…**, flash, puis le selfie de l'autre en grand et le tien en petit.
4. Chacun choisit **Suivre** ou **Passer** (indépendamment). Teste aussi **Voir le profil** et **Signaler** (le signalement est enregistré, il sera traité dans le back-office en phase 6).
5. Onglet selfie : la section **Tes échanges (24 h)** liste vos échanges ; ils disparaîtront au bout de 24 h.
6. **Encore un !** permet de renvoyer un selfie… mais :

> ⚠️ **Règle anti-répétition** : deux personnes ne peuvent pas être de nouveau appariées avant **30 jours**. À deux testeurs, le 2e essai restera donc en attente puis expirera (c'est normal !). Pour refaire un test entre vous, exécute dans Supabase → SQL Editor : `delete from public.match_pairs;` (efface seulement l'historique des paires). L'idéal : inviter un 3e testeur.

**Ce qui n'est pas encore là :** la notification « Tu as un match ! » quand l'app est fermée (il faut le compte Apple Developer et un « build de développement » ; en attendant, laisse l'app ouverte ou reviens sur l'onglet selfie).

---

## Mettre à jour vers la phase 4 : le QR code

### A. Base de données (navigateur) — 1 seul fichier

Supabase → **SQL Editor** → **+** (page vide) → ouvre [20261125000000_phase4_qr.sql](https://github.com/StanNamblard/PBS/blob/claude/social-app-architecture-lb7tbk/supabase/migrations/20261125000000_phase4_qr.sql) → **« Copy raw file »** → colle → **Run** → **« Success. No rows returned »**.

✅ Vérification : **Table Editor** affiche les nouvelles tables `qr_tokens` et `qr_scan_attempts`.

### B. App (PowerShell)

```bash
cd ~/Desktop/PBS
git checkout -- .
git pull
cd apps/mobile
npm ci
npx expo start --tunnel -c
```

`npm ci` est **obligatoire** (nouveaux composants : génération de QR code, luminosité).

### C. Tester (à deux téléphones, côte à côte)

1. **Ton pote** : onglet **QR** → **Mon code**. Son QR code s'affiche sur fond blanc avec son @pseudo, et l'écran devient plus lumineux.
2. **Toi** : onglet **QR** → **Scanner** → autorise la caméra → vise son code.
   ✅ Vibration, puis la fiche **« Code scanné »** : photo, @pseudo, pays, nombre d'abonnés, bio.
3. Touche **Suivre** → ✅ « Tu suis maintenant @… ». Lui ne te suit pas automatiquement : il voit ton nom dans ses **Abonnés** et décide de suivre en retour (ou non).
4. **Compte privé** : s'il active *Compte privé* (Profil → ⚙️) et que tu scannes un code d'une 3e personne privée → « Demande envoyée ».
5. **Régénérer** : ton pote touche **Générer un nouveau code** → confirme. Si tu scannes une **photo de l'ancien code** → « Ce QR code n'est plus valide ».
6. Scanne un QR code quelconque (une étiquette, un site web) → « Ce n'est pas un QR code BPS ».
7. Scanne ton **propre** code (photo de ton écran depuis un autre téléphone) → « C'est ton propre code 😄 ».

> L'appareil photo normal de l'iPhone ne sait pas encore ouvrir BPS depuis un QR code (il faudra l'app installée et un nom de domaine, en phase 7) : scanne **depuis l'onglet QR de l'app**.

---

## Mettre à jour vers la phase 5 : la messagerie

### A. Base de données (navigateur) — 2 fichiers, dans l'ordre

Supabase → **SQL Editor** → pour chaque fichier : **+** (page vide) → **« Copy raw file »** sur GitHub → coller → **Run** → **« Success. No rows returned »**.

1. [20261126000000_phase5_blocks.sql](https://github.com/StanNamblard/PBS/blob/claude/social-app-architecture-lb7tbk/supabase/migrations/20261126000000_phase5_blocks.sql) (blocage)
2. [20261126000100_phase5_messaging.sql](https://github.com/StanNamblard/PBS/blob/claude/social-app-architecture-lb7tbk/supabase/migrations/20261126000100_phase5_messaging.sql) (messagerie)

✅ Vérification : **Table Editor** affiche `blocks`, `conversations`, `conversation_members`, `messages` ; **Storage** affiche un dossier `dm`.

### B. App (PowerShell)

```bash
cd ~/Desktop/PBS
git checkout -- .
git pull
cd apps/mobile
npm ci
npx expo start --tunnel -c
```

### C. Tester (à deux)

Voir le guide détaillé donné dans la conversation ; résumé :
1. **Principale** : vous vous suivez mutuellement → profil de l'autre → **Message** → écrivez-vous : les messages arrivent en direct, « Vu » s'affiche sous ton dernier message, badge rouge sur l'onglet Messages.
2. **Demandes** : l'un se désabonne de l'autre → celui qui suit encore écrit → chez l'autre, la conversation arrive dans **Demandes (1)**, sans badge, sans « Vu » ; un 2e message est refusé tant que la demande n'est pas acceptée.
3. **Bascule automatique** : la personne qui a reçu la demande suit l'autre → la conversation passe toute seule dans **Principale**.
4. **Accepter / Supprimer / Bloquer** depuis une demande ; **Profil → ⋯ → Bloquer / Signaler** ; **Paramètres → Comptes bloqués → Débloquer**.
5. **Photos** : icône 🖼 à gauche du champ (une fois la conversation acceptée).
6. **Selfies** : si vous avez eu un échange de selfies il y a moins de 24 h, il apparaît en haut de votre conversation.

---

## Mettre à jour vers la phase 6 : modération, back-office, RGPD

### A. Base de données (navigateur) — 2 fichiers, dans l'ordre
1. [20261127000000_phase6_moderation.sql](https://github.com/StanNamblard/PBS/blob/claude/social-app-architecture-lb7tbk/supabase/migrations/20261127000000_phase6_moderation.sql)
2. [20261127000100_phase6_privacy.sql](https://github.com/StanNamblard/PBS/blob/claude/social-app-architecture-lb7tbk/supabase/migrations/20261127000100_phase6_privacy.sql)
3. [20261127000200_phase6_server_grants.sql](https://github.com/StanNamblard/PBS/blob/claude/social-app-architecture-lb7tbk/supabase/migrations/20261127000200_phase6_server_grants.sql) (droits des fonctions serveur)

### B. Te nommer administrateur (navigateur)
SQL Editor → page vide → colle (en remplaçant `ton_pseudo`) → **Run** :
```sql
insert into public.admins (user_id) select id from public.profiles where username = 'ton_pseudo' on conflict do nothing;
```

### C. Fonctions serveur (navigateur)
1. **Mettre à jour `purge-media`** (efface aussi les comptes supprimés depuis 30 jours) : Edge Functions → `purge-media` → **Code** → remplace tout par [purge-media/index.ts](https://github.com/StanNamblard/PBS/blob/claude/social-app-architecture-lb7tbk/supabase/functions/purge-media/index.ts) → **Deploy**.
2. **Créer `moderate-image`** : Edge Functions → **Deploy a new function** → **Via Editor** → nom `moderate-image` → colle [moderate-image/index.ts](https://github.com/StanNamblard/PBS/blob/claude/social-app-architecture-lb7tbk/supabase/functions/moderate-image/index.ts) → **Deploy**, puis onglet **Details** → désactive **Verify JWT** → **Save** (la fonction vérifie elle-même l'utilisateur ; avec les nouvelles clés Supabase, la vérification automatique bloque les appels de l'app).

### D. Sightengine (navigateur)
1. Crée un compte sur https://sightengine.com (plan gratuit).
2. Tableau de bord Sightengine → **API keys** : note **API user** et **API secret**.
3. Supabase → **Edge Functions** → **Secrets** → ajoute `SIGHTENGINE_API_USER` et `SIGHTENGINE_API_SECRET`.
4. **Activer la modération obligatoire** (après C et D) — SQL Editor :
```sql
update public.app_config set value = 'true' where key = 'moderation_enforced';
```
> Avant cette ligne, rien n'est bloqué faute d'analyse : l'app reste utilisable pendant la configuration.

### E. App (PowerShell)
```bash
cd ~/Desktop/PBS
git checkout -- .
git pull
cd apps/mobile
npm ci
npx expo start --tunnel -c
```

---

## Pour les développeurs

```bash
# App
cd apps/mobile
npm run typecheck      # TypeScript
npm test               # tests unitaires (Jest)

# Base de données : migrations + tests pgTAP sur un Postgres local (sans Docker)
bash supabase/tests/local/run.sh
# test de charge du matching (40 envois simultanés)
bash supabase/tests/local/concurrency.sh 40
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
