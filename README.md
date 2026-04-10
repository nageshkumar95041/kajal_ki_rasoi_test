# Kajal Ki Rasoi 🍱

A full-stack food ordering web app built with **Next.js 14 (App Router)** and **TypeScript**, migrated from an Express + Vanilla JS monolith. Supports online ordering, tiffin subscriptions, real-time order tracking, delivery agent management, and an admin dashboard.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database | MongoDB (Mongoose) |
| Auth | JWT (jsonwebtoken) |
| Payments | Stripe Checkout |
| Delivery | Borzo Delivery API |
| Maps | Google Maps JavaScript API (Places, Geocoding) |
| Real-time | Socket.IO (via custom server.ts) |
| Email | Nodemailer |
| Hosting | Vercel / any Node.js host |

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                        ← Homepage (hero, menu, tiffin, about, contact)
│   ├── layout.tsx                      ← Root layout
│   ├── globals.css                     ← Global styles
│   ├── (pages)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── cart/page.tsx
│   │   ├── payment/page.tsx            ← Checkout with Google Maps address search
│   │   ├── my-orders/page.tsx
│   │   ├── profile/page.tsx
│   │   ├── subscription/page.tsx       ← Tiffin subscription plans
│   │   ├── admin/page.tsx              ← Admin dashboard
│   │   ├── agent/page.tsx              ← Delivery agent app
│   │   ├── tracking/page.tsx           ← Live order tracking
│   │   └── reset-password/page.tsx
│   └── api/
│       ├── login/route.ts
│       ├── register/route.ts
│       ├── verify/route.ts
│       ├── resend-otp/route.ts
│       ├── forgot-password/route.ts
│       ├── reset-password/route.ts
│       ├── verify-session/route.ts
│       ├── menu/route.ts
│       ├── menu/[id]/route.ts
│       ├── tiffin-menu/route.ts
│       ├── orders/route.ts
│       ├── orders/[id]/route.ts
│       ├── orders/[id]/status/route.ts
│       ├── orders/[id]/cancel/route.ts
│       ├── checkout-cod/route.ts
│       ├── create-stripe-checkout/route.ts
│       ├── create-stripe-subscription-checkout/route.ts
│       ├── subscribe/route.ts
│       ├── my-orders/route.ts
│       ├── profile/route.ts
│       ├── contact/route.ts
│       ├── track/[orderId]/route.ts
│       ├── webhook/route.ts            ← Stripe webhook handler
│       ├── delivery/                   ← Borzo delivery estimate
│       ├── guest-orders/route.ts
│       ├── google-login/route.ts
│       ├── agent/                      ← Agent location, orders, delivery
│       ├── admin/
│       │   ├── dashboard-stats/route.ts
│       │   ├── menu/route.ts
│       │   ├── tiffin-menu/route.ts
│       │   ├── tiffin-menu/[id]/route.ts
│       │   ├── orders/ (via orders API)
│       │   ├── subscriptions/route.ts
│       │   ├── subscriptions/[id]/status/route.ts
│       │   ├── agents/route.ts
│       │   ├── agents/assign/route.ts
│       │   ├── customers/route.ts
│       │   └── users/[id]/...          ← Trust, role, verify, delete
│       └── config/
│           ├── google/route.ts         ← Google OAuth config for client
│           ├── google-maps/route.ts    ← Maps API key for client
│           └── stripe/route.ts         ← Stripe publishable key for client
├── components/
│   ├── Navbar.tsx                      ← Responsive navbar with cart + avatar dropdown
│   ├── StickyCart.tsx                  ← Fixed bottom cart bar (login-gated)
│   └── Toast.tsx                       ← Global toast notifications
├── hooks/
│   └── useAuth.ts
└── lib/
    ├── mongodb.ts                      ← Singleton DB connection
    ├── auth.ts                         ← JWT sign/verify, requireAuth, requireAdmin
    ├── email.ts                        ← Nodemailer transporter
    ├── socket.ts                       ← Socket.IO global emit helper
    ├── borzo.ts                        ← Borzo delivery order creation
    ├── seed.ts                         ← DB seed script
    ├── utils.ts                        ← Shared client utilities (cart, auth helpers)
    └── models/index.ts                 ← All Mongoose models

server.ts                               ← Custom Next.js + Socket.IO server
```

---

## Database Models

| Model | Purpose |
|---|---|
| `User` | Customers and admins. Has OTP verification, password reset, trust flag |
| `Order` | Food orders. Supports COD + Stripe, Borzo + in-house delivery, agent assignment |
| `Subscription` | Tiffin subscription plans (Basic / Standard / Premium) |
| `TempCart` | Holds cart data between Stripe redirect and webhook confirmation |
| `TempSubscription` | Holds subscription data between Stripe redirect and webhook confirmation |
| `MenuItem` | Regular food menu items |
| `TiffinItem` | Daily tiffin menu items |
| `Agent` | Delivery agents with geolocation (2dsphere index) |

---

## Key Features

- **Auth** — Register, login, OTP verification, forgot/reset password, Google OAuth
- **Menu** — Dynamic menu from DB, category filters, veg/price/popular filters
- **Cart** — LocalStorage cart with sticky bottom bar (only shown when logged in)
- **Checkout** — Google Maps address autocomplete (new Places API), delivery fee estimate, coupon codes, Stripe online payment or COD
- **Tiffin Subscriptions** — Weekly/monthly plans, multi-person, frequency toggle, Stripe checkout
- **Order Tracking** — Real-time via Socket.IO, Borzo tracking URL integration
- **Admin Dashboard** — Manage orders, menu, subscriptions, users, agents, stats
- **Delivery Agents** — Agent app with order queue, live location update, delivery OTP, proof of delivery
- **Stripe Webhooks** — `checkout.session.completed` creates order/subscription from TempCart/TempSubscription

---

## Environment Variables

Create a `.env.local` file in the project root:

```env
# MongoDB
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/<dbname>

