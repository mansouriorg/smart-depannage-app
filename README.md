# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## Languages (P3-04)

The app speaks French (the source language) and Arabic (Modern Standard Arabic, read right to left). The words live in the shared
package, not in the app: `smart-depannage-shared/src/i18n/fr/app.ts` and `ar/app.ts` (namespace `app`, nested by screen:
`app.mission.waiting.assigned`), plus the common words in `common` that every app shares. `lib/shared` is a generated copy of that
package: never edit it.

**How the language is chosen and stored**

- `services/i18n.tsx` holds the `I18nProvider` (at the root, in `app/_layout.tsx`) and the hook `useI18n()` which gives
  `{ locale, t, setLocale, isRtl }`. Code outside React (the axios interceptor, push, the alerts of a service) reads `currentLocale()`.
- The technician's choice is kept on the phone (`expo-secure-store`, key `app_locale`) and on the server (`PATCH /users/me/locale`, which
  decides the language of the SMS, e-mails and notifications written for this account). A failed call is silent: the choice stays on
  the phone and is told again at the next sign-in.
- First launch, nothing stored: the language of the phone if it is Arabic or French, else French (read from `Intl`, `deviceLanguageTag()`; the
  package `expo-localization` would report it more reliably on iOS and can replace that function).
- At sign-in: a language chosen on this phone wins (the server is told). With no choice made on this phone, an account that holds Arabic gives the phone
  Arabic; the server's French is not taken, because every account holds French until its owner chooses (it says nothing about a choice), so a phone in Arabic
  is not turned back to French at sign-in and the server is told the phone's language instead (`afterSignIn` in `services/i18n-core.ts`).
- Every API call carries `X-App-Locale: fr|ar`.
- The selector is on the Profile tab (a row per language, the current one checked) and a small link on the login screen.
- Dates and times use `Intl` with `fr-TN` / `ar-TN`, the time of Tunis (`Africa/Tunis`), digits 0-9 and a 24-hour clock. Amounts and
  other values come from the shared helpers called with the current locale as their last argument.
- The pure rules (which language to start in, the sign-in rule, the direction decisions) are in `services/i18n-core.ts`, with no React
  import, so they can be run with plain `node`.

**Right to left**

- `I18nManager.allowRTL(false)` runs when the root layout loads: the direction is the app's own choice and nothing else (with `allowRTL(true)`,
  a phone set to Arabic would draw the system bars from right to left whatever language the technician chose in the app). Every time the language
  is chosen, `I18nManager.forceRTL(...)` stores the direction for the next launch, and the root `View` carries `direction: 'rtl' | 'ltr'`, so rows,
  `start` / `end` offsets and text alignment mirror at once, without a restart.
- Limit: the bars drawn by the system (the tab bar, the headers of the navigation stack) only follow `forceRTL` after the app is closed and
  reopened. After a switch that changes the direction the app says so once (an alert); until then the screens are mirrored but those bars
  are not.
- Write styles with logical properties: `marginStart` / `marginEnd`, `paddingStart` / `paddingEnd`, `start` / `end`, `borderStartWidth`,
  `textAlign: 'center'` or no `textAlign`; never `marginLeft`, `paddingRight`, `left`, `right`, `textAlign: 'left'`, `row-reverse`.
  Arrows and chevrons are turned with `mirrorStyle(locale)`. Phone numbers, e-mails, codes and amounts keep their order with
  `writingDirection: 'ltr'`. Do not use `letterSpacing` on Arabic text (it breaks the joined letters): use `spacing(locale, value)`.
- Known limit: the texts of the camera and location permission prompts come from `app.json` (`cameraPermission` of expo-camera,
  `locationWhenInUsePermission` of expo-location). They stay French: translating them needs the Expo localization plugin and a new
  native build.

**Adding a string**

1. Add the key to `smart-depannage-shared/src/i18n/fr/app.ts` (French, exactly what the screen says) and to `ar/app.ts` (Arabic).
   Values go in as `{name}`; a count as `{count, plural, one{...} other{...}}` (Arabic needs `one`, `two`, `few`, `many`, `other`).
   No `#`, `<`, `>` or straight `'` in a message (write ’). Reuse a word from `common` when one fits.
2. Run `npm run sync` in `smart-depannage-shared` (it refreshes `lib/shared` here), then use it: `t('app.mission.title')` in a component, or
   `message(locale, 'app.mission.title')` in a service that receives the locale as an argument.
3. Run `npm run check:i18n`.

**The guard**

