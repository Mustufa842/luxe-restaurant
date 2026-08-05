# Luxe — Enterprise Fine-Dining Platform (100% Free-Tier Infra)

Next.js 14 (App Router) + TypeScript, React Three Fiber 3D UI, Prisma/PostgreSQL,
Stripe, a free-tier Groq-powered AI concierge, and a self-hosted (free) WhatsApp bot.
Every service used here has a $0/month tier — there is no infrastructure bill at
small scale, only the trade-offs documented below.

## Structure

```
app/
  (marketing)/            # public site: home, menu, reservations
  admin/                  # role-gated dashboard (server component)
  api/
    auth/[...nextauth]/   # NextAuth handler
    checkout/             # creates Stripe Checkout Sessions
    webhooks/stripe/      # signature-verified payment webhook
    reservations/         # create + real-time availability
    menu/                 # public menu read API
    ai/concierge/         # Groq-backed RAG chat endpoint
components/
  3d/Hero3DScene.tsx      # signature R3F hero
  menu/MenuGrid.tsx       # filterable menu w/ 3D parallax cards
  reservations/ReservationForm.tsx
  ui/AIConcierge.tsx      # floating glassmorphic chat widget
whatsapp-bot/
  bot.ts                  # standalone Baileys process — see below, run separately
lib/                      # prisma client, auth config, crypto, validation,
                           # in-memory rate limiting, Stripe helper, state machine
prisma/schema.prisma       # User, Reservation, MenuItem, Order, PaymentLog, ChatSession
middleware.ts               # CSP/HSTS headers, CSRF check, rate limiting
```

## What's actually free here, and what the catch is

Being upfront about this matters more than the checklist looking clean:

| Piece | Free option used | The real trade-off |
|---|---|---|
| Hosting | Vercel free tier | Fine for a restaurant's traffic; cold starts and function time limits exist |
| Database | Neon / Supabase free tier | Free tier databases sleep/throttle under low usage on some plans — check current limits |
| AI concierge | Groq (Llama 3, free tier) | Real rate limits (req/min, tokens/min) — fine for a demo, verify limits before real traffic |
| Rate limiting | In-memory (`lib/rate-limit.ts`) | Per-server-instance, not global — see comment in that file |
| WhatsApp | Baileys (unofficial, open-source) | **Against WhatsApp's ToS; numbers get banned in practice.** This is the one place "free" is a real gamble, not just a technical trade-off — see `whatsapp-bot/bot.ts` for the full explanation and the honest alternative (Twilio/Meta Cloud API) if you need this channel to be dependable |
| Payments | Stripe | Genuinely $0/month — you only pay per-transaction fees, same as any card processor |
| Auth | NextAuth + Google OAuth | Free, no catch |

## Setup — the website

```bash
npm install
cp .env.example .env        # fill in DATABASE_URL, NEXTAUTH_SECRET, PII_ENCRYPTION_KEY, GROQ_API_KEY, Stripe keys
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```

## Setup — the WhatsApp bot (separate process, run only when you want WhatsApp live)

```bash
npm run whatsapp:bot
```

A QR code prints in your terminal. Scan it from the restaurant's phone under
WhatsApp → Linked Devices → Link a Device. Keep this process running
continuously (pm2, systemd, or a screen/tmux session on an always-on box —
Oracle Cloud's free-tier VM is the usual $0 choice) for messages to be
answered. If it isn't running, WhatsApp messages to that number simply go
unanswered — there's no fallback, unlike a webhook-based integration.

## Security posture (unchanged from the paid version — free doesn't mean weaker)

- **Headers**: strict CSP, HSTS, X-Frame-Options, nosniff — `middleware.ts`.
- **CSRF**: double-submit cookie on every state-changing API call except the
  Stripe webhook (authenticates via signature instead).
- **Rate limiting**: in-memory sliding window, tighter budget on auth/booking/AI
  routes. See the trade-off note in `lib/rate-limit.ts` before scaling past
  one server instance.
- **Input validation**: every route parses `req.json()` through a Zod schema
  before touching Prisma.
- **PII at rest**: phone numbers are AES-256-GCM encrypted before they're
  written to Postgres, decrypted only server-side in the admin dashboard.
- **Passwords**: Argon2id, only used for the credentials fallback — Google
  OAuth is the primary path.
- **Stripe**: webhook handler reads the raw body and verifies
  `stripe-signature` before parsing anything.
- **No raw card data** ever touches this codebase.

## Honest scope notes

- **Admin dashboard** is read-only (reservations, orders, chat logs) — add
  mutation actions (cancel, refund) as you decide the real staff workflows.
- **Email/SMS confirmations** are marked `// TODO` at the point they'd fire.
- **WhatsApp bot's persisted state** now keys off `ChatSession.externalId`
  (the WhatsApp JID) directly — this was a scan-based lookup in an earlier
  draft; the schema now has the proper unique column.
- Ping the AI concierge with something outside the menu to sanity-check the
  RAG constraint is holding — it should redirect rather than invent a dish.

## Design tokens

Palette, type pairing (Cormorant Garamond / Inter / JetBrains Mono), and the
molten-gold signature motif are defined in `tailwind.config.ts` and
`components/3d/Hero3DScene.tsx`.