# Auth
JWT_SECRET=your_very_long_random_secret_here

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Google
GOOGLE_MAPS_API_KEY=AIza...
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...

# Email (Nodemailer)
EMAIL_USER=your@gmail.com
EMAIL_PASS=your_app_password

# Borzo Delivery
BORZO_API_KEY=...
BORZO_ENV=sandbox                  # or "production"
RESTAURANT_LAT=28.5355
RESTAURANT_LNG=77.3910
RESTAURANT_ADDRESS=123, Your Street, Noida
RESTAURANT_PHONE=+91XXXXXXXXXX
RESTAURANT_NAME=Kajal Ki Rasoi

# App
FRONTEND_URL=https://yourdomain.com
```

---

## Getting Started

```bash
# Install dependencies
npm install

# Run in development (uses custom server for Socket.IO)
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

> **Note:** The app uses a custom `server.ts` to attach Socket.IO to the Next.js HTTP server. Do **not** use `next start` directly in production — always run through `server.ts` (e.g. `node server.js` after build, or via the `start` script).

---

## Deployment

### Vercel (Recommended for serverless — without Socket.IO)
> If you don't need real-time order updates, remove Socket.IO and deploy normally.

```bash
npx vercel
```
Set all env variables in the Vercel dashboard under **Project → Settings → Environment Variables**.

### VPS / Railway / Render (Required for Socket.IO)
Socket.IO requires a persistent Node.js process. Use a platform that supports custom servers:

1. Build the project: `npm run build`
2. Start with: `node server.js` (or `ts-node server.ts` in dev)
3. Use PM2 for process management:
```bash
pm2 start server.js --name kajal-ki-rasoi
pm2 save
```

---

## Stripe Webhook Setup

1. Install the Stripe CLI: https://stripe.com/docs/stripe-cli
2. In development, forward events locally:
```bash
stripe listen --forward-to localhost:3000/api/webhook
```
3. In production, add the webhook endpoint in your Stripe Dashboard:
   - URL: `https://yourdomain.com/api/webhook`
   - Events to listen for: `checkout.session.completed`

---

## Google Maps Setup

This app uses the **new Google Places API** (migrated from the deprecated legacy API):
- `AutocompleteSuggestion.fetchAutocompleteSuggestions` (replaces `AutocompleteService`)
- `new Place().fetchFields()` (replaces `PlacesService.getDetails`)

Enable these APIs in Google Cloud Console:
- Maps JavaScript API
- Places API (New)
- Geocoding API

Add your production domain to the API key's **allowed referrers**.

---

## API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/register` | Register new user |
| POST | `/api/login` | Login, returns JWT |
| POST | `/api/verify` | Verify OTP |
| POST | `/api/resend-otp` | Resend OTP |
| POST | `/api/forgot-password` | Send reset email |
| POST | `/api/reset-password` | Reset password with token |
| GET | `/api/verify-session` | Validate JWT |
| POST | `/api/google-login` | Google OAuth login |

### Menu & Orders
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/menu` | Get all menu items |
| GET | `/api/tiffin-menu` | Get today's tiffin items |
| POST | `/api/orders` | Create a COD order |
| GET | `/api/my-orders` | Get logged-in user's orders |
| POST | `/api/checkout-cod` | COD checkout with cart |
| POST | `/api/create-stripe-checkout` | Create Stripe checkout session |
| POST | `/api/subscribe` | Create tiffin subscription (offline pay) |
| POST | `/api/create-stripe-subscription-checkout` | Stripe checkout for subscription |

### Admin
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/dashboard-stats` | Order and revenue stats |
| GET/POST | `/api/admin/menu` | Manage menu items |
| GET/PATCH | `/api/admin/subscriptions` | View and update subscriptions |
| GET | `/api/admin/customers` | List all customers |
| GET/POST | `/api/admin/agents` | Manage delivery agents |
| POST | `/api/admin/agents/assign` | Assign agent to order |

---

## Coupon Codes

| Code | Discount | Minimum Order |
|---|---|---|
| `APNA50` | ₹50 off | ₹200 |

Add more coupons by updating the coupon logic in `payment/page.tsx` and `subscription/page.tsx`.

---

## License

Private project — Kajal Ki Rasoi. All rights reserved.