`npm run check:i18n` (`scripts/check-i18n.mjs`, plain Node, no dependency) fails with `file:line` when French (or Arabic) text is left in
`app/`, `components/`, `services/`, `hooks/` or `constants/`: a string, a template text or JSX text with an accented French letter or a
common French word. It ignores comments, `console.*`, imports, paths and URLs, and keys. The few exceptions are listed in the script
with the reason of each (`ALLOWED`). It reads text, it does not understand it: a French sentence with no accent and no common French
word would pass, so read the diff of a new screen too.

## Position while online (P3-05)

While the technician is **online or busy, or has a job on the way, arrived or at work, and the app is in front**, the phone sends its position about every 30 seconds (`services/position-beat.ts`, started by `app/(tabs)/index.tsx`). The dispatcher
sees a flag on a technician whose phone has been silent, the customer is given an arrival time only from a recent position, and the server keeps the positions for a few days so that a route can be replayed for a dispute.

- It **stops** when the app goes to the background, when the technician goes offline with no job under way (a technician who switches off to stop new requests while on the way keeps sending until the job is over),
  when the location is refused or not yet allowed on the phone (the availability card says which: "refused, allow it in the settings", or "press Actualiser ma position to allow it"), and when the technician presses "Se déconnecter" or the session ends in any other way (`stopSharing()` is called first by the profile screen and by `endSession`, because Home is alive behind the screens above it until the session is cleared; a sign-out that fails leaves the technician signed in and starts it again).
  It starts again when the app comes back to the front, and after "Actualiser ma position" (or the switch) has been allowed.
  A 401 is a failure like another: the session is renewed by the call itself, a renewal that failed for want of network is tried again at the next beat, and a session that is really over unmounts Home.
- It **never asks for the permission** (going online and the button do) and never overlaps itself: a start that comes while a reading of an earlier run is still going waits for it. A try that fails is followed by the next one thirty seconds later;
  after **two** in a row that sent nothing (network down, location services off) the card says so instead of "partagée". A reading of the GPS that does not come back is given up after 20 seconds.
  A position sent by the button or the switch less than ten seconds before a planned reading delays that reading to thirty seconds counted from it; sent earlier than that, it changes nothing.
  The next try after a reading was given up waits for the same request to the phone (one pending request, not one more every thirty seconds) for up to two minutes, after which the request is forgotten and asked again; the answer of a request that comes after its try was given up is dropped as old.
  A try that is stopped while the phone is still reading (sign-out, the app going to the background) sends nothing when the reading arrives.
  A reading that comes back after its try gave up (a slow first fix, 21 to 49 seconds) is kept for the next try for 45 seconds and used once, so that a phone whose GPS is slow still sends about every other try instead of never; it is not kept across a stop, nor after a position went out another way.
  An unattended reading never shows the system dialog about the settings of the phone (`mayShowUserSettingsDialog: false`).
- It sends the place and, when the GPS gives real values, the accuracy, the speed and the heading (a speed of 0 with a heading of 0 is "not known" on Android and neither is sent; a heading is not sent with a speed of 0). Nothing else the phone knows is sent.
- **What the mission screen knows is told to Home** through a small in-memory store (`services/road-state.ts`, read by Home with `useSyncExternalStore`): Home does not refresh while the mission screen is in front. A technician who is offline, is given a job and sets out from the notification
  is shared at once; a job completed or given back on the mission screen stops the sharing at once, even if Home's list (opened from another tab) still says "at work". What the mission screen told wins over Home's list for that job until Home reads its list again;
  a list asked for after the mission screen spoke takes over, a list asked for before does not (it is compared with the moment the list was *asked for*).
- Signing out (`endSession`) stops the sharing first and forgets every job told in that session; the next session begins with the Home screen (`beginSession`). The screens stacked above Home are cleared before the login is shown.
- A technician with a screen reader hears the sentence of the card when it turns into a problem (location refused, not allowed yet, or tries failing), once per change and after the state has stood for 0.6 seconds (`AccessibilityInfo.announceForAccessibility`; the live region of a Text is Android only). This was not heard on a device.
- Home keeps only the newest list of missions: an answer asked for before the one already drawn (a slow network) is dropped. The switch and the refresh button do nothing once a sign-out has begun.
- Known limits: a job cancelled by the dispatcher while an offline technician stays on another tab keeps the position going out until Home is shown or pulled again (the mission screen tells Home only what it sees itself); a request that was already being retried by the session renewal at the moment of a sign-out can still reach the server once.
- The card tells the technician that the position is **recorded for a few days during a job and can be read by the support in a dispute** (`app.availability.sharing`); the wording is a business decision and a native reader should look at the Arabic.
- **Not done: background tracking.** A phone with the app closed is silent, and is flagged after the limit. Reading the position in the background needs the "always" permission, a task registered with `expo-task-manager`,
  a new native build and the stores' approval of the reason; it is an owner decision. The wording of the permission request (`app.json`) and the privacy notice for technicians are a business decision too.
