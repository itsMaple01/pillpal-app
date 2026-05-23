# GabayRa Intelligence API (placeholder)

This API collects behavior data and returns **rule-based** reminder hints until you connect a real ML model. The app already calls these endpoints; you can swap the engine later without changing the mobile client.

---

## 1. Deploy backend changes

From your project folder:

```powershell
cd d:\pillpal_app
git add api/
git commit -m "Add intelligence API and GabayRa updates"
git push
```

Wait for Render to redeploy. Tables `intelligence_events` and `intelligence_profiles` are created automatically on server start via `api/db/migrate.js`.

---

## 2. Endpoints

Base URL: `https://pillpal-app.onrender.com` (or your Render URL)

### Log a behavior event

`POST /api/intelligence/events`

```json
{
  "firebase_uid": "abc123",
  "event_type": "taken",
  "medication_id": 42,
  "scheduled_at": "2026-05-24T08:00:00.000Z",
  "metadata": { "source": "patient_app" }
}
```

**event_type** values:

| Type | When to log |
|------|-------------|
| `taken` | Patient marks medication taken |
| `confirm` | User confirms a reminder |
| `snooze` | User snoozes a reminder |
| `ignore` | Reminder dismissed without action |
| `missed` | Dose missed (cron or checker) |
| `opened_app` | App opened (light signal) |

**Response:** `{ ok: true, profile: { avgDelay, preferredLead, clusterLabel } }`

### Get reminder plan (used by the app before scheduling local notifications)

`GET /api/intelligence/reminder-plan/:firebase_uid`

**Response example:**

```json
{
  "preferred_lead_minutes": 5,
  "notify_at_exact_time": false,
  "cluster_label": "consistent",
  "avg_response_delay_minutes": 3,
  "engine": "rules-v1"
}
```

The app schedules **one daily notification per medication** at `scheduled_time − preferred_lead_minutes` (default **5 minutes before**).

### Get profile summary

`GET /api/intelligence/profile/:firebase_uid`

Same body as reminder-plan (for dashboards or training export).

---

## 3. How the placeholder “AI” works today

File: `api/lib/intelligenceEngine.js`

- Reads the last 120 events for the user
- Computes average delay between `scheduled_at` and `responded_at`
- Sets `preferred_lead_minutes` (3–15, default 5)
- Assigns a simple `cluster_label`: `default`, `consistent`, or `needs_nudge`

This is **not** machine learning yet—it is a stand-in you can replace.

---

## 4. Connecting a real model later

1. Export training data: `SELECT * FROM intelligence_events ORDER BY responded_at DESC;`
2. Train offline (Python: scikit-learn, XGBoost, etc.)
3. Replace `getReminderPlan()` in `api/lib/intelligenceEngine.js`
4. Keep the same REST contract so the mobile app does not need changes

---

## 5. Test with PowerShell

```powershell
$base = "https://pillpal-app.onrender.com"
$uid = "YOUR_FIREBASE_UID"

Invoke-RestMethod -Method Post -Uri "$base/api/intelligence/events" -ContentType "application/json" -Body (@{
  firebase_uid = $uid
  event_type = "confirm"
  medication_id = 1
} | ConvertTo-Json)

Invoke-RestMethod -Uri "$base/api/intelligence/reminder-plan/$uid"
```

---

## 6. Rebuild the app

```powershell
eas build --platform android --profile preview
```

Install the new APK from the EAS build page.

---

## 7. Family vs caregiver UI

- **Family / Caregiver** role → Family dashboard (simple)
- **Manage → Switch to Caregiver Dashboard** → full professional UI
- **Manage → Switch to Family view** → back to family UI

Mode is stored on device: `gabayra_care_mode_{uid}`.
