# More than Measured v0.7.0

Initial local-first PWA foundation.

## Included
- Installable/offline app shell
- IndexedDB local storage
- Child profiles
- Starter achievement entry
- Full local backup export
- Validated restore preview
- Replace or merge restore
- Five automatic safety checkpoints
- Versioned backup/schema metadata
- Future section placeholders

## GitHub Pages
Upload the contents of this folder to the repository root, then enable GitHub Pages from the main branch/root folder.

## v0.1.1 changes
- Achievements can now be opened and viewed
- Weekly encouragement opens in a caregiver message popup
- Unfinished feature cards now show an under-construction popup

## v0.1.2 changes
- Caregiver Corner’s Encouragement card now opens the functional weekly message
- Reflection and Support messaging continue to show the under-construction popup
- Updated the app and offline cache versions so installed copies receive the fix

## v0.1.3 changes
- Replaced the original homepage hero and card grid with the illustrated Free to Be Me homepage
- Added responsive clickable areas for all eight illustrated categories
- Growth Journey, Caregiver Corner, and Community Village open their matching app sections
- Unfinished illustrated categories open the standard under-construction popup
- Included the homepage artwork in the offline app cache

## v0.1.4 changes
- Fixed installed Safari/PWA copies remaining stuck on an older cached version
- Added versioned JavaScript and stylesheet URLs for dependable updates
- Added an immediate service-worker update check and one-time refresh when a new build takes control
- Changed page navigation to network-first with the cached homepage retained as the offline fallback
- Old Free to Be Me caches are removed automatically after an update

## v0.1.5 changes
- Replaced the square homepage artwork with the portrait two-row design
- Remapped all eight illustrated category buttons to the new icon positions
- Removed the separate encouragement, statistics, and bottom navigation from the homepage
- Kept the hamburger menu as the complete navigation fallback
- Updated the app and offline cache versions

## v0.1.6 changes
- Locked the homepage to the visible screen with no page scrolling
- Extended the illustrated homepage behind the top controls to eliminate the white header bar
- Made the Free to Be Me header badge a Home button
- Preserved the standard header and scrolling behavior on internal pages
- Updated the app and offline cache versions

## v0.1.7 changes
- Fixed the installed app failing to open without cellular service or Wi-Fi
- Changed app navigation to load the cached app shell immediately when available
- Added quiet background refreshes whenever a connection is available
- Strengthened first-install caching for every critical offline file
- Preserved automatic removal of obsolete version caches

## v0.2.0 changes
- Added a complete child vocabulary tracker
- Added single word or phrase entry with the original first-said date and optional notes
- Added bulk paste/import from Notes with parse-and-review before saving
- Recognizes common date-first, word-first, dated-heading, tab, comma, dash, and plain-line formats
- Skips duplicate words safely and creates a safety checkpoint before every bulk import
- Added alphabetical, newest-first, and oldest-first sorting
- Added live word and phrase search
- Added filters for child, year, month, and exact first-said date
- Added vocabulary editing and confirmed deletion
- Connected Communication Support, My Child, and the hamburger menu to Vocabulary

## v0.2.1 changes
- Renamed the app from Free to Be Me to More than Measured
- Replaced the full-screen homepage artwork with the new branded version
- Updated the top Home badge, drawer, page title, install manifest, About page, backup filenames, and offline messaging
- Preserved the existing database name and backup format so all profiles, achievements, vocabulary, and older backups remain compatible
- Updated the app and offline cache versions

## v0.2.2 changes
- Replaced the text-and-rainbow Home badge with the new clickable MtM logo
- Created new 192px and 512px install icons from the supplied MtM artwork
- Changed the browser icon and Apple touch icon to the new branding
- Removed the previous SVG icon from active browser and manifest references
- Included the full-resolution MtM logo source in the project assets
- Updated the app and offline cache versions

