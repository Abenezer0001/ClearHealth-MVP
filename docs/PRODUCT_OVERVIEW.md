# TrialAtlas - Product Overview

## What is TrialAtlas?

**TrialAtlas** is a clinical trial discovery platform that connects patients with clinical trials by allowing them to securely share their health data with trial coordinators.

---

## The Actors

### 1. **Patient**
A person seeking clinical trials that match their medical condition.

**What they can do:**
- Search for clinical trials by condition, phase, and status
- Connect their Electronic Health Record (EHR) via SMART on FHIR
- View their imported health profile (conditions, labs, medications)
- Express interest in specific trials by sharing a controlled summary of their data

### 2. **Coordinator**
A clinical trial site staff member managing patient recruitment.

**What they can do:**
- View incoming patient leads who expressed interest
- See shared patient data (only what each patient consented to share)
- Update lead status (New → Contacted → Scheduled → Not a Fit)
- Add notes about each lead for internal tracking

---

## User Flows

### Patient Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         PATIENT JOURNEY                         │
└─────────────────────────────────────────────────────────────────┘

1. SIGN UP & ROLE SELECTION
   ┌──────────────┐
   │   Sign Up    │ ──→ Select "I'm a Patient" ──→ Dashboard
   └──────────────┘

2. CONNECT HEALTH RECORD
   ┌───────────────────┐     ┌────────────────┐     ┌─────────────┐
   │ Connect EHR Page  │ ──→ │ SMART Sandbox  │ ──→ │ View Profile│
   │ (Pick provider)   │     │ (Auth + Fetch) │     │ (Data shows)│
   └───────────────────┘     └────────────────┘     └─────────────┘

3. FIND & EXPRESS INTEREST
   ┌───────────────────┐     ┌─────────────────┐     ┌──────────────┐
   │ Search Trials     │ ──→ │ Click "I'm     │ ──→ │ Choose what  │
   │ (Condition/Phase) │     │ Interested"    │     │ to share:    │
   └───────────────────┘     └─────────────────┘     │ ✓ Age range  │
                                                      │ ✓ Sex        │
                                                      │ ✓ Conditions │
                                                      │ ○ Labs       │
                                                      │ ○ Meds       │
                                                      │ ○ Location   │
                                                      │ ○ Email      │
                                                      └──────────────┘
                                                             │
                                                             ▼
                                                   Lead sent to Coordinator
```

### Coordinator Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      COORDINATOR JOURNEY                        │
└─────────────────────────────────────────────────────────────────┘

1. SIGN UP & ROLE SELECTION
   ┌──────────────┐
   │   Sign Up    │ ──→ Select "I'm a Coordinator" ──→ Inbox
   └──────────────┘

2. MANAGE LEADS
   ┌───────────────────┐     ┌─────────────────┐     ┌──────────────┐
   │ Coordinator Inbox │ ──→ │ View Lead       │ ──→ │ Update Status│
   │ (All patient      │     │ Details:        │     │ - New        │
   │  leads)           │     │ - Age range     │     │ - Contacted  │
   │                   │     │ - Sex           │     │ - Scheduled  │
   │ Filter by status: │     │ - Conditions    │     │ - Not a Fit  │
   │ New │ Contacted   │     │ - Labs (if opt) │     │              │
   │ Scheduled │ Not   │     │ - Meds (if opt) │     │ Add notes    │
   └───────────────────┘     └─────────────────┘     └──────────────┘
```

---

## Data Sharing Model

The patient controls what data is shared with trial coordinators:

| Data Type | Always Shared | Optional |
|-----------|:-------------:|:--------:|
| Age range (5-year bucket) | ✅ | |
| Biological sex | ✅ | |
| Primary conditions | ✅ | |
| Lab results | | ✅ |
| Medications | | ✅ |
| City/Location | | ✅ |
| Contact email | | ✅ |

> **Privacy Note**: Exact birthdate and full FHIR bundles are never shared.

---

## Lead Lifecycle

```
    ┌─────┐     ┌───────────┐     ┌───────────┐     ┌───────────┐
    │ NEW │ ──→ │ CONTACTED │ ──→ │ SCHEDULED │ ──→ │ ENROLLED  │
    └─────┘     └───────────┘     └───────────┘     └───────────┘
       │                                                  ▲
       └──────────────────→ NOT A FIT ───────────────────┘
                         (if ineligible)
```

| Status | Meaning |
|--------|---------|
| **New** | Patient just submitted interest, not yet reviewed |
| **Contacted** | Coordinator reached out to the patient |
| **Scheduled** | Screening visit or call scheduled |
| **Not a Fit** | Patient doesn't meet eligibility criteria |

---

## Key Value Propositions

### For Patients
- **Discovery**: Find trials you might qualify for
- **Control**: Decide exactly what personal health data to share
- **Convenience**: Import data from your existing health records

### For Coordinators
- **Qualified Leads**: Pre-screened patients interested in specific trials
- **Relevant Data**: See conditions, labs, meds upfront
- **Workflow**: Track leads from first contact to scheduling

---

## Technical Integrations

| Integration | Purpose |
|-------------|---------|
| **SMART on FHIR** | Import patient data from EHR systems |
| **ClinicalTrials.gov API** | Search and display trial information |
| **MongoDB** | Store user accounts and patient leads |

---

## Pages Overview

| Page | Actor | Purpose |
|------|-------|---------|
| `/` (Find Trials) | Both | Search and filter clinical trials |
| `/role-selection` | New Users | Choose patient or coordinator role |
| `/connect-ehr` | Patient | Link EHR and view health profile |
| `/coordinator-inbox` | Coordinator | Manage patient leads |
| `/admin` | Coordinator | Dashboard and insights |
