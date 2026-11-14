# Campus Lost & Found — Sprint 2

A website that helps students at the university report lost and found items, prove ownership privately, and collect items from campus security using a QR code.

CS 388T class project · Sprint 2

## How to run it

1. Install **Node.js 24 or later** from [nodejs.org](https://nodejs.org).
2. Download this project (green **Code** button → **Download ZIP**) and extract it.
3. Open a terminal in the extracted folder and run:

   ```sh
   node scripts/demo.mjs
   ```

   On Windows you can double-click `START-WINDOWS.bat` instead.
4. Open **http://localhost:3000** in your browser.
5. Press **Ctrl+C** in the terminal to stop it.

No internet connection or `npm install` is needed to run the website.

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Student | student@campus.test | CampusStudent123! |
| Finder | finder@campus.test | CampusFinder123! |
| Security staff (also admin) | staff@campus.test | CampusStaff123! |

Tip: open a second account in an incognito window to use two roles at the same time.

## Features (Product Backlog)

| ID | Feature |
| --- | --- |
| PBI-01 | Register, sign in and sign out (student and staff roles) |
| PBI-02 | Report a lost item with details and a photo |
| PBI-03 | Report a found item and choose a collection point |
| PBI-04 | Search and filter by building, category, type and date |
| PBI-05 | Claim an item with private identifying details |
| PBI-06 | Staff review claims and approve or reject them |
| PBI-07 | Status notifications inside the website |
| PBI-08 | Alerts about possible matches and claim updates |
| PBI-09 | QR pickup code after a claim is approved |
| PBI-10 | Staff scan or enter the QR code at the desk |
| PBI-11 | "My space" dashboard for your reports and claims |
| PBI-12 | Finder marks a found item as handed to security |
| PBI-13 | Admin analytics dashboard with CSV download |
| PBI-14 | Admin manages buildings and categories |
| PBI-15 | Edit or withdraw your own report |
| PBI-16 | Report false or inappropriate posts |

The website also works in **Arabic** (button at the top).

## Quick demo

1. **Claim an item:** sign in as **student**, open **Keys with a green keyring**, and select **This is mine**. Describe a private detail and submit.
2. **Approve it:** sign in as **staff**, open **Claims & pickup**, and approve the claim.
3. **Pick it up:** as **student**, open **My space** to see the QR code. As **staff**, verify the code in **Claims & pickup** and complete the handover.
4. **Hand over a found item:** as **finder**, report a found item, open it in **My space**, and select **I handed it to security**. Staff then confirm receipt in **Collection desk**.
5. **Edit or withdraw:** open one of your reports in **My space**.
6. **Report a post:** open any item and select **Report this post**. Staff review it in **Admin → Reported posts**.
7. **Admin:** as **staff**, open **Admin** for analytics and to manage buildings and categories.

## Good to know

- Notifications show inside the website (refresh about every 15 seconds); there are no email or phone notifications.
- Accounts are project accounts, not connected to the university login.
- All data is saved in `data/campus.sqlite`. Delete the `data` folder to reset the demo.
- Places, accounts and items are fictional. This is a class project, not a live university service.

## Project files

| File / folder | What it is |
| --- | --- |
| `index.html`, `styles.css`, `app.js` | The website (ready to run) |
| `src/` | Website source code (React + TypeScript) |
| `server.mjs` | Server, database and security rules |
| `scripts/` | Demo start-up and build scripts |
| `tests/` | Automated tests |

Built with **React**, **TypeScript**, **Node.js** and **SQLite**.

## For developers

```sh
npm ci            # install tools (needs internet once)
npm run build     # rebuild app.js after editing src/
npm test          # run the 17 automated tests
```
