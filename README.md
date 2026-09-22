# Shopnest backend

## Run locally

1. Install Node.js 20+.
2. In this folder run `npm install`.
3. Copy `.env.example` to `.env` and fill in the Razorpay and MSG91 values.
4. Run `npm run dev`.

The API runs at `http://localhost:4000`.

Important: OTP delivery and payments are disabled until real provider credentials are configured. In development, OTP verification returns a demo code only when `NODE_ENV=development`.

## Main endpoints

- `GET /api/health`
- `GET /api/products`
- `POST /api/auth/request-otp`
- `POST /api/auth/verify-otp`
- `POST /api/orders/razorpay`
- `POST /api/orders/verify-payment`
- `POST /api/orders/upi`
- `GET /api/orders`
- `POST /api/admin/products`
- `DELETE /api/admin/products/:id`

Admin product payloads accept an `images` array with up to four image URLs or data URLs. The first image is used as the product cover.

Static UPI orders are saved as `payment_review` with the submitted UTR. Confirm the payment in the merchant UPI app before fulfilling the order. A QR code alone cannot cryptographically verify payment.
