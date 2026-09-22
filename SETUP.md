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

## Add or remove products

1. Start the backend with `start-shopnest.bat`.
2. Open `admin.html` in the browser.
3. Enter the same `ADMIN_KEY` value configured in `backend/.env`.
4. Fill in the product fields and select up to four photos, then choose **Save product**.
5. Use **Delete** in the product list to hide a product from the store.

The admin page is not linked from the storefront. Keep the admin key private. For production, move image storage to Cloudinary or Supabase Storage instead of storing image data directly in SQLite.

## Before accepting real orders

Add your Razorpay and MSG91 credentials to `backend/.env`. Keep that file private and never upload it to GitHub.
