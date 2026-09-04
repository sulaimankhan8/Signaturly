# 📘 Signaturly — Complete End-to-End User Journeys Manual

This manual documents the **complete end-to-end user journeys** across Signaturly. Each flow represents an entire process from the user's initial entry point to their final outcome, with diagrammatic leader lines (`───► [Callout]`), step-by-step UI representations, and detailed inner editor breakdowns.

---

## 📑 Table of Complete User Journeys
1. [Journey 1: New User Registration & Onboarding Flow](#journey-1-new-user-registration--onboarding-flow)
2. [Journey 2: Existing User Sign In & Password Recovery Flow](#journey-2-existing-user-sign-in--password-recovery-flow)
3. [Journey 3: Create, Edit & Dispatch Contract Flow (Inner PDF Editor)](#journey-3-create-edit--dispatch-contract-flow-inner-pdf-editor)
4. [Journey 4: Signer Experience & Execution Flow](#journey-4-signer-experience--execution-flow)
5. [Journey 5: Document Lifecycle & Voiding Action Flow](#journey-5-document-lifecycle--voiding-action-flow)
6. [Journey 6: Reusable Templates & CSV Bulk Mailmerge Flow](#journey-6-reusable-templates--csv-bulk-mailmerge-flow)
7. [Journey 7: AI Signature Background Eraser Flow](#journey-7-ai-signature-background-eraser-flow)
8. [Journey 8: Public Cryptographic Verification Flow](#journey-8-public-cryptographic-verification-flow)

---

## Journey 1: New User Registration & Onboarding Flow
**Full Sequence:** `[Step 1: Landing Page] ──► [Step 2: Registration Form & E-Consent] ──► [Step 3: Initialized Dashboard]`

```
[STEP 1: LANDING PAGE (/landing)]
+---------------------------------------------------------------------------------------+
|  [Logo] Signaturly                    Features   Pricing   [Get Started Free ➔]  <───► ① CLICK TO REGISTER
+---------------------------------------------------------------------------------------+
|                                                                                       |
|     ⚡ Legally Binding E-Signatures with Built-In Cryptographic Proof                  |
|     Create, sign, and manage legal contracts in seconds.                              |
|                                                                                       |
|     [ 📄 Drag & Drop PDF Here to Start ] <───────────────────────────────────────► ② OR DROP PDF DIRECTLY
|                                                                                       |
+---------------------------------------------------------------------------------------+
                                          │
                                          ▼ (Navigates to /register)
[STEP 2: REGISTRATION FORM (/register)]
+---------------------------------------------------------------------------------------+
|  CREATE YOUR SIGNATURLY ACCOUNT                                                       |
|                                                                                       |
|  Full Legal Name:    [ Alexandre Hamilton         ] <─────────────────────────────► ③ NAME CAPTURE
|  Work Email Address: [ alex@enterprise.com        ] <─────────────────────────────► ④ EMAIL DESTINATION
|  Password:           [ ••••••••••••               ] <─────────────────────────────► ⑤ 8+ CHAR PASSWORD
|  Confirm Password:   [ ••••••••••••               ]                                   |
|                                                                                       |
|  [x] I agree to Terms of Service & Electronic Signatures Consent <────────────────► ⑥ MANDATORY E-CONSENT
|                                                                                       |
|  [ 🟢 CREATE FREE ACCOUNT BUTTON ➔ ] <────────────────────────────────────────────► ⑦ SUBMIT REGISTRATION
+---------------------------------------------------------------------------------------+
                                          │
                                          ▼ (Account Created & JWT Hydrated)
[STEP 3: COMMAND DASHBOARD (/dashboard)]
+---------------------------------------------------------------------------------------+
|  📊 Welcome, Alexandre Hamilton! (Vault Initialized)                                  |
|  Envelopes: [ Total: 0 ]  [ In Progress: 0 ]  [ Signed: 0 ]                           |
|                                                                                       |
|  [ 📄 Upload First Contract ➔ ]         [ ⚙️ Setup Saved Cursive Signatures ] <──────► ⑧ ONBOARDED & READY
+---------------------------------------------------------------------------------------+
```

---

## Journey 2: Existing User Sign In & Password Recovery Flow
**Full Sequence:** `[Step 1: Landing Page ("Sign In")] ──► [Step 2: Vault Credentials Form] ──► [Step 3: Authenticated Dashboard]`

```
[STEP 1: ENTRY]                                    [STEP 2: LOGIN FORM (/login)]
+-----------------------------+                    +-------------------------------------------------+
| Landing / Direct URL        |                    |  SIGN IN TO YOUR VAULT                          |
| [ Sign In Button ] <────────┼──► (Opens /login) ─┼─► Email:    [ suleman111111111111111@gmail.com ] |
+-----------------------------+                    |   Password: [ ••••••••••••                     ] |
                                                   |   [x] Remember Me   [ Forgot Password? ] <───────┼──► [Sends Google SMTP Token]
                                                   |   [ 🚀 SIGN IN BUTTON ➔ ] <──────────────────────┼──► [Validates Bcrypt & Issues JWT]
                                                   +-------------------------------------------------+
                                                                            │
                                                                            ▼
                                                   [STEP 3: DASHBOARD (/dashboard)]
                                                   +-------------------------------------------------+
                                                   | Active Session Active • 14 Contracts Loaded     |
                                                   +-------------------------------------------------+
```

---

## Journey 3: Create, Edit & Dispatch Contract Flow (Inner PDF Editor)
**Full Sequence:** `[Step 1: Ingestion Dropzone] ──► [Step 2: Visual Inner PDF Editor] ──► [Step 3: Multi-Party Routing] ──► [Step 4: Dispatch]`

### 1. Document Ingestion (`/upload`)
```
+---------------------------------------------------------------------------------------+
|  📁 Drag & Drop PDF Contract Here (e.g. NDA_Agreement.pdf - 2.4 MB)                  |
|  Status: [████████████████████] 100% Parsed (SHA-256 Baseline Recorded) <─────────────► ① INGESTION HASH
+---------------------------------------------------------------------------------------+
```

### 2. Comprehensive Visual Inner PDF Editor (`/editor/:pdfId`)
```
+----------------------------------------------------------------------------------------------------+
| [Gallery] Consulting-Agreement-2026.pdf (Ready)   [Page 1 of 3 < >] [Zoom: 100%] [Save] [Send ➔]   |
+---------------------+------------------------------------------------------------------------------+
| 🛠️ FIELD PALETTE    | 📄 CONTRACT CANVAS (72 DPI Normalized Coordinate Grid)                       |
| ------------------- | ---------------------------------------------------------------------------- |
| [ ✍️ Signature   ]  |   [HUD: Crosshair X: 120px • Y: 380px] <─────────────────────────────────► ② |
| [ 🔤 Initials    ]  |                                                                              |
| [ 📝 Text Field  ]  |   EXECUTIVE CONSULTING SERVICES AGREEMENT                                    |
| [ 📅 Date Field  ]  |   Contract Ref #2026-MSA-0091                                                |
| [ ☑️ Checkbox    ]  |                                                                              |
|                     |   1. Scope of Services: The Contractor shall provide advisory services.      |
| (Click tool to drop |                                                                              |
|  onto canvas) <───► |   Client Signature:                                                          |
|       ①             |   +---------------------------------------+                                  |
|                     |   | ✍️ Signature (Assigned: Signer 1)      | <────────────────────────► ③     |
| Placed: 3 Fields    |   +---------------------------------------+                                  |
| 72 DPI Grid         |   Date: [ 📅 Signer 1 Date ]                                                 |
|                     |                                                                              |
|                     |   [ 🚀 SEND FOR SIGNATURE ➔ ] <──────────────────────────────────────────────► ④
+---------------------+------------------------------------------------------------------------------+
```

#### Detailed Tool & Feature Breakdown:
- **✍️ Signature Tool (①)**: Inserts an active signature box. Burned directly into the PDF vector stream upon execution.
- **🔤 Initials Tool**: Places compact initial stamps for acknowledgment and multi-page contract margins.
- **📝 Text Field Tool**: Creates customizable fillable single-line or multi-line text boxes (Name, Title, Organization).
- **📅 Date Field Tool**: Automatically populates execution timestamps or enables calendar picking.
- **☑️ Checkbox Tool**: Optional or mandatory toggle for terms and contract clauses.
- **72 DPI Normalized Grid (②)**: Canvas coordinates are mathematically normalized to standard PDF point space (72 DPI), ensuring zero drift between browser screens, mobile displays, and high-resolution print.
- **Signer Role Assignment (③)**: Each placed field is color-coded by assigned recipient (*Signer 1 = Red, Signer 2 = Blue, Signer 3 = Yellow*).
- **Header Actions (④)**:
  - `Save Draft`: Persists placed field coordinates into MongoDB without dispatching.
  - `Send for Signature`: Transitions the envelope into the multi-party routing phase.

### 3. Multi-Party Routing & 2FA OTP Gate (`/send/:pdfId`)
```
+---------------------------------------------------------------------------------------+
|  Signing Order: (•) Sequential Handshake (Signer 1 ➔ Signer 2) <──────────────────────► ⑤ SEQUENTIAL LOGIC
|                                                                                       |
|  Signer 1: [ Alexandre Hamilton ] Email: [ alex@corp.com       ] [x] Require 2FA OTP  |
|  Signer 2: [ Sarah Connor       ] Email: [ sarah@client.com     ] [x] Require 2FA OTP <► ⑥ 2-FACTOR SECURITY
|                                                                                       |
|  Subject:  [ Please review and sign: Consulting Agreement 2026                      ] |
|  [ 🚀 SEND FOR SIGNATURE NOW ➔ ] <────────────────────────────────────────────────────► ⑦ DISPATCH ENVELOPE
+---------------------------------------------------------------------------------------+
```

---

## Journey 4: Signer Experience & Execution Flow
**Full Sequence:** `[Step 1: Recipient Email Inbox] ──► [Step 2: 2FA OTP Gate] ──► [Step 3: Signing Canvas & Cursive Modal] ──► [Step 4: Seal]`

```
[STEP 1: RECIPIENT EMAIL INBOX (GMAIL MOCKUP)]
+---------------------------------------------------------------------------------------+
|  From: Signaturly Vault <notifications@signaturly.com>                                |
|  Subject: Alexandre has requested your signature on "Consulting Agreement 2026"       |
|                                                                                       |
|  "Hi Sarah, please review and sign this agreement at your earliest convenience."     |
|  [ ✍️ REVIEW & SIGN DOCUMENT BUTTON ➔ ] <──────────────────────────────────────────────► ① CLICK INVITATION LINK
+---------------------------------------------------------------------------------------+
                                          │
                                          ▼ (Opens /sign/:token)
[STEP 2: TWO-FACTOR OTP SECURITY GATE]
+---------------------------------------------------------------------------------------+
|  🔒 Enter 6-Digit Passcode sent to sarah@client.com:                                  |
|  [ 4 ] [ 8 ] [ 1 ] [ 9 ] [ 2 ] [ 0 ]                                                  |
|  [ 🟢 VERIFY & ACCESS DOCUMENT ➔ ] <──────────────────────────────────────────────────► ② 2FA AUTHENTICATION
+---------------------------------------------------------------------------------------+
                                          │
                                          ▼
[STEP 3: SIGNING PAGE & ADOPT SIGNATURE MODAL]
+---------------------------------------------------------------------------------------+
|  Click Required Field: [ 👉 Click to Sign ]                                          |
|                                                                                       |
|  ADOPT YOUR SIGNATURE MODAL:                                                          |
|  Enter Name: [ Sarah Connor ]                                                         |
|  Select Cursive Font: (•) Great Vibes  ( ) Dancing Script  ( ) Caveat  ( ) Sacramento |
|  Preview:                                                                             |
|  +---------------------------------------------------------------------------------+  |
|  |                             Sarah Connor                                        |  |
|  +---------------------------------------------------------------------------------+  |
|  [ 🟢 ADOPT & SIGN ➔ ] <──────────────────────────────────────────────────────────────► ③ VECTOR STAMP APPLIED
+---------------------------------------------------------------------------------------+
                                          │
                                          ▼
[STEP 4: SUBMISSION & IMMUTABLE SEAL]
+---------------------------------------------------------------------------------------+
|  [ 🚀 FINISH & SIGN DOCUMENT ➔ ]                                                      |
|  ✓ Document Sealed with SHA-256 Hash Checksum                                         |
|  ✓ Standalone Forensic Certificate of Completion Generated                            |
|  [ ⬇️ Download Signed PDF ]       [ ⬇️ Download Audit Certificate ] <─────────────────► ④ TRANSACTION COMPLETE
+---------------------------------------------------------------------------------------+
```

---

## Journey 5: Document Lifecycle & Voiding Action Flow
**Full Sequence:** `[Step 1: Dashboard Table] ──► [Step 2: Void Action] ──► [Step 3: Reason Modal] ──► [Step 4: Voided State]`

```
[STEP 1: DASHBOARD TABLE]
+---------------------------------------------------------------------------------------+
|  Document: Vendor_Services_Agreement.pdf  •  Status: 🟡 In Progress (Waiting Signer 2)|
|  Actions: [ 👁️ View ]   [ 🔔 Send Reminder ]   [ 🚫 Void Document ] <──────────────────► ① CLICK VOID
+---------------------------------------------------------------------------------------+
                                          │
                                          ▼
[STEP 2: MANDATORY VOID REASON MODAL]
+---------------------------------------------------------------------------------------+
|  ⚠️ ARE YOU SURE YOU WANT TO CANCEL AND VOID THIS ENVELOPE?                           |
|  All signing links will be permanently disabled immediately.                          |
|                                                                                       |
|  Mandatory Justification / Reason:                                                    |
|  [ Terms renegotiated with client. Will re-issue new contract v2. ] <─────────────────► ② AUDIT TRAIL LOGGED
|                                                                                       |
|  [ Cancel ]                                    [ 🔴 CONFIRM VOID DOCUMENT ➔ ] <───────► ③ ENVELOPE CANCELLED
+---------------------------------------------------------------------------------------+
```

---

## Journey 6: Reusable Templates & CSV Bulk Mailmerge Flow
**Full Sequence:** `[Step 1: Template Definition] ──► [Step 2: CSV Upload] ──► [Step 3: Field Mapping] ──► [Step 4: 50+ Batch Dispatched]`

```
[STEP 1: BASE TEMPLATE]                             [STEP 2: CSV RECIPIENT FILE UPLOAD]
+--------------------------------+                  +-----------------------------------+
| Standard NDA Template          |                  | employees_batch_2026.csv (50 Rows)|
| Roles: [Discloser] [Recipient] | ──► (Mailmerge) ─┼──► Columns: Name, Email, Salary  |
+--------------------------------+                  +-----------------------------------+
                                                                      │
                                                                      ▼
[STEP 3: COLUMN MAPPING & BATCH DISPATCH]
+---------------------------------------------------------------------------------------+
|  Template Role / Field                  CSV Column Header                             |
|  ---------------------------------------------------------                            |
|  Signer Name                    ───►   [ employee_name   v]                           |
|  Signer Email                   ───►   [ employee_email  v]                           |
|  Job Title                      ───►   [ role_title      v]                           |
|                                                                                       |
|  [ 🚀 DISPATCH 50 ENVELOPES IN BULK ➔ ] <─────────────────────────────────────────────► ① 50 UNIQUE ENVELOPES SENT
+---------------------------------------------------------------------------------------+
```

---

## Journey 7: AI Signature Background Eraser Flow
**Full Sequence:** `[Step 1: Phone Photo Upload] ──► [Step 2: Threshold Slider] ──► [Step 3: Transparent Stamp Saved]`

```
[STEP 1: RAW SCAN]             [STEP 2: LUMINANCE THRESHOLD SLIDER]         [STEP 3: RESULT]
+---------------------+        +------------------------------------+        +---------------------+
| ░░░░░░░░░░░░░░░░░░░ |        | Slider: [------o------] 1.40x      |        |                     |
| ░░ Alexandre H. ░░░ | ──────►| Web Worker strips yellow paper     | ──────►|    Alexandre H.     |
| ░░ (Paper Shadow) ░ |        | background while preserving ink    |        | (100% Transparent)  |
+---------------------+        +------------------------------------+        +---------------------+
                                                                                        │
                                                                                        ▼
                                                               [ 💾 SAVE AS DEFAULT SIGNATURE ]
```

---

## Journey 8: Public Cryptographic Verification Flow
**Full Sequence:** `[Step 1: /verify Page] ──► [Step 2: Upload PDF / Hash] ──► [Step 3: Non-Repudiation Certificate]`

```
[STEP 1 & 2: PUBLIC LOOKUP (/verify)]
+---------------------------------------------------------------------------------------+
|  🛡️ PUBLIC DOCUMENT INTEGRITY & TAMPER VERIFICATION                                   |
|  [ 📄 Upload Signed PDF ]   OR   [ Enter SHA-256 Checksum: e3b0c44298... ]            |
|  [ 🔍 RUN INTEGRITY VERIFICATION ➔ ]                                                 |
+---------------------------------------------------------------------------------------+
                                          │
                                          ▼
[STEP 3: COURT-ADMISSIBLE VERIFICATION REPORT]
+---------------------------------------------------------------------------------------+
|  STATUS: 🟢 CRYPTOGRAPHICALLY VALID & UNTAMPERED                                      |
|  - Baseline PDF SHA-256 : e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca49599...   |
|  - Sealed PDF SHA-256   : 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c...   |
|  - Signer 1 (IP)        : Alexandre Hamilton (198.51.100.42) • OTP Verified ✓         |
|  - Signer 2 (IP)        : Sarah Connor (203.0.113.19) • OTP Verified ✓                 |
|  - Compliance           : IT Act 2000 Section 10A • 15 U.S.C. § 7001 (US ESIGN)       |
|  [ ⬇️ DOWNLOAD OFFICIAL FORENSIC AUDIT CERTIFICATE ]                                   |
+---------------------------------------------------------------------------------------+
```

---
*End of Signaturly End-to-End User Journeys Manual.*
