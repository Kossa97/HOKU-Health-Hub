import type { FaqCategory } from '../types'

/** English FAQ */
export const enCategories: FaqCategory[] = [
  {
    id: 'start',
    title: 'Getting started & navigation',
    items: [
      {
        q: 'What is HOKU: Health Hub?',
        a: 'HOKU: Health Hub is a private documentation app for peptides, cycles, doses, stock, injection sites, bloodwork, effects, and reports. It does not replace medical advice and is intended for research, structure, and personal documentation.',
      },
      {
        q: 'How is the app organized?',
        a: [
          'The main areas are available from the bottom navigation and the Home screen:',
          '- Home: overview, quick actions, and feature tiles',
          '- Calendar: planned and logged doses',
          '- My Stack: substances, vials, cycles, and dose adjustments',
          '- Profile: account, language, theme, sharing, and notifications',
        ],
      },
      {
        q: 'What does the Home screen do?',
        a: [
          'Home is the control center of the app.',
          '- Status cards show active cycles, logs, stock, and other key signals',
          '- Quick actions jump into logging, calculator, progress, or simulation',
          '- Feature tiles open Calendar, My Stack, Calculator, Injections, Protocol, Lab, Bloodwork, Health, Journal, Experiences, FAQ, and Profile',
        ],
      },
      {
        q: 'What do the quick actions on Home mean?',
        a: [
          'Quick actions open common daily workflows:',
          '- Log today: opens the calendar for dose logging and confirmation',
          '- Log injection: opens injection-site rotation',
          '- Calculate dose: opens the calculator',
          '- Progress: opens weight, photos, and trend tracking',
          '- Blood level: opens the PK simulation',
        ],
      },
      {
        q: 'How do I search for features or entries?',
        a: 'Many sections have their own search. In My Stack, tap the magnifying glass, enter a name, and close the search with X. The FAQ search checks both questions and answers.',
      },
      {
        q: 'Can I install the app on my phone like a native app?',
        a: [
          'Yes. The app can be used as a PWA.',
          '- iPhone/Safari: Share icon, then Add to Home Screen',
          '- Android/Chrome: three-dot menu, then Install app or Add to Home screen',
          '- After that, it opens without the browser bar and feels closer to a native app',
        ],
      },
      {
        q: 'What is the best way to start?',
        a: [
          'Recommended flow:',
          '1. Create a new substance in My Stack',
          '2. Create a cycle immediately, or add one later with New/Add cycle',
          '3. Optionally verify the dose in Calculator',
          '4. Log and confirm doses in Calendar',
          '5. Add extra context through Injections, Journal, Bloodwork, and Protocol',
        ],
      },
      {
        q: 'Why does the app often say "Not a medical device"?',
        a: 'Because the app documents and calculates data, but it does not diagnose, prescribe, recommend dosing, or make treatment decisions. Substance, dose, route, and frequency remain your responsibility and may require qualified guidance.',
      },
    ],
  },
  {
    id: 'peptide',
    title: 'My Stack, vials & substances',
    items: [
      {
        q: 'What is My Stack?',
        a: 'My Stack is where you manage your substances. It includes vials, reconstitution, shelf life, active cycles, dose adjustments, notes, batch data, and analysis documents.',
      },
      {
        q: 'What is the difference between Vials view and List view?',
        a: [
          'Vials view is the visual mobile-first view.',
          '- Vials: large carousel with active vial, shelf life, actions, info, and active cycle',
          '- List: compact cards with multiple substances shown vertically',
          '- Switch views from the filter/view button in the top right',
        ],
      },
      {
        q: 'How do I control the vial carousel?',
        a: [
          'You can move through it in several ways:',
          '- Mobile: swipe horizontally or tap a vial',
          '- Desktop: drag with the mouse',
          '- Desktop: scroll down with the mouse wheel to move left through the carousel',
          '- Left and right arrow buttons move to the previous or next vial',
        ],
      },
      {
        q: 'What does the percentage under the active vial mean?',
        a: 'It shows the calculated fill level of the current vial. Full vials show 100%; partial vials show the remaining fraction.',
      },
      {
        q: 'What do "Shelf life", "Active", and "x / y" mean at the top?',
        a: [
          '- Shelf life: remaining days until calculated expiry, or Not set',
          '- Active: at least one active cycle exists for this substance',
          '- x / y: current position in the carousel',
        ],
      },
      {
        q: 'What does the "Recon." button do?',
        a: 'Recon. opens the reconstitution dialog. When confirmed, the reconstitution date and stock state can be updated for the connected substance. If no inventory item is linked, the button is disabled.',
      },
      {
        q: 'What does "Edit" do?',
        a: 'Edit opens the substance form. You can change name, color, active per vial, liquid, reconstitution date, shelf life, vials, route, batch, source, document, and notes.',
      },
      {
        q: 'What does "Delete" do?',
        a: 'Delete removes the substance after confirmation. Use it only when you no longer need that substance in your stack.',
      },
      {
        q: 'What is inside the collapsible "Info" row?',
        a: [
          'Info starts collapsed and expands into compact substance details:',
          '- peptide name',
          '- active ingredient per vial',
          '- added liquid',
          '- reconstitution date',
          '- shelf life',
          '- raw vials in reserve',
          '- route',
          '- batch, source, analysis document, and notes',
        ],
      },
      {
        q: 'Why are color and fill level not listed in Info?',
        a: 'Color and fill level are already visible directly on the vial. The Info row focuses on details that are not obvious at a glance.',
      },
      {
        q: 'How do I create a new substance?',
        a: [
          'Tap the Add Vial tile or New Substance in My Stack.',
          '- The form is organized as editable rows',
          '- Tapping a row opens the matching editor',
          '- On mobile, the active input area is placed closer to the center for easier thumb reach',
          '- Save creates the substance',
        ],
      },
      {
        q: 'Which fields belong to New Substance?',
        a: [
          'Important fields are:',
          '- peptide name',
          '- color',
          '- active ingredient per vial',
          '- added liquid',
          '- reconstitution date',
          '- shelf life after reconstitution',
          '- vials on hand',
          '- route',
          '- batch, source, analysis document, and notes',
        ],
      },
      {
        q: 'Why is there no standard dose on a substance anymore?',
        a: 'The app no longer uses a substance-level standard dose. The relevant dose always comes from the cycle and the active dose adjustment. This keeps each dosing phase explicit.',
      },
      {
        q: 'What happens after I save a new substance?',
        a: 'After saving, the app can ask whether you want to create a cycle for that substance right away. Choose Create cycle or Later.',
      },
      {
        q: 'What is the Add Vial tile in the carousel?',
        a: 'The Add Vial tile is the fastest entry point for creating a new substance. It sits inside the vial carousel like its own slot and opens the New Substance form.',
      },
    ],
  },
  {
    id: 'zyklen',
    title: 'Cycles & active dose',
    items: [
      {
        q: 'What is a cycle?',
        a: 'A cycle is a structured intake or documentation plan for a substance. It stores name, dose, unit, route, frequency, start date, optional end date, intake times, and reminders.',
      },
      {
        q: 'How do I create a cycle?',
        a: [
          'You can create a cycle from several places:',
          '- immediately after saving a new substance with Create cycle',
          '- in Vials view with New or Add cycle inside Active cycle',
          '- in List view with Add cycle on the substance card',
        ],
      },
      {
        q: 'Can I have multiple active cycles for the same substance?',
        a: 'Yes. The previous restriction was removed. You can add another cycle even when one is already active. All active cycles can appear in the calendar.',
      },
      {
        q: 'What does the "Active cycle" panel show in Vials view?',
        a: [
          'It summarizes the most important current cycle data:',
          '- cycle name',
          '- cycle day as x / total days or x / open end',
          '- current dose',
          '- frequency including Morning/Noon/Evening if selected',
          '- route',
          '- reminder',
          '- progress bar when an end date exists',
        ],
      },
      {
        q: 'What does "day x / open end" mean?',
        a: 'The first number is the current day since cycle start. Open end means the cycle has no end date. With an end date, it looks like 17 / 42.',
      },
      {
        q: 'How is the current dose calculated?',
        a: 'The current dose comes from the active cycle. If a dose adjustment is active today, the defined target dose applies. An old substance-level standard dose is no longer used.',
      },
      {
        q: 'What does "Frequency" mean in the active cycle panel?',
        a: 'Frequency combines the schedule rhythm and, if selected, the intake time. Example: Daily · Morning · Noon · Evening or Mon, Wed, Fri · Evening.',
      },
      {
        q: 'Which frequency options can I choose?',
        a: [
          'Available options include:',
          '- Daily',
          '- Every other day',
          '- 5 days on / 2 off',
          '- Mon-Fri',
          '- Weekly',
          '- Every X days',
          '- Pick weekdays',
        ],
      },
      {
        q: 'What does 1x, 2x, or 3x daily mean?',
        a: 'It defines how many intake slots are planned per day. For each slot you can choose morning, noon, evening, or a custom time.',
      },
      {
        q: 'What does the "Log dose" button do?',
        a: 'Log dose takes you to the calendar. There you can save the planned dose for the day and mark it as taken or not taken.',
      },
      {
        q: 'What happens if I edit a cycle and change the schedule?',
        a: 'When you change schedule-relevant values, the app asks whether the change should apply from today onward or retroactively to the whole cycle.',
      },
      {
        q: 'What does Active/Inactive mean on a cycle?',
        a: 'Active means the cycle is considered in the calendar and planning. Inactive pauses it without deleting it.',
      },
    ],
  },
  {
    id: 'escalation',
    title: 'Dose adjustments',
    items: [
      {
        q: 'What is a dose adjustment?',
        a: 'A dose adjustment is a planned target dose within a cycle. It can increase, reduce, or set the dose to a specific value.',
      },
      {
        q: 'How do I add a dose adjustment?',
        a: [
          'In the active cycle panel or expanded cycle list:',
          '1. Open Dose adjustments',
          '2. Tap Add dose adjustment',
          '3. Enter the new target dose and unit',
          '4. Choose when it starts',
          '5. Optionally add a note and save',
        ],
      },
      {
        q: 'Which start options are available?',
        a: [
          'You can choose:',
          '- fixed date',
          '- after X days from cycle start',
          '- after X weeks from cycle start',
        ],
      },
      {
        q: 'What does the timeline with dots on the left mean?',
        a: [
          'The timeline shows the base dose and planned dose adjustments in order.',
          '- The current dot marks the dose that applies now',
          '- Checked dots are already in the past',
          '- Clock icons are planned future steps',
        ],
      },
      {
        q: 'Why does "Base" appear in dose adjustments?',
        a: 'Base is the original cycle dose. It stays visible so you can compare the current dose with the starting point.',
      },
      {
        q: 'What does "Current" mean in the dose adjustment list?',
        a: 'Current marks the step that applies today. If no later adjustment is active, the base dose is marked current.',
      },
      {
        q: 'What does "No dose adjustments planned" mean?',
        a: 'This cycle only has its base dose. You can add a new step below with Add dose adjustment.',
      },
      {
        q: 'Can I have multiple dose adjustment steps?',
        a: 'Yes. Multiple steps are supported. The app sorts them by start point and calculates the dose that applies today.',
      },
      {
        q: 'Are dose adjustments considered in the calendar?',
        a: 'Yes. Calendar and day panels use the effective dose for each day. If an adjustment is active, the displayed dose is adjusted.',
      },
    ],
  },
  {
    id: 'kalender',
    title: 'Calendar & dose logging',
    items: [
      {
        q: 'What does the calendar show?',
        a: [
          'The calendar shows planned and logged intakes.',
          '- colored days for active cycles',
          '- markers for logs',
          '- today',
          '- indicators for active dose adjustments',
        ],
      },
      {
        q: 'How do I change months?',
        a: 'Use the left and right arrows in the month header, or swipe horizontally across the calendar.',
      },
      {
        q: 'How do I log a planned dose?',
        a: [
          '1. Select the correct day in Calendar',
          '2. Tap the planned cycle in the day section',
          '3. Review dose, route, and time',
          '4. Save',
          '5. Optionally mark it taken or not taken',
        ],
      },
      {
        q: 'What is the difference between logging and confirming?',
        a: 'Logging creates the dose entry. Confirming marks whether it was actually taken. This helps the app show adherence and reports more accurately.',
      },
      {
        q: 'What happens when I tap "Taken"?',
        a: 'The log is marked as taken and counted as completed in analytics.',
      },
      {
        q: 'What happens when I tap "Not taken"?',
        a: 'The log is marked as not taken. Snooze options can appear so you can be reminded again later.',
      },
      {
        q: 'What is snooze?',
        a: 'Snooze is a follow-up reminder for a dose marked not taken, such as after 15 minutes, 30 minutes, 1 hour, or 2 hours.',
      },
      {
        q: 'Why do I not see a planned cycle in the calendar?',
        a: [
          'Check these points:',
          '- the cycle is active',
          '- start and end date include the selected day',
          '- the frequency applies to that day',
          '- you are looking at the correct month',
        ],
      },
      {
        q: 'Does logging reduce my stock?',
        a: 'If the app can convert the dose into vial fractions, stock can be reduced accordingly. It needs active per vial, reconstituted liquid, and a compatible unit.',
      },
    ],
  },
  {
    id: 'erinnerung',
    title: 'Reminders, push & snooze',
    items: [
      {
        q: 'Which reminders can I choose in a cycle?',
        a: 'You can combine 1 day before, 2 hours before, and At intake. Multiple selections are supported.',
      },
      {
        q: 'Why do Morning, Noon, and Evening appear under Frequency?',
        a: 'When selected in the cycle, these intake times are shown directly in the active cycle card under Frequency. This makes the schedule visible at a glance.',
      },
      {
        q: 'What does "At intake" mean?',
        a: 'The reminder is due at the planned intake time. Without an intake time, the app cannot derive an exact time of day.',
      },
      {
        q: 'Do I need to allow notifications?',
        a: 'Yes. Real notifications require browser or system permission. Without permission, your data is still saved, but no notification is shown.',
      },
      {
        q: 'Why am I not receiving a push notification?',
        a: [
          'Possible reasons:',
          '- notifications are blocked in the browser or operating system',
          '- the PWA is not installed correctly',
          '- the reminder time is already in the past',
          '- the cycle is inactive',
          '- the push connection needs to be reconnected in Profile',
        ],
      },
      {
        q: 'What does "Reconnect" in Profile do?',
        a: 'Reconnect refreshes the push connection. Use it if notifications stop arriving after browser, iOS, or app changes.',
      },
      {
        q: 'What does "Send test" in Profile do?',
        a: 'Send test checks whether notifications arrive on the current device. On iPhone, the notification may only be visible when the app is closed or the device is locked.',
      },
    ],
  },
  {
    id: 'rechner',
    title: 'Calculator',
    items: [
      {
        q: 'What is the calculator for?',
        a: 'The calculator converts vial amount, added liquid, target dose, and syringe scale into the volume or units to draw.',
      },
      {
        q: 'Which inputs does the calculator need?',
        a: [
          '- syringe size and units',
          '- active ingredient per vial',
          '- reconstituted liquid',
          '- target dose and unit',
        ],
      },
      {
        q: 'Can I use saved substances in the calculator?',
        a: 'Yes. If a substance has active per vial and liquid saved, you can select it and automatically fill those values.',
      },
      {
        q: 'What does the large number in the calculator show?',
        a: 'It shows the calculated syringe units you would draw for the entered dose.',
      },
      {
        q: 'What do Concentration, Filled, and Per vial mean?',
        a: [
          '- Concentration: active ingredient per mL after reconstitution',
          '- Filled: how much of the syringe the calculated dose uses',
          '- Per vial: approximate number of doses from one vial',
        ],
      },
      {
        q: 'Why can the calculator not recommend a medical dose?',
        a: 'The calculator only converts your inputs. It does not decide which dose is appropriate, safe, or suitable.',
      },
    ],
  },
  {
    id: 'injections',
    title: 'Injections & rotation',
    items: [
      {
        q: 'What is the Injections section for?',
        a: 'The Injections section documents which body site you used and when. This helps rotate sites and avoid overusing the same area.',
      },
      {
        q: 'What do the colors on injection sites mean?',
        a: [
          '- Green: free or not used recently',
          '- Yellow: used recently, plan with caution',
          '- Red: used very recently, consider another site',
        ],
      },
      {
        q: 'What does "Recommended" mean?',
        a: 'The app recommends a site that has never been used or has not been used for the longest time.',
      },
      {
        q: 'How do I log an injection site?',
        a: 'Tap a site on the body diagram, optionally add notes, and save the entry.',
      },
      {
        q: 'Can I switch between front and back view?',
        a: 'Yes. The section supports front and back views so abdomen, thighs, deltoids, and glutes can be tracked separately.',
      },
      {
        q: 'Can I delete an injection log?',
        a: 'Yes. You can remove entries from the history if you logged the wrong site.',
      },
    ],
  },
  {
    id: 'inventory',
    title: 'Stock, inventory & reconstitution',
    items: [
      {
        q: 'What is the difference between Stock and My Stack?',
        a: 'Stock describes raw or available vials. My Stack describes substances you actively document, reconstitute, and connect with cycles.',
      },
      {
        q: 'What does "Raw vials in reserve" mean?',
        a: 'It is the inventory still kept as reserve. It appears in the Info row when the substance is linked to an inventory item.',
      },
      {
        q: 'What happens when I reconstitute?',
        a: 'Reconstitution documents that a vial was prepared. Date, shelf life, and stock can be updated from that action.',
      },
      {
        q: 'What does shelf life after reconstitution mean?',
        a: 'The app calculates expiry from reconstitution date plus shelf-life days. The display changes color depending on remaining time.',
      },
      {
        q: 'What happens if shelf life is not set?',
        a: 'The app shows Not set. No reliable countdown can be calculated.',
      },
      {
        q: 'What are batch, source, and analysis document for?',
        a: 'These fields document origin, lot, and evidence such as COA, lab report, or image. They appear in the Info row and detail sheet.',
      },
    ],
  },
  {
    id: 'reports',
    title: 'Protocol, progress, bloodwork & Health',
    items: [
      {
        q: 'What does Protocol do?',
        a: 'Protocol combines cycles, dose logs, weight, bloodwork, and adherence into analytics and can generate a PDF report.',
      },
      {
        q: 'What does "Generate PDF" mean?',
        a: 'The app creates a structured report for your documentation. Depending on available data, it can include period, active cycles, charts, bloodwork, weight, and adherence.',
      },
      {
        q: 'What is the share link in Protocol?',
        a: 'The share link copies a link or reference for the report or related view when the app has the required data.',
      },
      {
        q: 'What is Bloodwork for?',
        a: 'Bloodwork stores lab values with date, marker, value, unit, and notes. They can later appear in Protocol and charts.',
      },
      {
        q: 'What is Progress for?',
        a: 'Progress is intended for weight, photos, and trends. It helps document visible and measurable changes over time.',
      },
      {
        q: 'What does Health do?',
        a: 'Health is intended for health data and integrations. Availability and scope depend on device, platform, and permissions.',
      },
      {
        q: 'Why are some charts empty?',
        a: 'Charts need matching data in the selected period. If there are no logs, bloodwork, weight entries, or completed cycles, the analytics can be empty.',
      },
    ],
  },
  {
    id: 'tagebuch',
    title: 'Journal & effects',
    items: [
      {
        q: 'What is the Journal for?',
        a: 'Journal documents effects, side effects, intensity, timing, and progression. It helps identify patterns between substance, cycle, and effect.',
      },
      {
        q: 'What is the difference between an effect and a side effect?',
        a: 'An effect is a desired or observed outcome. A side effect is unwanted, unexpected, or notable in a negative way.',
      },
      {
        q: 'What does intensity mean?',
        a: 'Intensity describes how strong an effect felt. It is a subjective scale for later review.',
      },
      {
        q: 'Can I filter entries?',
        a: 'Yes. Depending on the active controls, you can filter or sort by type, peptide, text, date, or intensity.',
      },
      {
        q: 'Can Journal data appear in reports?',
        a: 'Yes. Journal data can be used in analytics and Protocol when matching entries are available.',
      },
    ],
  },
  {
    id: 'bewertungen',
    title: 'Experiences & research',
    items: [
      {
        q: 'What are Experiences for?',
        a: 'Experiences are personal, subjective notes on your cycles: how it went for you, with stars, effect, tolerability and text. They are not a recommendation and make no statement about the efficacy or safety of any substance.',
      },
      {
        q: 'Are experiences public?',
        a: 'No, not automatically. An entry is visible only if you share it individually — and only if your profile is public. Dose, cycle and exact dates never appear.',
      },
      {
        q: 'What is The Lab?',
        a: 'The Lab is the research section for studies, search results, and peptide information. It helps with lookup but does not replace expert interpretation.',
      },
      {
        q: 'What is the Library?',
        a: 'The Library is a structured peptide overview with detail pages. It acts as an in-app reference area.',
      },
      {
        q: 'Can I treat research content as a recommendation?',
        a: 'No. Study and library content is informational and must be interpreted professionally.',
      },
    ],
  },
  {
    id: 'profil',
    title: 'Profile, language, theme & sharing',
    items: [
      {
        q: 'What can I manage in Profile?',
        a: 'Profile contains account details, display name, username, language, theme, push status, public profile, and sharing permissions.',
      },
      {
        q: 'What is the username for?',
        a: 'The username is used for your public profile link. Without it, the app cannot create a clean share URL.',
      },
      {
        q: 'How does the public profile work?',
        a: [
          'First enable Share profile.',
          'Visitors then see only your name, bio and the experiences you share individually. Stack, calendar and journal stay private.',
          'Sections that are not enabled remain private.',
        ],
      },
      {
        q: 'Can I turn sharing off anytime?',
        a: 'Yes. Turn Share profile off and save. The public link will no longer show your shared profile data.',
      },
      {
        q: 'What does the copy button on the profile link do?',
        a: 'It copies your public link to the clipboard so you can share it.',
      },
      {
        q: 'How do I change language or theme?',
        a: 'Profile lets you change language and display mode. Depending on the app version, theme can use system, light, or dark mode.',
      },
      {
        q: 'How do I sign out?',
        a: 'Use the Sign out button in Profile. Your server-side data remains stored and is available again after the next login.',
      },
    ],
  },
  {
    id: 'technik',
    title: 'Technical, privacy & errors',
    items: [
      {
        q: 'Where is my data stored?',
        a: 'The app stores data in Supabase. Access is user-scoped so you only see your own data.',
      },
      {
        q: 'Is my data deleted if I remove the app from my phone?',
        a: 'No. The data is not only stored locally on the device; it is stored server-side. After signing in again, it is available.',
      },
      {
        q: 'Why do I see "Error saving"?',
        a: [
          'Common causes are:',
          '- required fields are missing',
          '- no internet connection',
          '- expired session',
          '- missing database table or storage configuration',
          '- blocked file or upload permission',
        ],
      },
      {
        q: 'Why can an upload fail?',
        a: 'Uploads need a stable connection and the correct storage bucket. If the bucket is not configured or the file is blocked, the upload can fail.',
      },
      {
        q: 'Why do I still see old data or an old design after an update?',
        a: 'Browsers and PWAs can cache old files. Reload the app, fully close it, or reinstall the PWA if a deployment is not visible yet.',
      },
      {
        q: 'What does it mean when a button is disabled?',
        a: 'A disabled button usually means required data is missing or the action is not possible for that item, such as Recon. without linked inventory.',
      },
      {
        q: 'Why can numbers look slightly rounded?',
        a: 'Fill level, doses, units, and reports are sometimes rounded to stay readable. For decisions, always check the saved raw values.',
      },
      {
        q: 'Can I use the app offline?',
        a: 'The PWA can cache parts of the app. Login, saving, uploads, sync, push, and fresh data still require a connection.',
      },
    ],
  },
]