## v0.2.3 changes
- Replaced the homepage artwork with the updated family-and-village illustration
- Updated the illustrated navigation labels to Speech/Language Building, Skill Building, Health and Wellness, and ASD Friendly Fun
- Kept Speech/Language Building connected to the functional Vocabulary tracker
- Kept ASD Friendly Fun connected to Explore
- Preserved the existing two-row hotspot alignment and all family data
- Updated the app and offline cache versions

## v0.3.0 changes
- Expanded Vocabulary into the Speech & Language tracker
- Added clear Edit and Delete controls to every word or phrase
- Added per-entry Speak, Identify, and ASL checkboxes that can be changed directly on each card
- Made every entry a compact expandable card; the closed view shows only the word or phrase and its date
- Added top-level totals for all entries, Speak, Identify, and ASL that update for the selected child
- Added assignable categories including Animals, Toys, Body Parts, Food & Drink, People, Actions, Places, Clothing, Vehicles, Social Words, and more
- Added custom category creation, renaming, and deletion with safe reassignment to Uncategorized
- Added category filtering and expanded search across words, notes, and category names
- Added category and ability choices to single-entry forms and bulk imports
- Safely upgrades existing vocabulary to Speak checked, Identify unchecked, ASL unchecked, and Uncategorized
- Creates a safety checkpoint before deleting a category or running a bulk import
- Preserved backup compatibility and updated the app/offline cache version

## v0.3.1 changes
- Added independent learned dates for Speak, Identify, and ASL
- Added Speak, Identify, and ASL result checkboxes, enabled by default
- Made year, month, and exact-date filters use only the abilities currently selected
- Added undated additional-language translations to each entry
- Expanded search to language names and translated words or phrases
- Added inline ability-date editing inside expanded word cards
- Made bulk imports apply each parsed date to every selected imported ability
- Safely migrates older first-said dates to Speak dates without inventing unknown Identify or ASL history
- Preserved the original database and backup compatibility and updated the offline cache version

## v0.3.2 changes
- Added Category as a sorting option
- Category sorting displays bold alphabetical category headings
- Entries within each category sort by newest first-said date, then alphabetically
- Added optional secondary and tertiary categories to individual entries and bulk imports
- Words assigned to several categories appear beneath every associated heading without increasing totals
- Category filters now match primary, secondary, or tertiary assignments
- Expanded category search and category chips to include every assignment
- Updated category rename and deletion to safely handle every assignment
- Preserved existing single-category entries, backups, and offline compatibility

## v0.4.0 changes
- Added fully customizable Speech & Language filter defaults in Settings
- Clear filters now returns to the caregiver’s saved defaults
- Added an expanded profile-symbol library with balls, robots, bubbles, vehicles, balloons, animals, and more
- Added optional child profile-photo uploads with automatic resizing for local storage and backups
- Added profile editing so symbols, photos, birth details, and names can be updated
- Added optional birth hour, minute, and second while preserving blank/unspecified birth times
- Added profile-card display choices for birth date, whole-year age, years and months, live exact age, or no detail
- Added a live age counter down to seconds when selected
- Requires a complete birth hour, minute, and second before live exact age can be selected
- Keeps expanded speech cards open after ability or learned-date changes
- Preserved all existing profiles and complete backup compatibility

## v0.5.0 changes
- Added sentences as a dedicated Speech & Language entry type and protected category
- Added a separate total sentence count without increasing Total Words
- Automatically checks every word in a saved sentence against the child’s individual word list
- Automatically adds genuinely missing individual words with the sentence’s first-said date and Speak enabled
- Adds automatically discovered words to Uncategorized for later organization
- Avoids adding or counting duplicate words when every sentence word is already known
- Added Words and sentences, Words only, and Sentences only filtering
- Included entry type in customizable filter defaults
- Search results include sentences containing the searched individual word unless Words only is selected
- Added sentence editing, deletion, first-said dates, and notes
- Preserved existing phrases as word entries and maintained backup compatibility

