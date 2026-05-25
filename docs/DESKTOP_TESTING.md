# Test GabayRa on desktop (caregiver / family view)

The mobile APK only runs on your phone. For **desktop layout** (tablet / web caregiver UI), use the **web** build:

```powershell
cd d:\pillpal_app
npm run web
```

Then open the URL Expo prints (usually `http://localhost:8081`).

1. Log in with your **caregiver / family** account.
2. Widen the browser window — at **768px+** width the app shows the **sidebar caregiver dashboard** (same as a tablet).
3. Below 768px you see the **phone bottom tabs** (swipe left/right between tabs).

**Tip:** In Chrome DevTools (F12) → toggle device toolbar → pick “iPad” or set width to 1024px.

You do **not** need to reinstall anything for web — it uses the same code and Render API (`EXPO_PUBLIC_API_URL` / `app.json` extra `apiUrl`).
