# Multi Currency Dashboard V1

A lightweight multi-currency dashboard built for monitoring IDR against AUD, SGD, JPY, and USD using a fully free-first stack.[1][2]

## Overview

This project is designed as a static frontend app that can be deployed easily on Vercel without a database in V1.[3][4] It uses Frankfurter for exchange-rate data, Chart.js for visualization, and browser localStorage for watchlist persistence in the same browser.[5][6][7]

## V1 features

- Multi-currency support: AUD, SGD, JPY, USD.[5]
- Conversion mode switch: IDR to FX and FX to IDR.[5]
- Historical range options: 7 days, 14 days, and 30 days.[5]
- Line chart rendering with Chart.js CDN.[6][8]
- Watchlist stored locally in the browser using localStorage.[7][9]
- Placeholder headline section prepared for 10 relevant news items.[10]
- One-sentence verdict based on recent trend and headline count logic.[5]

## Stack

| Layer | Tool |
|------|------|
| Frontend | HTML, CSS, JavaScript [11] |
| Charting | Chart.js CDN [6][12] |
| FX Data | Frankfurter API [1][5] |
| Hosting | Vercel Hobby [2][4] |
| Local persistence | Browser localStorage [7][9] |

## Project structure

```text
multi-currency-dashboard/
├── index.html
├── style.css
├── app.js
└── README.md
```

This structure is enough for a static deployment workflow on Vercel for plain HTML/CSS/JavaScript projects.[3][13]

## How to run locally

1. Put all files in the same folder.[3]
2. Open `index.html` in a browser for a quick preview, or serve the folder with a simple local server for safer API testing.[13]
3. Use the controls to switch currency, range, and conversion direction.[5]

## How to deploy to Vercel

1. Create a new GitHub repository.
2. Upload `index.html`, `style.css`, `app.js`, and `README.md`.
3. Import the repository into Vercel as a new project.[14][15]
4. Since this is a static frontend project, no complex framework setup is required for the first deployment.[3][4]

## Current limitations

V1 does not use a database, so the watchlist only persists in the same browser and device.[7][9] The headline module is still a placeholder and can be connected later to a free news provider such as GNews in a later iteration.[10]

## Planned next step

The next practical improvement is connecting a lightweight news source for up to 10 relevant headlines and then refining the verdict logic while keeping the stack free and lightweight.[10][2]