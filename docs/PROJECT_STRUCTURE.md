# GabayRa project structure

```
pillpal_app/
├── api/                 # Node/Express backend (Render)
│   ├── routes/          # REST endpoints
│   ├── lib/             # Server helpers + ml stubs
│   └── db/              # Postgres + migrations
├── components/          # Shared UI (icons, modals, calendar, skeleton)
├── screens/             # Full-page views (patient, caregiver, family, auth)
├── services/            # Realtime subscriptions
├── lib/                 # Client config (API, theme, tutorial, offline)
├── utils/               # Pure helpers (time buckets, search)
├── types/               # Shared TypeScript types
├── ml/                  # ML docs + future training folders
│   ├── reinforcement-learning/
│   └── predictive-analytics/
├── docs/                # Guides (API, desktop, structure)
└── assets/              # Icons, splash, images
```

**Run backend locally:** `cd api && npm run dev`  
**Run app:** `npm start` or `npm run web` (desktop caregiver layout)
