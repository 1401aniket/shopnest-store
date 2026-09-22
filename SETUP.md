# Shopnest on your laptop

## Quick start on Windows

1. Install Node.js LTS from https://nodejs.org/.
2. Open this project folder in VS Code.
3. Double-click `start-shopnest.bat`.
4. The storefront opens in your browser. The API starts at `http://localhost:4000`.

The first run installs backend packages automatically and creates `backend/.env` from the example file.

## Manual start

```powershell
cd backend
npm install
copy .env.example .env
npm start
```

The static storefront can also be opened directly by double-clicking `index.html`.

## Before accepting real orders

Add your Razorpay and MSG91 credentials to `backend/.env`. Keep that file private and never upload it to GitHub.
