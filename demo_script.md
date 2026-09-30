# 🎬 Pashu Sentinel — 2-Minute Demo Script

> **Total Duration:** 2:00 min  
> **Suggested Tool:** OBS Studio / Loom / Windows Game Bar (`Win + G`)  
> **Style:** Fast-paced, narrated, no long pauses

---

## 🕐 [0:00–0:12] Hook — The Problem

*Narrate over the Home page hero section:*

> *"Every year, disease outbreaks like FMD and LSD wipe out lakhs of livestock across India — causing crores in losses for farmers who have no early-warning system."*

**Show:** Landing page (`/`) — hero headline visible.

---

## 🕐 [0:12–0:22] Login (10 sec)

> *"Pashu Sentinel is a platform for farmers, para-vets, and District Veterinary Officers."*

**Actions:**
1. Open Login page (`/login`)
2. Type in credentials (FARMER or VET role)
3. Click Login — lands instantly on Dashboard

---

## 🕐 [0:22–0:45] Dashboard Overview (23 sec)

> *"The dashboard gives a real-time pulse of the district — active outbreaks, case counts, and priority alerts at a glance."*

**Actions:**
1. Show Dashboard (`/dashboard`)
2. Hover over KPI cards (Cases Reported, Alerts, Risk Level)
3. Scroll down slowly to reveal charts/trend graphs

---

## 🕐 [0:45–1:05] Report a Case (20 sec)

> *"A farmer can report a sick animal in under 60 seconds — GPS location, species, and symptoms captured instantly."*

**Actions:**
1. Navigate to Field Report (`/report`)
2. Fill species (Cattle), select symptoms (Blisters, Drooling)
3. Show GPS auto-detect snapping to location
4. Click Submit → show success toast notification

---

## 🕐 [1:05–1:22] Map & Disease Spread (17 sec)

> *"Every report is plotted on a live outbreak map. Clusters appear in red. Officers see which villages are at risk before an outbreak spreads."*

**Actions:**
1. Open Map page (`/map`)
2. Hover over cluster markers
3. Click one to show the case summary popup

---

## 🕐 [1:22–1:38] Alerts & AI Triage (16 sec)

> *"When high-risk patterns are detected, the system automatically fires priority alerts to the nearest available veterinarian — no phone tag required."*

**Actions:**
1. Go to Alerts page (`/alerts`)
2. Show a HIGH-priority alert card
3. Click it to show detail and escalation timeline

---

## 🕐 [1:38–1:52] VetAssist RAG Chat (14 sec)

> *"And farmers get instant AI-powered guidance 24/7 — grounded in ICAR and DAHD-verified protocols — with source citations."*

**Actions:**
1. Click the floating chat button (bottom-right corner)
2. Type: "My cow has blisters on its feet and is drooling"
3. Hit Send → answer appears with FMD protocol and 80% confidence badge
4. Zoom in briefly on the source attribution

---

## 🕐 [1:52–2:00] Closing Shot (8 sec)

> *"Pashu Sentinel. Early detection. Faster response. Protected livelihoods."*

**Actions:**
1. Return to Dashboard
2. Slow zoom-out on the map or KPI cards
3. Fade to black

---

## 🎙 Full Narration Script (Voice-Over)

**[0:00]** Every year, livestock disease outbreaks cause billions in losses for Indian farmers who have no early warning system.

**[0:12]** Pashu Sentinel is a digital surveillance platform — connecting farmers, para-vets, and district veterinary officers on one dashboard.

**[0:22]** The command center gives a real-time pulse of your district — active outbreaks, case counts, and risk alerts in one view.

**[0:45]** A farmer can report a sick animal in under 60 seconds. Species, symptoms, and GPS location — captured instantly.

**[1:05]** Every report is mapped live. Officers can spot clusters, monitor spread, and dispatch resources before an outbreak escalates.

**[1:22]** High-risk patterns automatically trigger priority alerts to the nearest available veterinarian — no phone tag required.

**[1:38]** And with VetAssist, farmers get instant AI-powered guidance any time — grounded in ICAR and DAHD-verified protocols, with source citations and confidence scores.

**[1:52]** Pashu Sentinel. Early detection. Faster response. Protected livelihoods.

---

## ⚙️ Pre-Demo Checklist

- [ ] Backend running: `uvicorn app.main:app --reload` (in `/backend`)
- [ ] Frontend running: `npm run dev` (in `/frontend`)
- [ ] RAG knowledge base seeded: `python test_rag.py` (in `/backend`)
- [ ] Test accounts ready (FARMER login + VET login)
- [ ] A few real-looking cases/alerts pre-filled so dashboard isn't empty
- [ ] Browser zoom at 100–110%, resolution 1920×1080
- [ ] All other notifications and apps closed
- [ ] No extra browser tabs open

---

## 💡 Filming Tips

| Tip | Detail |
|-----|--------|
| **Move cursor slowly** | Deliberate movement looks professional |
| **No mistakes live** | Stop, reset, do a second take |
| **Add music in post** | Lo-fi / cinematic at ~20% volume |
| **Do 2–3 takes** | Pick the cleanest one |
| **Record tool** | OBS Studio (free), Loom, or `Win + G` on Windows |
| **Edit tool** | CapCut (free), DaVinci Resolve, or Clipchamp (built-in Windows) |
