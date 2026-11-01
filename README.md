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

## Actions kept until there is a signal (P3-06)

A technician who sets off, arrives, starts and closes a job in a basement with no signal loses nothing. The phone keeps the three steps of the road (**en route, arrivé, commencer**) and the **photo that closes the job**, and sends them in order when the connection comes back (`services/offline-queue.ts`, wired in `services/offline.ts`, files in `services/offline-store.ts`).

- **One more dependency to install:** the queue writes its file and the photos with `expo-file-system`. Run `npx expo install expo-file-system` in this folder (it picks the version for SDK 54 and updates `package.json` and the lock file; this was not done here because the package registry could not be reached). The code imports `expo-file-system/legacy`, the interface of SDK 54 that keeps the five calls used here (`getInfoAsync`, `makeDirectoryAsync`, `copyAsync`/`moveAsync`, `readAsStringAsync`/`writeAsStringAsync`, `deleteAsync`, `readDirectoryAsync`). **It was not run on a phone**: only the rules of the queue were run, with the phone's file system, clock and server replaced by fakes (the tests are not in this repository).
- **Every action goes through the queue**, with or without a signal: it is written to the phone (`documentDirectory/offline-queue/queue.json`, the photo is copied next to it because the camera's own file lives in a cache the system may empty), and only then sent. A phone with a signal sees no difference. Nothing is sent before it is on the phone.
- **What is not kept:** accepting a job and handing it back. They need the server's answer on the spot (another technician may have taken the job; the dispatcher must look for another one now), so they fail with their usual message when there is no signal. Handing a job back is hidden while the phone still holds actions for it.
- **What the technician sees:** the screen moves on as if the step had been made ("arrivé" → "Commencer les travaux"), with a line saying the customer is not told yet; the mission card in the lists carries "En attente d'envoi"; a banner on Home, Missions and the mission screen (inside the scroll or the list there, so it never pushes the buttons off a small screen) counts the actions that wait, says they leave by themselves while the app is on the screen, and has **Envoyer maintenant**; it shows the two newest problems, "Et N autres messages non lus" and **Tout marquer comme lu** when there are more, and it is read out by the screen reader when a new problem comes. **An action that is only on its way is not "waiting"**: the banner, the badge and the line under the status appear for an action that could not go at its first try (or was put off with the others by a failure), not for the second that a normal send takes, so a phone with a signal shows nothing. A photo that waits is shown as waiting: the job is **not** shown as finished until it has gone. A completion made without a signal says so ("Enregistré sur le téléphone"). When an action leaves later, Home and Missions read their list again (a moment after the last one of a burst) and the mission screen applies the server's answer, so nothing has to be pulled down to refresh. A job opened again without a signal shows the last copy read with a signal in this run of the app (not kept across a restart), so a technician who pressed "arrivé" offline (or with a server that answers badly: a gateway error, a timeout) and went back to the list can still press "commencer" or take the photo; the screen says "Dernière copie lue" while it shows that copy, and the timeline follows the status shown. A pull-to-refresh keeps what is drawn and says that it failed.
- **When it sends:** right away, when the app comes back to the front and each time a screen with the banner comes into view (both without waiting for the planned time), when "Envoyer maintenant" is pressed, and on its own timer while the app is open: 30 s, 1 min, 2 min, then every 5 minutes. One send at a time, in the order the actions were made, **the short calls before the photos** of a run (a job's own photo is always its last action, so nothing changes inside a job). The tap that made an action is answered when that action is sent, refused or put off, and at the latest after 15 seconds ("Enregistré sur le téléphone"): a step pressed while the photo of another job is being uploaded (one lane: up to 90 seconds on a weak link) goes right after that upload. No network (no answer, a timeout, a session that could not be renewed, "too many requests") stops the whole run; a server error (5xx) only holds back that job. There is **no listener on the network state** (that package is not in the app): the timer finds the connection again within five minutes, or the technician presses the button. **It does not send when the app is closed or in the background.**
- **The time is the time it was done:** each call carries `X-Queued-For`, the seconds the phone held the action (counted on the phone's own clock, so a wrong clock does not matter). The server dates the step when it was done and does not take a late photo for one with a wrong clock (see the server's README, "Actions the phone kept until it had a signal"). The upload time of a large photo is counted as part of the wait: a step or a photo can be dated up to the length of its own upload (at most 90 seconds) later than it was made.
- **Answers that settle an action:** a refusal (400, 403, 404...) drops the action and what came after it for that job, and the technician is told why in the banner (a photo refused for being too far from the address is told on the spot with "Reprendre la photo"). A **409** is looked at: the phone reads the job, and if the server already has the step (the answer of the first try was lost) it counts as sent; otherwise it is a refusal with the server's sentence. An action more than **7 days** old is dropped and said so. A photo that is no longer on the phone is dropped and the technician is told to retake it.
- **Kept photos are named, not addressed:** the file holds `photos/<id>.jpg`, never a full path, because the system may give an updated app another folder; the address is rebuilt each time it is read. A file that is found with only its temporary copy (the phone stopped between removing the old file and moving the new one) is put in place when it is read, and before the next write (so that a write that dies half way cannot destroy both copies).
- **Whose actions:** each action carries the user number of the session that made it (read from the token; it is only a label, nothing is trusted from it). The session is checked again before every send (a keychain that cannot be read for a moment, a locked phone, is not taken for a sign-out: nothing is sent, the action waits for its next try without being charged a try, and the banner stays; a queue that was never told whose session is open, because the keychain failed at the start of the app, asks again each time it runs): after a sign-out and another technician's sign-in on the same phone, the first one's actions are **not** sent in the second one's name and are not shown to them; they wait for their owner. Signing out with actions that wait asks first ("Actions non envoyées": they stay on this phone and go at the next sign-in).
- **When the file is damaged** it is put aside (`unreadable-*.json` in the same folder) and the technician is told to check their missions; entries that cannot be read are dropped, the others kept. The kept photos are not swept in the same start (they may be the proof of jobs the file named); the next start sweeps those that no action names. A temporary file that is not even JSON, with no file beside it, is treated as a damaged file (set aside, noticed, photos left alone): it may be all that is left of a write that was to replace a file full of actions, and the notice after a very first write that was cut short is the price of never losing actions silently. A write of the same run that finds such a file removes it instead of putting it in place (the queue in memory holds more). **When the file cannot be read at all** (an error of the phone, not a damaged file: a locked phone, a busy disk) nothing is set aside and nothing is written over it: no action can be made until the next call has read it (the app coming to the front, a banner screen, the next tap); the banner says so with **Réessayer**, and the tap says that the list could not be read (not that the memory is full). **When the phone cannot write** (no space), the action is not made and the technician is told; a photo is deleted only once the file no longer names it (also when an action could not be kept: its photo goes only after the write that takes the action out of the file went through).
- Known limits: nothing leaves while the app is closed (background sending would need a background task and a new native build); the timeline line and the notifications to the customer and the team carry the time the action **arrived**, only the recorded dates of the steps and the photo are the true ones; a job cancelled by someone else while the technician was offline makes their kept steps refuse (told in the banner), whereas a job already finished makes a kept step or photo count as sent without a message; the actions of a technician who never signs in again stay on that phone; the answer of a step that leaves later is applied by the mission screen only when the job is already drawn (otherwise the next read brings it); the time of the next try is written with the phone's clock, so a clock corrected backwards counts a wait longer than five minutes as over (a wait never exceeds five minutes), and the true wait is the one of the timer; the session is read just before each send and again by the request, two reads that a sign-out and a sign-in made within a few milliseconds of each other could separate (the action would then go out under the new session and be refused or applied there), and a keychain that fails between the two reads sends the request without its token, which the server answers with a 401 (the renewal reads the refresh token the same way, and ends the session if it cannot: this is how every request of the app has behaved since P0-15, and it is also what takes a technician whose keychain is damaged for good back to the sign-in screen, so it was left as it is); a refusal that takes later actions of the same job with it shows each of them with the server's sentence for the first; a job that the customer disputes between a lost answer and the retry of its closing photo is not counted as done by the phone, which tells the server's sentence; the server stops a technician who has sent 30 photos for one job in an hour (429), and the phone then stops the whole run for a few minutes; one send lane: a step can wait behind another job's slow photo (at most 90 seconds), and the tap is answered "kept" after 15 seconds; the Arabic wording of the new messages should be read by a native speaker.

## A job offered to several technicians (P3-07)

The team can offer one open job to the best-matched technicians at once, each for a few minutes; the first to accept gets it and the others see it withdrawn (see the server's README, "A job offered to several technicians at once"). This is the phone's side: where the offer shows, how the countdown stays right, how a withdrawal arrives, and what the technician can do.

- **Where an offer shows:** a push "MISSION_OFFERED" (a tap opens the offer, `app/offer/[id].tsx`, not the mission screen, because the mission screen sends a technician away from a job that is not theirs yet) and a **Missions proposées** block at the top of Home (`components/OfferCard.tsx`): the trade, the address, the distance, the time left, **Accepter** and **Voir la proposition**. The offer screen (a tap on the card or on the push) has the whole offer, **Accepter** and **Refuser** (the refusal asks for a reason, like handing a job back, and stays open with the reason and the note if it could not be recorded). Below the open offers, the ones that ended without the technician getting the job and are less than two hours old (ran out, taken by another technician, taken back by the team, job cancelled; at most three) are told in one line each, so that "another technician was faster" is read, not just a missing card. An offer the technician accepted or refused themselves is not told back.
- **The countdown is right on a wrong clock:** each answer of `GET /artisans/me/offers` carries the server's time; the phone keeps the difference between that and its own clock at the middle of the trip (`clockOffset`, bounded to a day) and counts down with it (`msLeft`); after a round trip longer than 5 seconds (a slow link, a sign-in renewed on the way) the offset already known is kept, because the middle of a long trip is a poor guess. An offer whose time has run out on that clock is drawn as expired at once, without waiting for the next read; the server judges the accept anyway.
- **A withdrawal arrives by reading, not by a live connection** (the phone has no socket): while Home or the offer screen is in front **and the app is open**, the list is read again every **15 s** when an offer is open and every **30 s** otherwise (`services/offers-feed.ts`; it stops with the screen, with no request and no timer left), and at once when an offer push arrives while the screen is open (`services/use-offers.ts`). The newest answer wins (an older one that comes back later is dropped, and so is any answer that comes after the screen was left). A read that fails keeps the offers already read and says so (the line "Les missions proposées n’ont pas pu être chargées." on Home, whether or not an earlier read worked), and is tried again at the same pace; **before any read has worked it is tried again every 15 s**, not at the pace of an empty list. A technician whose profile is not approved is refused by the server (403): that is read as "no offers", not as a failure (Home already tells them their profile is under review). Pulling Home down reads the offers again with the missions.
- **What the technician answers on the phone is hidden at once:** an offer accepted, refused or told as gone is not drawn as open on any screen until a list asked for after the answer has been read (`services/offer-answers.ts`, in memory), so that a technician who refuses on the offer screen and goes back does not see the same card with a live Accepter. The screens subscribe to the answers (`useSyncExternalStore`), so a screen that is already drawn, behind the one where the answer was made, draws again at once.
- **Accept and refuse go straight to the server and are never kept for later** (`services/offer-actions.ts`), like accepting a job: another technician may have taken it a second ago. A 409, 403 or 404 means the job is no longer there for this technician (the server's own sentence is shown, or "Cette mission n’est plus disponible." when it gave none, then the list is read again to say how it ended); anything else (no signal, a server in trouble) is a failure the technician can retry: a second accept of the same job is answered like the first. If the answer of an accept was lost on the way and the server had accepted it, the list read afterwards says so and the mission opens, with no "try again" told over it (the sentence of the failure is shown only when the list does not say the job is theirs). The button is free again as soon as the server has answered, before the list is read. After an accept, and after a refusal, the screen moves on (to the mission, or back) only if it is still the screen in front: a technician who went elsewhere while the answer was on its way is not sent from there.
- **Not run on a phone or with Expo.** What was run: the rules of the feed (the corrected clock, the pace, newest answer wins, a stop dropping the answers on their way, a failed read, an unreadable answer), the accept and refuse answers and the push route, with the clock, the timers and the server replaced by fakes (the tests are not in this repository, which has no test runner), the type check of the new files against the app's stubs, and `npm run check:i18n`. The new route `/offer/<id>` is opened with `as Href` because the typed routes are generated when Expo starts.
- Known limits: nothing is read while the app is closed or in the background (the push is what tells a technician with the app closed); a technician with the app open on another screen than Home or the offer sees the offer by its push, not by the list; a withdrawal is known within 15 seconds (the server sends the phone no push for it, only a live event that the phone does not listen to); a phone whose date is wrong by more than a day (its secure connection would fail first) is shown the countdown with the offset cut to a day; accept and refuse need a signal; an accept whose answer was not heard keeps the button busy while the list is read once more (up to 15 s more), and if the technician leaves the screen during that read, the read is dropped and the "try again" sentence is told even if the server had accepted (a second accept is answered like the first and opens the mission); a push about an offer whose screen is already open opens a second copy of that screen on top of the first (the push route opens screens with `push`, as it does for the missions, and is shared with the other pushes); the Arabic wording of the new messages should be read by a native speaker.
