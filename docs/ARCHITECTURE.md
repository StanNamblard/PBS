# Architecture BPS

> Statut : **validé** (phase 0). Nom provisoire de l'app : **BPS**.
> Les décisions ci-dessous **priment** sur les propositions détaillées plus bas.

## ✅ Décisions validées

| # | Sujet | Décision |
|---|---|---|
| 1 | Nom | **BPS** (provisoire) |
| 2 | Flux d'échange | **Modèle A** : envoi → file d'attente → match → révélation simultanée (3-2-1) |
| 3 | Notification quotidienne | **Vagues régionales** (heure aléatoire 11 h–21 h locale par région, créneaux qui se chevauchent) + option heure fixe |
| 4 | Conservation des selfies | Visibles **24 h après le match** (dans l'échange privé entre les deux personnes), puis **supprimés** du stockage |
| 5 | Re-match / expiration | Pas de nouveau match entre deux mêmes personnes avant **30 jours** ; selfie en attente **expiré après 30 min** |
| 6 | QR code | Scan = **follow simple**. La personne suivie décide si elle suit en retour |
| 7 | Comptes privés | Comptes **publics par défaut**, option « compte privé » disponible **dès le lancement** (follow = demande à accepter) |
| 8 | Messagerie | **Seul un abonné peut écrire**. Follow mutuel → boîte principale ; sinon → boîte Demandes. **Accusés de lecture désactivés** pour les messages en Demandes |
| 9 | Langues | Monde entier, **10 langues** : en, zh, hi, es, fr, ar, bn, pt, ru, ur (arabe et ourdou en droite-à-gauche). FR + EN complets dès la phase 1, les 8 autres en phase 7 (traductions à faire relire par des natifs) |
| 10 | Structure juridique | Pas de société : compte Apple Developer **individuel** (ton nom légal apparaîtra sur l'App Store) |
| 11 | Appareil de test | **iPhone** (Expo Go jusqu'à la phase 2, build de développement à partir de la phase 3) |
| 12 | Budget | ~**100 €/mois** au départ |

Choix faits en phase 3 :
- **Matching** dans Postgres (`_try_match`) : verrou de la ligne + `FOR UPDATE SKIP LOCKED` sur le candidat → jamais deux matchs pour un même selfie, même sous forte concurrence (test : 40 envois simultanés → 20 matchs, 0 doublon). Tri : pays différent d'abord, puis le plus ancien. Préférence « même langue » relâchée après 2 min. Pas de re-match avant 30 jours (`match_pairs`). 30 selfies max / heure.
- **Courses simultanées** : si deux selfies arrivent exactement au même instant, aucun ne voit l'autre ; l'interrogation `poll_selfie` (toutes les 3 s pendant l'attente) relance le matching et les apparie.
- **Verrou** : bucket `selfies` privé ; lecture du fichier d'un autre uniquement via un match débloqué de moins de 24 h. Avant la révélation, l'app n'affiche aucun dérivé de la photo.
- **Vagues** : calcul déterministe côté téléphone (`waves.ts`) → rappels locaux programmés 7 jours à l'avance (fonctionne sans serveur de push). Régions Amériques / EMEA / APAC, 11 h 30–20 h 30 heure de référence, repli 19 h locale.
- **Purge** : Edge Function `purge-media` planifiée chaque heure (selfies expirés / > 24 h, stories expirées).
- **Reste à faire** : push « nouveau match » (build de dev + Apple Developer), modération automatique avant mise en file (phase 6), blocage dans le matching (phase 6).

Choix faits en phase 2 :
- **Anti-aspiration des profils** : la lecture directe de la table `profiles` est limitée à soi-même et à ses relations (follow dans un sens ou l'autre). Les autres profils ne s'ouvrent que par identifiant via `get_profile()` (match, QR, listes). Aucune recherche par pseudo n'existe.
- **Compte privé** : un follow devient une demande ; contenus et listes d'abonnés masqués aux non-abonnés ; repasser en public accepte toutes les demandes en attente.
- **Photos de publications et stories** : buckets privés, URLs signées 1 h, délivrées seulement si l'utilisateur a le droit de voir le contenu (politique `select` de Storage). Les fichiers d'une story expirée ne sont plus lisibles.
- **Modération** : colonne `moderation` déjà présente (`approved` par défaut) ; la phase 6 fera passer les nouvelles photos en `pending` jusqu'à l'analyse automatique.
- **À faire en phase 3** : suppression physique des fichiers de stories expirées (tâche planifiée côté serveur, mise en place avec celle des selfies 24 h).

Autres choix techniques faits en phase 1 :
- **Avatars** : bucket en lecture publique, noms de fichiers aléatoires (pour la mise en cache). Selfies, posts, stories et photos de DM restent **privés** (URLs signées).
- **Date de naissance** : saisie neutre (aucune date pré-remplie), **non modifiable**. Un refus < 18 ans bloque le compte définitivement **et** l'appareil.
- **Connexion** : email + code à 6 chiffres (OTP) et Sign in with Apple au lancement ; Google ensuite ; SMS plus tard.
- **CGU** : 3 consentements distincts non pré-cochés, version + date enregistrées côté serveur.

---

---

## 1. Vue d'ensemble

```
┌──────────────────────────────┐        ┌─────────────────────────────────────────────┐
│  App mobile (Expo / RN / TS) │        │                 Supabase (région UE)          │
│  iOS + Android               │ HTTPS  │                                               │
│                              │◄──────►│  Auth (email OTP, Apple, Google, tél. plus    │
│  - Expo Router (navigation)  │  WSS   │        tard)                                  │
│  - TanStack Query (cache)    │        │  Postgres + RLS (toutes les règles métier)    │
│  - Zustand (état local)      │        │   ├─ fonctions SQL (RPC) : matching, follow,  │
│  - expo-camera (selfie, QR)  │        │   │   envoi DM, décisions de match…           │
│  - Reanimated + Skia (anims) │        │   ├─ pg_cron : expiration file, stories 24 h, │
│  - i18next + expo-localization│       │   │   purge RGPD, envoi des notifs du jour    │
│  - expo-notifications        │        │   └─ triggers : compteurs, bascule Spam       │
└──────────────────────────────┘        │  Storage (buckets PRIVÉS, URLs signées)       │
                                        │  Realtime (DM, statut du match)               │
┌──────────────────────────────┐        │  Edge Functions (Deno/TS) :                   │
│  Back-office admin (web)     │◄──────►│   ├─ upload-selfie → modération → file        │
│  Next.js, phase 6            │        │   ├─ get-media-url (URLs signées contrôlées)  │
└──────────────────────────────┘        │   ├─ send-push (Expo Push API)                │
                                        │   ├─ export-data / delete-account (RGPD)      │
                                        │   └─ webhook modération / vérif. d'âge        │
                                        └───────────────┬───────────────────────────────┘
                                                        │
                       ┌────────────────────────────────┼───────────────────────────┐
                       ▼                                ▼                           ▼
              Expo Push (FCM/APNs)       API modération d'images        (plus tard) vérification
                                         (ex. AWS Rekognition /         d'âge/ID : Yoti, Veriff…
                                          Sightengine / Hive)
```

### Pourquoi Supabase plutôt que Firebase

| Critère | Supabase | Firebase |
|---|---|---|
| Données très relationnelles (follows, matches, blocages, historique de paires) | ✅ Postgres, jointures, contraintes, index | ⚠️ Firestore NoSQL : dénormalisation, requêtes limitées |
| Matching **atomique** (2 personnes ne doivent jamais être prises par 2 matchs à la fois) | ✅ transaction SQL + `FOR UPDATE SKIP LOCKED` | ⚠️ transactions Firestore possibles mais contention et logique plus complexe |
| Sécurité côté serveur | ✅ RLS en SQL, testable (pgTAP) | ✅ Security Rules, mais moins expressives pour ces règles croisées |
| Verrouillage des selfies | ✅ bucket privé + URLs signées délivrées par une fonction qui vérifie le match | ✅ possible aussi |
| RGPD | ✅ hébergement UE (Francfort), export SQL simple, open source (pas d'enfermement) | ✅ région UE possible |
| Temps réel (DM) | ✅ Realtime (suffisant au lancement) | ✅ excellent |
| Coût | prévisible (25 $/mois Pro) | à l'usage, peut surprendre |

**Conclusion : Supabase.** Le cœur du produit (matching, règle Spam, blocages) est de la logique relationnelle et transactionnelle : Postgres est l'outil idéal. Firebase resterait meilleur pour du temps réel massif, ce qui n'est pas notre goulot au lancement.

### Stack mobile complète

| Besoin | Choix |
|---|---|
| Framework | Expo SDK (dernière stable) + React Native + TypeScript strict |
| Navigation | Expo Router (routes par fichiers, deep links pour QR / notifs) |
| Données serveur | `@supabase/supabase-js` + TanStack Query |
| État local | Zustand |
| Caméra / scan QR | `expo-camera` (caméra frontale forcée, `CameraView` + scan de codes-barres) |
| Génération QR | `react-native-qrcode-svg` |
| Images | `expo-image` (cache), `expo-image-manipulator` (redimensionnement + **suppression EXIF/GPS**) |
| Animations | `react-native-reanimated` + `@shopify/react-native-skia` (effet de révélation) + `expo-haptics` |
| i18n | `i18next` + `react-i18next` + `expo-localization` ; dates via `Intl` / `date-fns-tz` |
| Push | `expo-notifications` + Expo Push API |
| Anti-capture | `expo-screen-capture` (bloque sur Android, détecte sur iOS) |
| Stockage sécurisé session | `expo-secure-store` |
| Monitoring | Sentry (crashs) |
| Build / publication | EAS Build + EAS Submit + EAS Update (pas besoin de Mac) |
| Tests | Jest + React Native Testing Library (app), **pgTAP** (SQL/RLS), Deno test (Edge Functions), Maestro (E2E, phase 7) |

### Structure du dépôt (monorepo)

```
PBS/
├─ apps/
│  ├─ mobile/                 # App Expo
│  │  ├─ app/                 # Écrans (Expo Router)
│  │  │  ├─ (auth)/           # onboarding, connexion, date de naissance, profil initial
│  │  │  ├─ (tabs)/           # accueil, selfie, messages, profil
│  │  │  ├─ match/[id].tsx    # attente + résultat de match
│  │  │  ├─ user/[username].tsx
│  │  │  ├─ qr/               # mon QR, scanner
│  │  │  └─ settings/
│  │  ├─ src/
│  │  │  ├─ features/         # auth, selfie, match, feed, stories, dm, qr, moderation…
│  │  │  ├─ components/       # UI réutilisable (design system)
│  │  │  ├─ lib/              # client supabase, notifications, i18n, analytics
│  │  │  ├─ theme/            # couleurs, typo, espacements (clair/sombre)
│  │  │  └─ locales/          # fr.json, en.json…
│  │  └─ app.config.ts
│  └─ admin/                  # Back-office Next.js (phase 6)
├─ packages/
│  └─ shared/                 # Types TS générés depuis la BDD, constantes, validation (zod)
├─ supabase/
│  ├─ migrations/             # Schéma SQL versionné
│  ├─ functions/              # Edge Functions
│  ├─ tests/                  # Tests pgTAP (RLS, matching, Spam…)
│  └─ seed.sql                # Données de test
└─ docs/                      # Ce document, guides pas-à-pas, légal
```

---

## 2. Points de vigilance (techniques, légaux, sécurité)

1. **Contradiction apparente dans le flux de selfie.** Si le matching apparie deux selfies *déjà envoyés*, les deux ont forcément envoyé : le « verrouillage en attente de l'autre » n'existe alors que pendant le temps d'attente. Deux modèles possibles (❓ question 2) :
   - **A. Envoi → file → match** (asynchrone) : tu envoies, tu attends qu'un autre selfie arrive (quelques secondes à 30 min), les deux se révèlent ensemble. Robuste même avec peu d'utilisateurs.
   - **B. Lobby → match → photo en direct** (synchrone) : tu appuies sur « Je suis prêt », tu es apparié à quelqu'un de connecté, compte à rebours de 60 s pour que chacun prenne son selfie, révélation simultanée. Plus magique, mais exige deux personnes connectées **au même moment** → fragile au lancement.
   - **Recommandation : A**, avec révélation synchronisée (compte à rebours 3-2-1 sur les deux téléphones via Realtime) et notif push si tu as quitté l'app pendant l'attente. B pourra devenir un mode « Live » plus tard.
2. **Démarrage à froid (« cold start »).** Avec peu d'utilisateurs, la file sera souvent vide. Le matching relâche progressivement ses contraintes (préférence de langue → diversité pays) avant d'expirer, et la notif quotidienne concentre l'activité sur un créneau.
3. **Risque majeur : exhibitionnisme / nudité.** Un échange de photos entre inconnus est exactement le scénario des « chatroulette ». Donc **la modération automatique doit se faire AVANT que le selfie entre dans la file** (bloquante, ~1 s), pas après. On ajoute une détection de visage (un selfie doit contenir un visage), un signalement à 1 clic sur l'écran de résultat, et le bannissement rapide. Pour les publications/stories : modération avant publication également.
4. **Contenus pédopornographiques (CSAM).** Même sur une app 18+, l'obligation de détecter et signaler existe (NCMEC aux US, autorités nationales en UE). Prévoir un outil de hachage spécialisé (ex. Thorn Safer, PhotoDNA) dans la chaîne de modération — à intégrer avant le lancement public.
5. **Âge : la date de naissance déclarative est faible.** On bloque strictement < 18 ans et on **interdit de modifier la date** ensuite (anti-contournement). On prévoit une table `age_verifications` et un niveau de vérification par utilisateur pour brancher plus tard : les signaux d'âge des stores (Apple *Declared Age Range*, Google Play *Age Signals*) puis un prestataire d'identité (Yoti, Veriff…). Les obligations varient selon les pays (UK Online Safety Act, lois de certains États US, DSA en UE) : **à faire valider par un juriste avant le lancement**.
6. **DSA (UE).** En tant que plateforme d'hébergement : point de contact, mécanisme de notification, motivation des décisions de modération envoyée à l'utilisateur, possibilité de contester. Le back-office l'intègre.
7. **Captures d'écran.** Impossible de les empêcher à 100 % : on les bloque sur Android (`FLAG_SECURE`) et on les détecte sur iOS (notification « X a fait une capture »). Le verrouillage côté serveur protège *avant* le déblocage, pas après.
8. **« Caméra frontale uniquement, pas de galerie »** : faisable dans l'UI, mais un appareil rooté / une caméra virtuelle peut tricher. Acceptable ; la modération + détection de visage limitent l'abus.
9. **Vie privée des photos.** Suppression systématique des métadonnées EXIF (dont la position GPS) côté client **et** côté serveur. Buckets privés uniquement, URLs signées de courte durée (5 min).
10. **Connexion par téléphone (SMS OTP).** Coûteuse et cible de fraude (« SMS pumping »). Recommandation : email OTP + Apple + Google au lancement, téléphone en option plus tard avec plafond et captcha. Rappel : Apple **exige** Sign in with Apple si on propose Google.
11. **DM entre inconnus.** Même avec la boîte Spam, il faut limiter le harcèlement : dans une demande non acceptée, **1 seul message** (texte uniquement, ou photo floutée) tant que le destinataire n'a pas accepté — comme Instagram.
12. **Compte Apple Developer.** Un compte « individuel » affiche ton nom légal sur l'App Store ; un compte « organisation » demande une société (numéro D-U-N-S). Pour une app sociale avec contenu généré par les utilisateurs, une structure juridique est fortement conseillée.

---

## 3. Logique métier clé

### 3.1 Notification quotidienne et fuseaux horaires

Options :

| Option | + | − |
|---|---|---|
| 1. Heure locale fixe (ex. 19 h partout) | prévisible, simple | routinier ; les pays ne jouent pas en même temps → peu de mix international |
| 2. Heure aléatoire dans une fenêtre locale (ex. 12 h–21 h) | effet surprise | utilisateurs d'un même pays dispersés → file plus vide |
| 3. Moment global unique | simultanéité maximale, mix international | 3 h du matin pour une partie du monde |
| **4. Recommandé : « vagues » régionales** | | |

**Recommandation (option 4)** : chaque jour, un horaire aléatoire est tiré **par grande région** (Amériques, Europe/Afrique, Asie/Océanie), dans une fenêtre 11 h–21 h locale, en choisissant de préférence un créneau qui **chevauche** une autre région (ex. 19 h Paris = 13 h New York). Tout le monde d'une région est notifié en même temps → la file se remplit d'un coup, avec plusieurs pays. Comme l'envoi est illimité, on peut jouer à tout moment ; la notif sert juste de « rendez-vous ». Option utilisateur : « me notifier à heure fixe » à la place. Implémentation : `pg_cron` toutes les minutes → sélectionne les utilisateurs dont la vague tombe maintenant → Edge Function `send-push` par lots.

### 3.2 Envoi de selfie et matching (modèle A)

```
Client                         Edge Function upload-selfie              Postgres
  │  1. capture caméra frontale      │                                      │
  │  2. resize 1080px + strip EXIF   │                                      │
  │  3. POST (client_request_id) ───►│  4. rate limit + compte actif        │
  │                                  │  5. upload bucket privé "selfies"    │
  │                                  │  6. modération (nudité, visage)      │
  │                                  │     └─ refus → status=rejected       │
  │                                  │  7. rpc enqueue_and_match() ────────►│ transaction :
  │                                  │                                      │  - insère submission (pending)
  │                                  │                                      │  - cherche 1 candidat
  │                                  │                                      │    FOR UPDATE SKIP LOCKED
  │                                  │                                      │  - si trouvé : crée match,
  │                                  │                                      │    unlocked_at = now()
  │◄─────────── match_id ou "waiting"│◄─────────────────────────────────────│
  │  8. abonnement Realtime au statut│                                      │
  │  9. révélation : get-media-url ─►│ vérifie : je suis dans le match ET   │
  │     (URL signée 5 min)           │ unlocked_at non nul → URL signée     │
```

Règles du choix de candidat (dans une seule requête SQL indexée) :

- `status = 'pending'` et non expiré, `user_id <> moi`
- aucun blocage dans un sens ou dans l'autre
- jamais appariés ensemble dans les **N derniers jours** (table `match_pairs`, ❓ N = 30 j ou « jamais »)
- pas de compte suspendu
- **score** : `+ ancienneté dans la file` (les plus anciens d'abord, équité) `+ bonus pays différent` `+ bonus langue commune si préférence activée`
- **relâchement progressif** : à 0–2 min on exige la langue préférée si l'option est active ; après 2 min on l'abandonne
- **expiration** après 30 min (❓) → statut `expired`, notification « personne n'était disponible, réessaie » ; le selfie expiré est supprimé du stockage
- **1 seul selfie en attente par utilisateur à la fois** (contrainte unique partielle) → l'illimité se fait en série, pas en rafale
- **idempotence** : `client_request_id` unique par utilisateur (un double tap ou un réseau instable ne crée pas deux envois) ; chaque submission ne peut appartenir qu'à un seul match (contraintes `unique`)
- **anti-abus** : max X envois / heure (ex. 30), plafond de signalements reçus → suspension automatique en attente de revue
- **montée en charge** : le matching se fait à l'insertion + un job `pg_cron` toutes les 10 s qui tente de ré-apparier les selfies en attente (au cas où deux arrivent en même temps). Au-delà de ~100 k utilisateurs actifs simultanés, on sortira le matcher dans un worker dédié (Redis/queue) sans changer l'app.

**Verrouillage côté serveur** : le bucket `selfies` n'a **aucune** politique de lecture pour les utilisateurs. Seule la fonction `get-media-url` (clé service) génère une URL signée, après vérification en base. Avant déblocage, le client n'affiche **aucun dérivé de la vraie photo** (même floutée : un flou peut se « déflouter » et une miniature fuit de l'information) mais un visuel abstrait animé + le drapeau du pays de l'autre.

**Décisions** : `follow` ou `pass`, indépendantes, via `rpc decide_match(match_id, decision)`. Follow crée une ligne `follows` (`source = 'match'`) — ou une demande si le compte est privé.

### 3.3 Follow, comptes privés

- Follow unidirectionnel. Compteurs maintenus par trigger.
- **Compte privé (proposé)** : un follow devient une *demande* à accepter ; publications et stories visibles seulement par les abonnés acceptés. Le selfie de match reste visible dans le match quel que soit le statut.
- Pas de recherche : aucune API ne permet de lister des profils par nom. Un profil n'est accessible que si : match commun, lien via QR, ou présent dans une liste abonnés/abonnements consultée.
  ⚠️ Conséquence : les listes d'abonnés deviennent un moyen de découverte (de proche en proche). C'est conforme à ta demande ; on peut masquer les listes des comptes privés.

### 3.4 QR code

- Le QR encode un lien `https://<domaine>/q/<jeton>` (s'ouvre dans l'app via universal link, ou mène au store si l'app n'est pas installée).
- Jeton aléatoire 128 bits, **seul son hash est stocké**. Régénérable à tout moment (l'ancien est révoqué).
- **Décidé : scan = follow simple.** Le propriétaire du QR reçoit une notification et choisit de suivre en retour ou non.
- Rate limit sur la résolution de jetons (anti-force brute).

### 3.5 Messagerie et boîte Spam

- Qui peut écrire à qui (proposé) : A peut écrire à B si A suit B (ou si B a accepté la conversation), et sans blocage.
- Le dossier n'est **pas** stocké sur chaque message mais **par participant** (`conversation_members.folder`), recalculé par trigger dès qu'un follow change :
  - B suit A (et A suit B) → `primary` pour B
  - sinon, tant que B n'a pas accepté → `requests` pour B
  - B accepte → `primary` définitivement (même sans follow)
  - Cela rend la bascule **automatique et instantanée** quand B suit A. Chaque message garde néanmoins un champ `delivered_folder` pour l'historique/les notifs.
- Push : seulement si le message arrive en `primary` ; rien pour `requests` (un badge silencieux).
- Depuis Demandes : accepter / supprimer / bloquer / signaler. Limite : 1 message tant que non accepté.
- Accusés de lecture : `last_read_at` par participant (désactivables dans les paramètres ❓).
- Temps réel : Supabase Realtime (Postgres changes filtrés par RLS).

---

## 4. Modèle de données (brouillon SQL)

> La version finale, testée (pgTAP), sera livrée en phase 1 (tables auth/profils) et étoffée à chaque phase. Toutes les tables ont RLS activé ; **aucune écriture sensible ne se fait par `insert` direct** : elles passent par des fonctions `security definer` qui vérifient les règles.

```sql
-- ===== Extensions & types =====
create extension if not exists citext;
create extension if not exists pgcrypto;

create type account_status     as enum ('active','suspended','banned','deleted');
create type age_level          as enum ('self_declared','store_signal','id_verified');
create type submission_status  as enum ('moderating','pending','matched','expired','rejected','cancelled');
create type match_decision     as enum ('pending','follow','pass');
create type follow_status      as enum ('active','requested');
create type follow_source      as enum ('match','qr','profile');
create type moderation_status  as enum ('pending','approved','rejected','needs_review');
create type inbox_folder       as enum ('primary','requests');
create type report_target      as enum ('user','post','story','selfie','message');
create type report_status      as enum ('open','in_review','actioned','dismissed');

-- ===== Utilisateurs =====
-- Profil PUBLIC (lisible par les autres selon RLS)
create table profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  username         citext not null unique check (username ~ '^[a-z0-9_.]{3,30}$'),
  display_name     text check (char_length(display_name) <= 50),
  bio              text check (char_length(bio) <= 160),
  avatar_path      text,
  country_code     char(2),
  is_private       boolean not null default false,
  followers_count  int not null default 0,
  following_count  int not null default 0,
  posts_count      int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Données PRIVÉES (jamais lisibles par un autre utilisateur)
create table user_private (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  birth_date           date not null,            -- non modifiable (trigger)
  age_level            age_level not null default 'self_declared',
  status               account_status not null default 'active',
  locale               text not null default 'en',
  timezone             text not null default 'UTC',
  languages            text[] not null default '{}',
  match_same_language  boolean not null default false,
  notif_mode           text not null default 'wave' check (notif_mode in ('wave','fixed','off')),
  notif_fixed_hour     smallint check (notif_fixed_hour between 0 and 23),
  read_receipts        boolean not null default true,
  terms_version        text not null,
  terms_accepted_at    timestamptz not null,
  deletion_requested_at timestamptz,
  created_at           timestamptz not null default now()
);
-- Trigger before insert : refuse si age(birth_date) < 18 ; before update : interdit de changer birth_date.

-- Prévu pour plus tard : vérification renforcée par prestataire
create table age_verifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  provider    text not null,                -- 'apple_age_range','google_age_signals','yoti'…
  result      text not null,                -- 'adult','minor','failed'
  reference   text,                         -- id chez le prestataire (pas de pièce d'identité stockée)
  created_at  timestamptz not null default now()
);

-- ===== Selfies & matching =====
create table selfie_submissions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles(id) on delete cascade,
  client_request_id uuid not null,
  storage_path      text not null,
  status            submission_status not null default 'moderating',
  country_code      char(2),
  languages         text[] not null default '{}',
  same_language     boolean not null default false,
  created_at        timestamptz not null default now(),
  queued_at         timestamptz,
  expires_at        timestamptz,
  unique (user_id, client_request_id)                    -- idempotence
);
create index selfie_queue_idx on selfie_submissions (queued_at) where status = 'pending';
create unique index one_active_submission_per_user
  on selfie_submissions (user_id) where status in ('moderating','pending');

create table matches (
  id            uuid primary key default gen_random_uuid(),
  submission_a  uuid not null unique references selfie_submissions(id),
  submission_b  uuid not null unique references selfie_submissions(id),
  user_a        uuid not null references profiles(id) on delete cascade,
  user_b        uuid not null references profiles(id) on delete cascade,
  unlocked_at   timestamptz,                 -- NULL = verrouillé
  decision_a    match_decision not null default 'pending',
  decision_b    match_decision not null default 'pending',
  created_at    timestamptz not null default now(),
  check (user_a <> user_b)
);
create index matches_user_a_idx on matches (user_a, created_at desc);
create index matches_user_b_idx on matches (user_b, created_at desc);

-- Historique compact des paires (exclusion rapide des re-matchs)
create table match_pairs (
  user_low        uuid not null,
  user_high       uuid not null,
  last_matched_at timestamptz not null,
  primary key (user_low, user_high),
  check (user_low < user_high)
);

-- ===== Social =====
create table follows (
  follower_id uuid not null references profiles(id) on delete cascade,
  followee_id uuid not null references profiles(id) on delete cascade,
  status      follow_status not null default 'active',
  source      follow_source not null,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee_idx on follows (followee_id, status);

create table posts (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references profiles(id) on delete cascade,
  caption     text check (char_length(caption) <= 2200),
  moderation  moderation_status not null default 'pending',
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index posts_author_idx on posts (author_id, created_at desc) where deleted_at is null;

create table post_media (
  post_id      uuid not null references posts(id) on delete cascade,
  position     smallint not null check (position between 0 and 9),
  storage_path text not null,
  width        int, height int,
  primary key (post_id, position)
);

create table stories (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references profiles(id) on delete cascade,
  storage_path text not null,
  moderation   moderation_status not null default 'pending',
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '24 hours'
);
create index stories_active_idx on stories (author_id, expires_at);

create table story_views (
  story_id   uuid not null references stories(id) on delete cascade,
  viewer_id  uuid not null references profiles(id) on delete cascade,
  viewed_at  timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

-- ===== Messagerie =====
create table conversations (
  id              uuid primary key default gen_random_uuid(),
  dm_key          text not null unique,       -- 'uuidMin:uuidMax' → une seule conv par paire
  created_at      timestamptz not null default now(),
  last_message_at timestamptz
);

create table conversation_members (
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  folder          inbox_folder not null,      -- recalculé par trigger sur follows
  accepted_at     timestamptz,
  last_read_at    timestamptz,
  muted           boolean not null default false,
  hidden_at       timestamptz,                -- "supprimer la conversation" côté moi
  primary key (conversation_id, user_id)
);
create index conv_members_inbox_idx on conversation_members (user_id, folder);

create table messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references conversations(id) on delete cascade,
  sender_id        uuid not null references profiles(id) on delete cascade,
  body             text check (char_length(body) <= 2000),
  media_path       text,
  delivered_folder inbox_folder not null,     -- dossier au moment de l'envoi (notifs, stats)
  created_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  check (body is not null or media_path is not null)
);
create index messages_conv_idx on messages (conversation_id, created_at desc);

-- ===== Sécurité / modération =====
create table blocks (
  blocker_id uuid not null references profiles(id) on delete cascade,
  blocked_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
create index blocks_blocked_idx on blocks (blocked_id);

create table mutes (
  muter_id uuid not null references profiles(id) on delete cascade,
  muted_id uuid not null references profiles(id) on delete cascade,
  primary key (muter_id, muted_id)
);

create table reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid references profiles(id) on delete set null,
  target_type  report_target not null,
  target_id    uuid not null,
  target_user  uuid references profiles(id) on delete set null,
  reason       text not null,               -- 'nudity','harassment','minor','spam','violence','other'
  details      text check (char_length(details) <= 1000),
  status       report_status not null default 'open',
  handled_by   uuid,
  decision_note text,                       -- motivation (DSA)
  created_at   timestamptz not null default now(),
  handled_at   timestamptz
);
create index reports_open_idx on reports (status, created_at) where status in ('open','in_review');

create table moderation_events (
  id           uuid primary key default gen_random_uuid(),
  object_type  text not null,                -- 'selfie','post_media','story','avatar','message_media'
  object_id    uuid not null,
  provider     text not null,
  labels       jsonb not null,
  decision     moderation_status not null,
  created_at   timestamptz not null default now()
);

create table admins (user_id uuid primary key references auth.users(id) on delete cascade);

-- ===== QR & notifications =====
create table qr_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  token_hash  bytea not null unique,          -- sha256 du jeton ; le jeton en clair n'est jamais stocké
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz
);
create unique index one_active_qr_per_user on qr_tokens (user_id) where revoked_at is null;

create table push_tokens (
  token       text primary key,               -- ExponentPushToken[...]
  user_id     uuid not null references profiles(id) on delete cascade,
  platform    text not null check (platform in ('ios','android')),
  updated_at  timestamptz not null default now()
);
create index push_tokens_user_idx on push_tokens (user_id);

-- ===== Anti-abus =====
create table rate_limit_events (
  user_id    uuid not null,
  action     text not null,                   -- 'selfie','message','qr_resolve','report'
  created_at timestamptz not null default now()
);
create index rate_limit_idx on rate_limit_events (user_id, action, created_at desc);
```

### Politiques RLS (principes + exemples)

```sql
-- Helper : blocage dans un sens ou l'autre
create function is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks
                 where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

alter table profiles enable row level security;
create policy "profils visibles sauf blocage" on profiles for select to authenticated
  using (not is_blocked(auth.uid(), id));
create policy "je modifie mon profil" on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- (les compteurs ne sont pas modifiables par le client : colonnes protégées par trigger/grant)

alter table user_private enable row level security;
create policy "mes données privées" on user_private for select to authenticated
  using (user_id = auth.uid());
-- pas d'insert/update direct : RPC complete_onboarding() / update_settings()

alter table selfie_submissions enable row level security;
create policy "mes envois" on selfie_submissions for select to authenticated
  using (user_id = auth.uid());             -- aucun insert direct : Edge Function uniquement

alter table matches enable row level security;
create policy "mes matchs" on matches for select to authenticated
  using (auth.uid() in (user_a, user_b));   -- décisions via rpc decide_match()

alter table posts enable row level security;
create policy "posts visibles" on posts for select to authenticated using (
  deleted_at is null and moderation = 'approved'
  and not is_blocked(auth.uid(), author_id)
  and ( author_id = auth.uid()
     or not (select is_private from profiles where id = author_id)
     or exists (select 1 from follows f where f.follower_id = auth.uid()
                and f.followee_id = author_id and f.status = 'active') )
);
-- stories : même règle + expires_at > now()

alter table messages enable row level security;
create policy "messages de mes conversations" on messages for select to authenticated using (
  exists (select 1 from conversation_members m
          where m.conversation_id = messages.conversation_id and m.user_id = auth.uid())
);                                           -- envoi via rpc send_message() (vérifie follow, blocage, limite demandes)

alter table blocks enable row level security;
create policy "mes blocages" on blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

alter table reports enable row level security;
create policy "je signale" on reports for insert to authenticated with check (reporter_id = auth.uid());
-- lecture réservée aux admins (back-office via clé service ou policy admins)

-- Storage : buckets privés
--  selfies/       : AUCUNE policy select pour authenticated → seule get-media-url délivre des URLs signées
--  avatars/, posts/, stories/, dm/ : lecture via URL signée émise après contrôle (même logique que RLS)
--  upload : chaque utilisateur n'écrit que dans son dossier  <bucket>/<auth.uid()>/...
```

---

## 5. Écrans

1. **Onboarding** : présentation (3 cartes) → connexion (email OTP / Apple / Google) → date de naissance (blocage < 18) → CGU + confidentialité (consentement) → pseudo + photo + bio + pays/langues → autorisation notifications/caméra.
2. **Onglets** : `Accueil` · `Messages` · **[bouton selfie central, surdimensionné]** · `QR` · `Profil`
3. **Accueil** : barre de stories en haut + fil chronologique des comptes suivis.
4. **Selfie** : caméra frontale plein écran, bouton déclencheur, aperçu, envoyer / reprendre.
5. **Attente** : animation « recherche d'un inconnu quelque part dans le monde » (globe/pulse), possibilité de quitter (notif au match).
6. **Résultat** : révélation animée, selfie de l'autre + mini-profil, `Follow` / `Passer`, `Signaler`, « Encore un ! ».
7. **Profil** (moi / autre) : avatar, pseudo, bio, compteurs, grille de posts, bouton Follow/Message.
8. **Créer** : post (1–10 photos + légende) ou story.
9. **Messages** : onglets `Principale` / `Demandes (n)`, conversation temps réel.
10. **QR** : mon QR plein écran (luminosité max) / scanner, régénérer.
11. **Paramètres** : compte, confidentialité (privé, accusés de lecture, bloqués), notifications, langue, exporter mes données, supprimer mon compte, CGU.
12. **Historique des matchs** (proposé) : liste des échanges passés.

---

## 6. Identité visuelle (proposition)

- **Concept** : « le flash » — l'instant où l'on se découvre.
- **Couleurs**
  - Accent principal *Flash* : `#FF4D2E` (corail électrique) → dégradé vers `#FF2E7E` pour le bouton selfie
  - Secondaire *Nuit* : `#6C5CE7` (violet, liens et états)
  - Sombre : fond `#0B0B0F`, surfaces `#16161D`, texte `#F5F5F7`
  - Clair : fond `#FAFAF7`, surfaces `#FFFFFF`, texte `#111114`
  - Sémantiques : succès `#22C55E`, erreur `#EF4444`
- **Typographie** : *Bricolage Grotesque* (titres, caractère) + *Inter* (interface) — gratuites (Google Fonts).
- **Bouton selfie** : rond 76 px au centre de la barre d'onglets, dégradé Flash, anneau qui « respire » ; plein écran pendant la vague quotidienne avec compte à rebours.
- **Révélation** : compte 3-2-1 synchronisé → éclair blanc (flash) + vibration → la photo passe d'un flou fort (Skia, généré à partir de la *vraie* photo seulement après déblocage) à net en 600 ms avec léger zoom arrière ; les deux selfies glissent côte à côte.

---

## 7. Comptes à créer (quand ce sera nécessaire)

| Compte | Quand | Coût |
|---|---|---|
| GitHub | déjà fait | gratuit |
| Supabase (projet région Francfort) | phase 1 | gratuit au début, Pro 25 $/mois avant lancement |
| Expo (EAS) | phase 1 | gratuit (quota de builds), 19 $/mois si besoin |
| Apple Developer Program | phase 1–3 (builds iPhone) | 99 $/an |
| Google Play Console | phase 3 ou 7 | 25 $ une fois |
| Google Cloud (OAuth Google) | phase 1 | gratuit |
| API de modération | phase 3 | ~0,5–1,5 $ / 1000 images |
| Sentry | phase 7 | gratuit au début |
| Nom de domaine (liens QR, CGU) | phase 4 | ~15 €/an |

Tu n'as **pas besoin d'un Mac** : les builds iOS se font dans le cloud avec EAS. Pour tester tôt, l'app **Expo Go** suffit pour les phases 1–2 ; à partir de la phase 3 (notifications push), il faudra un *development build* installé sur ton téléphone.

---

## 8. Plan des phases (rappel, inchangé)

1. Setup monorepo, Supabase, schéma auth/profils, inscription + âge, i18n de base, thème
2. Profil, publications, stories, follow (+ comptes privés)
3. Selfie du jour : caméra, upload, modération, file de matching, déblocage serveur, révélation, notifications
4. QR code
5. Messagerie temps réel + Demandes/Spam
6. Modération, signalement, blocage, back-office, RGPD (export/suppression)
7. Polish, i18n complète, tests E2E, publication stores