## v0.6.0 changes
- Speech & Language filters now remain active for the full app session after editing or saving entries
- Clear Filters still returns to the caregiver’s saved filter defaults
- Added a searchable plain-language guide to common autism, communication, regulation, and sensory terms
- Added explanations for stimming, masking, echolalia, meltdowns, shutdowns, support levels, sensory seeking and avoiding, AAC, interoception, proprioception, vestibular processing, and more
- Added a monthly Caregiver Calendar with doctor, therapy, play-date, school, evaluation, family, and custom appointments
- Added optional child, time, location, and notes fields to appointments
- Added appointment editing and protected deletion
- Added a persistent Caregiver To-do List with optional due dates and child assignments
- Added Active, All, and Completed task views plus editing, completion, reopening, and protected deletion
- Added appointments and to-do items to complete backups, restores, and safety checkpoints
- Upgraded the local database safely without changing its established identity

## v0.6.1 changes
- Added letters and numbers as dedicated Speech & Language entry types
- Added separate total letter and total number counts without increasing Total Words
- Added quick Add letter and Add number actions plus entry-type filters
- Updated the Speech & Language introduction to include all communication, including ASL
- Preserved existing entries, backups, and the established local database

## v0.6.2 changes
- Added a dedicated Speech & Language Building landing page
- Moved the existing tracker into a clickable Communication Tracker card
- Updated homepage and drawer navigation to open Speech & Language Building first
- Renamed the tracker page heading to Communication Tracker
- Preserved all existing communication entries, filters, and backups

## v0.6.3 changes
- Added seven new Speech & Language Building cards for future ASL, AAC, flash card, app, and product resources
- Connected every unfinished card to the standard under-construction popup
- Kept Communication Tracker fully functional

## v0.6.4 changes
- Expanded bulk import to support words, phrases, letters, numbers, and sentences
- Added an entry-type selector and category choices to the bulk importer
- Places letters, numbers, and sentences in their protected categories automatically
- Validates single-letter and numeric imports and reports invalid lines during review
- Bulk sentence imports add genuinely missing individual words just like single sentence entry

## v0.6.5 changes
- Added complete A–Z and 0–100 ability pickers, plus custom numbers beyond 100
- Added column-level Add all controls and separate optional Say, Identify, and ASL dates
- Reworked totals into per-type rows for Words, Sentences, Letters, and Numbers
- Added Say and ASL tracking with independent dates for sentences and bulk sentence imports
- Kept Identify unavailable for sentences while retaining it for all other entry types
- Preserved existing entries and complete backup compatibility

## v0.6.6 changes
- Removed horizontal scrolling from the letter and number pickers
- Kept Letter/Number, Say, Identify, and ASL checkboxes visible together on phones
- Hid the large optional date fields until the related ability is selected
- Displayed selected ability dates in a compact expandable area beneath that entry
- Preserved all v0.6.5 data and behavior

## v0.6.7 changes
- Fixed words with no active ability being hidden when all ability filters are selected
- Search can now reveal an untracked word so its Say, Identify, or ASL status can be corrected
- Unchecking an ability now clears its learned date to prevent contradictory records
- Preserved the compact letter and number picker introduced in v0.6.6

## v0.6.8 changes
- Added a New word detected review before sentence words are automatically added, including bulk sentence imports
- Defaults each detected word to the sentence date
- Allows a different first-said date to be chosen for each detected word
- Restored responsive Speak, Identify, and ASL result filtering
- Keeps directly searched ability-less records visible so they can be corrected
- Clears learned dates whenever an ability is unchecked in cards or edit forms

## v0.7.0 changes
- Opened Skill Building as a functional section from the illustrated homepage and drawer
- Added a Potty Training Tracker with one editable record per child and day
- Tracks pees in the potty, poops in the potty, accidents, and optional notes
- Added recent-day history, editing, protected deletion, and seven-day totals
- Added a Potty Training Tips & Tricks guide with gentle routines, visual supports, communication, sensory, clothing, accident, pattern, and health guidance
- Included every potty-training record in complete backups, restores, and safety checkpoints
- Safely upgraded the established local database without changing its identity
