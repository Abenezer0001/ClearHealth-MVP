# TrialAtlas - Product Overview

## What is TrialAtlas?

**TrialAtlas** is a clinical trial discovery and recruitment workflow platform.  
Patients connect their health record (SMART on FHIR), review AI-matched studies, and share selected medical details with coordinators.  
Coordinators triage leads, review consented data, and track outreach status.

---

## The Actors

### 1. Patient
A user searching for studies that fit their health profile.

**What they can do:**
- Search ClinicalTrials.gov studies by condition, location, status, and phase
- Connect EHR data via SMART on FHIR (conditions, labs, medications, demographics)
- View AI match scores and why a trial matched
- Express interest and choose exactly which data categories to share

### 2. Coordinator
A user handling recruitment and lead follow-up.

**What they can do:**
- View incoming leads in Coordinator Inbox
- Filter leads by pipeline state (`new`, `contacted`, `scheduled`, `not_fit`)
- Click any lead row to open a right-side detail panel
- Review only the fields the patient consented to share
- Save coordinator notes and update lead status

---

## Core User Flows

### Patient Flow

1. Sign up and select `patient` role.
2. Connect health record on `/connect-ehr` via SMART on FHIR.
3. Open Find Trials and search normally.
4. If connected, see **AI Matched for You**:
   - score-ranked cards
   - match details (expandable)
   - status filter chips (`All`, `Recruiting`, `Completed`, `Unknown`, `Terminated`)
   - initial high-confidence matches (>= 40 score), with load-more for lower-score matches
5. Click `Interested`, choose share options, and submit.

### Coordinator Flow

1. Sign up and select `coordinator` role.
2. Open `/coordinator-inbox`.
3. Review lead table, filter by status, and click a lead row.
4. Right-side panel opens with:
   - patient identity and contact
   - diagnosis summary
   - consented shared sections (demographics, conditions, labs, meds, location, email)
   - structured labs list (name/date/value) when labs are shared
5. Update status and add notes.

---

## AI Matching Experience

When a patient has a connected record:

- Trial cards display match score and matched condition tags
- Criteria summary chips show met / not met / missing only when counts are non-zero
- Match rationale is expandable per card
- Search results can render with AI match context (not only the dedicated matched section)

If no EHR is connected, the product falls back to standard trial search cards.

---

## Data Sharing Model

Patients explicitly choose what to share in the `Express Interest` dialog.

| Data Category | Patient-Selectable | Notes |
|---|:---:|---|
| Demographics (age range, sex) | ✅ | Default selected |
| Conditions | ✅ | Default selected |
| Labs | ✅ | Shared as structured lab entries |
| Medications | ✅ | Shared as medication list |
| Location (city/region) | ✅ | Optional |
| Email | ✅ | Optional, default selected |

### Behavior Notes
- Coordinator sees only consented categories.
- If a selected category has no available source data, the system stores an explicit "no data available" message instead of fake/random values.
- New submissions persist structured lab items for cleaner coordinator display.

---

## Lead Lifecycle

Current statuses used in product:

- **New**: Interest submitted, not yet worked
- **Contacted**: Coordinator reached out
- **Scheduled**: Screening or follow-up scheduled
- **Not a Fit**: Marked ineligible/not proceeding

---

## Admin Dashboard (Coordinator Access)

`/admin` provides live recruitment insights:

- Summary metrics (`total leads`, `unique patients`, `unique trials`, `engagement`)
- Pipeline status counts
- Top diagnoses
- Recent lead table (patient, email, diagnosis, trial, status)

---

## Security and Access

- Authenticated routes are role-gated (`patient` vs `coordinator`).
- Coordinator APIs require coordinator role.
- Patient share submissions are tied to authenticated user session.
- Shared lead data is stored server-side and hydrated for coordinator/admin views.

---

## Integrations

| Integration | Purpose |
|---|---|
| SMART on FHIR | Import patient profile from connected health systems/sandbox |
| ClinicalTrials.gov API | Trial search and study metadata |
| MongoDB | Users, SMART connections, leads, and analytics source data |

---

## Page Overview

| Page | Role | Purpose |
|---|---|---|
| `/` (Find Trials) | Patient, Coordinator | Search trials; AI matching when patient EHR is connected |
| `/connect-ehr` | Patient | Connect/disconnect SMART on FHIR and view imported profile |
| `/coordinator-inbox` | Coordinator | Lead triage table + right-side lead details panel |
| `/admin` | Coordinator | Live recruitment insights and trend summaries |
| `/role-selection` | Unassigned user | Select role before workflow access |

