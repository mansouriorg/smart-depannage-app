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
