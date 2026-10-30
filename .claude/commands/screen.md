Build the screen "$ARGUMENTS" from its spec in design/screens.md as a live
page under apps/web/app/[locale]/ (no mockups: docs/engineering-standard.md
"Live pages only"). Use the kit from /styleguide, call the API through
lib/api.ts, and put the text in messages/km.json and en.json. Show the
structure (API, data, any database change) and plan first, and wait for my
OK. Mobile-first 360px.
When done, open it at 360px with the Demo Garage's data (pnpm demo:garage,
then "Sign in as Garage"), and list any problems (cut-off Khmer text,
buttons under 44px, overflow).
