# Seller test sheet (roadmap gate G2)

Use this to watch 3–5 real sellers try **the live app** — there are no
mockups any more (docs/engineering-standard.md "Live pages only"). The goal
is to find where a seller gets stuck — not to show them the app, and not to
collect compliments.

**Garage first** (docs/blueprint.md "Garage first"): sign-up is open to every
business, but they are tested one at a time, and the garage comes first, so
ask **garage owners** (repair shops, tyre and oil shops, car-parts sellers).
For an industry in beta, test it with its own sellers using this same sheet;
when they pass, its badge on the website moves from Beta to Available.

## Who to ask

Three to five garage owners or their counter staff who take orders by phone,
Facebook, TikTok or Telegram today. At least one who is not comfortable with
English, and at least one on a low-cost Android phone. Not friends who will
be polite.

## Before you go

1. On your laptop: `pnpm db:up` (or your installed PostgreSQL), then
   `pnpm demo:garage -- --reset` for a fresh Demo Garage, then `pnpm dev`
   and leave it running.
2. Get the app onto **their** phone — pick one:
   - **Same Wi-Fi or your phone's hotspot:** laptop and their phone on the
     same network; open `/dev/phone` on the laptop and scan its QR code
     (it shows the laptop's current address, e.g. `http://192.168.40.39:3000`).
   - **A public link:** `cloudflared tunnel --url http://localhost:3000`
     prints a temporary `https://…trycloudflare.com` address that works on
     any network. Send it to them on Telegram.
3. Open the link once yourself on a phone and sign in with **"Sign in as
   Garage"** to check it loads.
4. Print this sheet, one copy per seller, or keep it open on your laptop.

## What to say first, and what isn't real yet

Tell the seller, in your own words: *"This is a test version. No money
moves, and the shop is a made-up garage."* Then keep these in mind yourself:

| In the test | What to do during the test |
| --- | --- |
| On a laptop in development, login is the test button "Sign in as Garage", not Telegram | You sign in for them before task 2 |
| Task 1 (a new shop) needs the real Telegram login: the bot token, and the site on a public address set in BotFather | Until then, skip task 1 and start at task 2 in the Demo Garage |
| KHQR pays on a stand-in bank: the pay page has a test "Pay" button | Use **cash on delivery** for the buyer task. If they try KHQR, you tap the test button |
| Telegram alerts run in dry run until a bot token is set | Note whether they expected a message |
| The Demo Garage already has products, orders and customers | Tell them "this garage is yours for today" |

## The four tasks

Read the Khmer sentence aloud, give them the phone, then **stop talking**.
Do not point, do not explain a button. If they ask "what do I do?", answer
"what would you try?". Help only after a full minute stuck, and write down
that you helped.

| # | Say this | Start at | Finished when |
| --- | --- | --- | --- |
| 1 | «សូមបង្កើតហាងរបស់អ្នក។» (Please set up your shop.) | `/km/m/login` (real Telegram login only) | They reach the dashboard with their own shop name at the top |
| 2 | «សូមដាក់ទំនិញ ឬសេវាមួយដែលអ្នកលក់ពិតប្រាកដ ជាមួយរូបថត និងតម្លៃ។» (Add one product or service you really sell, with a photo and a price.) | The dashboard | It shows in the products list |
| 3 | «ឥឡូវអ្នកជាអ្នកទិញ។ សូមបញ្ជាទិញវា ហើយបង់ប្រាក់ពេលទទួល។» (Now you are a buyer. Order it and pay on delivery.) | The shop page (`/km/s/mekong-auto-garage`, or their own) | They see the "Order placed" page |
| 4 | «អ្នកជាម្ចាស់ហាងវិញ។ មានការបញ្ជាទិញថ្មីមួយ។ សូមធ្វើរហូតដល់ប្រគល់ទំនិញរួច។» (You are the seller again. There is a new order. Take it all the way to delivered.) | `/km/m` | The order shows "Delivered" or "Completed" |

Let them use Khmer or English, whichever they choose — and write down
which they chose.

## What to write down (one table per seller)

Seller: ____________  Garage: ____________  Phone: ____________  Language used: ____

| Task | Finished alone? (yes / with help / no) | Time | Where they stopped or tapped the wrong thing | Their words |
| --- | --- | --- | --- | --- |
| 1. Set up shop | | | | |
| 2. Add a product or service | | | | |
| 3. Order as a buyer | | | | |
| 4. Handle the order | | | | |

Also note, without asking:

- Any word they read aloud and did not understand.
- Anything they tried to tap that is not a button.
- Any moment they turned to look at you.
- Whether they scrolled sideways or zoomed (a layout problem on their phone).

## Three questions at the end

Ask these only after all the tasks, and write the answers word for word.

1. «ផ្នែកណាពិបាកជាងគេ?» (Which part was hardest?)
2. «តើមានអ្វីខ្វះ ដែលអ្នកត្រូវការដើម្បីលក់ប្រចាំថ្ងៃ?» (What is missing that you need to sell every day?)
3. «បើវាដំណើរការពិត តើអ្នកនឹងប្រើវាសម្រាប់ហាងរបស់អ្នកទេ? ហេតុអ្វី?» (If this were real, would you use it for your shop? Why, or why not?)

Do not ask "do you like it?" — everyone says yes.

## How to read the results

| What you saw | What it means | What to do |
| --- | --- | --- |
| Every seller finished a task alone | That screen is ready | Nothing |
| One seller got stuck at a place | Could be that person | Write it down; change nothing yet |
| **Two or more got stuck at the same place** | The screen is wrong, not the sellers | Fix the live screen, then test that task again with one new seller |
| Several sellers ask for the same missing thing | A real need | Decide which release it belongs in (docs/blueprint.md roadmap) |
| One seller asks for a special feature | One opinion | Write it down; don't build it |

**Gate G2 is passed when** every seller finishes every task, and nothing
that stopped two or more of them is left unfixed. Before the next seller,
`pnpm demo:garage -- --reset` gives a fresh Demo Garage.

## After each session

Bring the filled sheet back and tell Claude what you saw, for example:
"3 of 4 garage owners did not find where to add a photo." Claude proposes the
change to that screen; you approve it on the live page; it is fixed before
the next seller.
