# Signaturly — Full Implementation Plan (BoldSign Feature Parity)

> **Last updated:** August 16, 2026  
> **Current Stack:** React + Vite (client) | Express + MongoDB + pdf-lib (server)  
> **Goal:** Transform Signaturly from a self-signing PDF annotator into a full collaborative e-signature platform

---

## Table of Contents

1. [Phase 1 — Core Platform (Critical)](#phase-1--core-platform-critical)
2. [Phase 2 — Workflow & Polish](#phase-2--workflow--polish)
3. [Phase 3 — Growth Features](#phase-3--growth-features)
4. [Appendix — Current Architecture Reference](#appendix--current-architecture-reference)

---

## Phase 1 — Core Platform (Critical)

### 1.1 Send-for-Signing Workflow (Multi-Signer)

This is the **#1 feature gap**. Without it, Signaturly is just a PDF editor, not an e-signature platform.

#### 1.1.1 New Model: `Recipient`

**File:** `server/src/models/Recipient.model.js` [NEW]

```js
const recipientSchema = new mongoose.Schema({
  pdfId: { type: ObjectId, ref: "Pdf", required: true, index: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  role: { type: String, default: "signer" },           // signer | viewer | approver
  signingOrder: { type: Number, default: 1 },           // 1 = first, 2 = second, etc.
  token: { type: String, required: true, unique: true }, // UUID for signing link
  status: {
    type: String,
    enum: ["pending", "sent", "viewed", "signed", "declined"],
    default: "pending"
  },
  signedAt: { type: Date },
  viewedAt: { type: Date },
  declineReason: { type: String },
  color: { type: String },                              // hex color for field assignment
  ipAddress: { type: String },
  userAgent: { type: String },
}, { timestamps: true });
```

**Key decisions:**
- Each recipient gets a unique UUID `token` — this is the signing link (no login needed)
- `signingOrder` enables sequential signing (BoldSign parity)
- `color` enables color-coded field assignment per signer in the editor

#### 1.1.2 Modify Existing Model: `Pdf.model.js`

**File:** `server/src/models/Pdf.model.js` [MODIFY]

Add the following fields:

```diff
+ recipients: [{ type: ObjectId, ref: "Recipient" }],
+ senderId: { type: ObjectId, ref: "User" },          // who created & sent it
+ expiresAt: { type: Date },                           // document expiration
+ message: { type: String },                           // personal message to signers
+ signingOrder: { type: Boolean, default: false },     // enable sequential signing
  status: {
    type: String,
-   enum: ["uploaded", "signed", "failed"],
+   enum: ["draft", "pending", "partially_signed", "signed", "declined", "expired", "voided"],
    default: "draft"
  },
```

#### 1.1.3 Modify Existing Model: `PdfAudit.model.js`

**File:** `server/src/models/PdfAudit.model.js` [MODIFY]

Add richer audit trail fields:

```diff
+ event: {
+   type: String,
+   enum: ["created", "sent", "viewed", "signed", "declined", "expired", "downloaded", "voided"],
+   required: true
+ },
+ actorEmail: { type: String },                  // who triggered this event
+ actorName: { type: String },
+ recipientId: { type: ObjectId, ref: "Recipient" },
+ ipAddress: { type: String },
+ userAgent: { type: String },
+ description: { type: String },                // human-readable event description
```

#### 1.1.4 New Service: `recipient.service.js`

**File:** `server/src/services/recipient.service.js` [NEW]

```
Functions:
├── createRecipients(pdfId, recipientsList) → creates Recipient docs, generates tokens
├── getNextRecipient(pdfId) → returns next signer in order (for sequential signing)
├── markViewed(token, ip, userAgent) → updates status to "viewed", logs audit
├── markSigned(token, fields, ip, userAgent) → updates status to "signed", triggers next
├── markDeclined(token, reason, ip, userAgent) → updates status to "declined"
├── checkAllSigned(pdfId) → returns true if all signers have signed
└── getRecipientByToken(token) → finds recipient + associated PDF data
```

#### 1.1.5 New Service: `send.service.js`

**File:** `server/src/services/send.service.js` [NEW]

```
Functions:
├── sendDocument(pdfId, userId, { recipients, message, expiresAt, signingOrder })
│   → validates PDF ownership
│   → creates Recipient records  
│   → updates PDF status to "pending"
│   → sends email to first signer (or all if parallel)
│   → creates audit log entry (event: "sent")
│   └── returns updated PDF with recipients
│
├── resendToRecipient(pdfId, recipientId, userId)
│   → re-sends email notification to a specific recipient
│
└── voidDocument(pdfId, userId)
    → cancels all pending signing, marks PDF as "voided"
```

#### 1.1.6 New Routes & Controllers

**File:** `server/src/routes/send.routes.js` [NEW]

```
POST   /api/send/:pdfId              → sendDocumentController
POST   /api/send/:pdfId/resend/:recipientId → resendController
POST   /api/send/:pdfId/void         → voidDocumentController
GET    /api/send/:pdfId/status        → getDocumentStatusController
```

**File:** `server/src/routes/signing.routes.js` [NEW]

```
GET    /api/signing/:token            → getSigningPageData (public, no auth)
POST   /api/signing/:token/viewed     → markViewedController (public)
POST   /api/signing/:token/sign       → submitSignatureController (public)
POST   /api/signing/:token/decline    → declineController (public)
```

**File:** `server/src/routes/index.js` [MODIFY]

```diff
+ import sendRoutes from "./send.routes.js";
+ import signingRoutes from "./signing.routes.js";
  
  router.use("/auth", authRoutes);
  router.use("/pdf", pdfRoutes);
  router.use("/pdf", signRoutes);
+ router.use("/send", sendRoutes);
+ router.use("/signing", signingRoutes);
```

#### 1.1.7 New Pages (Client)

**File:** `client/src/pages/SendDocument.jsx` [NEW]

```
Flow:
1. User sees PDF preview (left side) + recipient form (right side)
2. Recipient form fields: Name, Email, Role (signer/viewer), color picker
3. "Add Recipient" button → adds to recipient list below
4. Toggle: "Enable signing order" → shows drag-to-reorder on recipient list
5. Optional: Expiration date picker, personal message textarea
6. "Review & Send" button → navigates to field assignment step

UI Notes:
- Dark theme consistent with rest of app (#08090d, red-600 accents)
- Each recipient gets an auto-assigned color (red, blue, green, purple, amber, cyan)
- Drag-and-drop reordering for signing order
```

**File:** `client/src/pages/AssignFields.jsx` [NEW]

```
Flow:
1. Same PDF editor layout as PdfEditor.jsx
2. Left sidebar shows list of recipients (color-coded)
3. User selects a recipient → all fields placed belong to that recipient
4. Fields are color-coded to match the selected recipient
5. FieldPalette shows tools with the active recipient's color
6. "Send for Signing" button → calls POST /api/send/:pdfId

Key difference from PdfEditor.jsx:
- Fields have a `recipientId` property
- Fields are stored in the database (not just signed immediately)
- No "Sign & Save" — instead "Send for Signing"
```

**File:** `client/src/pages/SigningPage.jsx` [NEW]

```
Flow (Public page — no login required):
1. URL: /sign/:token
2. Loads PDF with pre-placed fields assigned to this recipient
3. Only shows fields assigned to the current signer (others grayed out or hidden)
4. Signer fills in text, selects date, draws/uploads signature
5. "I Agree & Sign" button → POST /api/signing/:token/sign
6. "Decline" button → modal with reason → POST /api/signing/:token/decline
7. Success page: "Document signed! You'll receive a copy by email."

Security:
- Token is a UUID, not guessable
- Token expires with the document
- IP address and user agent recorded on sign/view actions
```

**File:** `client/src/App.jsx` [MODIFY]

```diff
+ import SendDocument from "./pages/SendDocument";
+ import AssignFields from "./pages/AssignFields";
+ import SigningPage from "./pages/SigningPage";

  <Route path="/editor/:pdfId" element={<PdfEditor />} />
+ <Route path="/send/:pdfId" element={<SendDocument />} />
+ <Route path="/assign/:pdfId" element={<AssignFields />} />
+ <Route path="/sign/:token" element={<SigningPage />} />
```

#### 1.1.8 New API Functions (Client)

**File:** `client/src/api/send.api.js` [NEW]

```js
export const sendDocumentApi = async (pdfId, payload) => { ... }
export const getDocumentStatusApi = async (pdfId) => { ... }
export const resendToRecipientApi = async (pdfId, recipientId) => { ... }
export const voidDocumentApi = async (pdfId) => { ... }
```

**File:** `client/src/api/signing.api.js` [NEW]

```js
// These DO NOT use the authenticated API instance (public endpoints)
export const getSigningDataApi = async (token) => { ... }
export const markViewedApi = async (token) => { ... }
export const submitSignatureApi = async (token, fields) => { ... }
export const declineSigningApi = async (token, reason) => { ... }
```

---

### 1.2 Email Notifications

#### 1.2.1 Install Dependencies

```bash
cd server
npm install nodemailer
```

> **Alternative:** Use Resend (`npm install resend`) for easier setup and better deliverability. Resend has a free tier of 100 emails/day.

#### 1.2.2 New Config: Email

**File:** `server/src/config/email.js` [NEW]

```js
import nodemailer from "nodemailer";
import { env } from "./env.js";

const transporter = nodemailer.createTransport({
  host: env.smtpHost,
  port: env.smtpPort,
  secure: env.smtpPort === 465,
  auth: {
    user: env.smtpUser,
    pass: env.smtpPass,
  },
});

export const sendEmail = async ({ to, subject, html }) => {
  return transporter.sendMail({
    from: `"${env.appName}" <${env.smtpFrom}>`,
    to, subject, html,
  });
};
```

#### 1.2.3 Environment Variables

**File:** `server/.env` [MODIFY]

```diff
+ # Email (SMTP)
+ SMTP_HOST=smtp.gmail.com
+ SMTP_PORT=587
+ SMTP_USER=your-email@gmail.com
+ SMTP_PASS=your-app-password
+ SMTP_FROM=noreply@signaturly.com
+ APP_NAME=Signaturly
+ APP_URL=http://localhost:5173
```

**File:** `server/src/config/env.js` [MODIFY]

```diff
+ smtpHost: process.env.SMTP_HOST,
+ smtpPort: parseInt(process.env.SMTP_PORT) || 587,
+ smtpUser: process.env.SMTP_USER,
+ smtpPass: process.env.SMTP_PASS,
+ smtpFrom: process.env.SMTP_FROM,
+ appName: process.env.APP_NAME || "Signaturly",
+ appUrl: process.env.APP_URL || "http://localhost:5173",
```

#### 1.2.4 Email Templates

**File:** `server/src/templates/` [NEW DIRECTORY]

```
templates/
├── signing-request.html    → "You've been asked to sign {docName}"
├── signing-reminder.html   → "Reminder: {docName} awaits your signature"
├── signing-completed.html  → "All parties have signed {docName}"
├── signing-declined.html   → "{recipientName} declined to sign {docName}"
├── document-voided.html    → "{docName} has been voided by the sender"
└── password-reset.html     → "Reset your Signaturly password"
```

Each template should:
- Use inline CSS (email compatibility)
- Include Signaturly branding (red accent, dark header)
- Have a clear CTA button ("Review & Sign", "View Document", etc.)
- Include document name, sender name, optional personal message
- Include a signing link: `{appUrl}/sign/{token}`

#### 1.2.5 New Service: `email.service.js`

**File:** `server/src/services/email.service.js` [NEW]

```
Functions:
├── sendSigningRequest(recipient, pdf, sender, message)
├── sendReminder(recipient, pdf, sender)
├── sendCompletionNotice(pdf, sender, recipients)
├── sendDeclineNotice(pdf, sender, declinedRecipient)
├── sendVoidNotice(pdf, recipients)
└── sendPasswordReset(user, resetToken)
```

---

### 1.3 Draw / Type Signature in Editor

Currently, the `SignatureUpload` component in the editor only allows image file upload. The `RemoveBg.jsx` page already has a working `SignaturePad` canvas component — but it's buried in the Signature Studio page, not available in the PDF editor.

#### 1.3.1 Extract & Enhance SignaturePad

**File:** `client/src/components/SignaturePad.jsx` [NEW]

Extract the `SignaturePad` component from `RemoveBg.jsx` (lines 6-118) into its own reusable component file. Keep the same canvas drawing logic but add:
- Color picker (black, blue, red)
- Stroke width control
- Undo last stroke button

#### 1.3.2 New Component: TypeSignature

**File:** `client/src/components/TypeSignature.jsx` [NEW]

```
- Text input field
- Font selector dropdown with 4-5 cursive/script fonts:
  - "Dancing Script" (Google Font)
  - "Great Vibes" (Google Font)
  - "Pacifico" (Google Font)
  - "Caveat" (Google Font)
  - "Sacramento" (Google Font)
- Live preview of the typed name in selected font
- "Use This Signature" button → converts to canvas → exports as PNG data URL
```

Implementation: Use an off-screen `<canvas>` to render the text in the selected font, then call `canvas.toDataURL("image/png")` to produce the signature image.

#### 1.3.3 Refactor SignatureUpload → SignatureManager

**File:** `client/src/components/SignatureUpload.jsx` [MODIFY → RENAME to `SignatureManager.jsx`]

```
Tabbed interface:
┌──────────┬──────────┬──────────┐
│  Draw    │  Type    │  Upload  │
└──────────┴──────────┴──────────┘

Tab 1 (Draw): <SignaturePad />
Tab 2 (Type): <TypeSignature />
Tab 3 (Upload): Current file upload logic (keep existing code)

All three tabs output the same thing: a PNG data URL string via onUploaded(dataUrl)
```

Remove the Cloudinary upload code entirely — it's unused (base64 is passed directly) and exposes credentials.

#### 1.3.4 New Model: `SignatureAsset`

**File:** `server/src/models/SignatureAsset.model.js` [NEW]

```js
const signatureAssetSchema = new mongoose.Schema({
  userId: { type: ObjectId, ref: "User", required: true, index: true },
  type: { type: String, enum: ["draw", "type", "upload"], required: true },
  dataUrl: { type: String, required: true },      // base64 PNG data URL
  label: { type: String },                         // e.g., font name or "My Signature"
  isDefault: { type: Boolean, default: false },
}, { timestamps: true });
```

This allows users to save and reuse signatures across documents (BoldSign parity).

#### 1.3.5 New Routes for Signatures

**File:** `server/src/routes/signature.routes.js` [NEW]

```
GET    /api/signatures            → list user's saved signatures
POST   /api/signatures            → save a new signature
DELETE /api/signatures/:id        → delete a saved signature
PATCH  /api/signatures/:id/default → set as default signature
```

---

### 1.4 Design Consistency Fix

#### 1.4.1 Unify Login & Register Pages

**Files:** `client/src/pages/Login.jsx`, `client/src/pages/Register.jsx` [MODIFY]

Problem: Login/Register use orange accents, white cards, and a light `bg-gradient-to-br from-gray-900 to-blue-900` background. The rest of the app uses red accents on `#08090d` dark background.

Changes:
- Background: `bg-[#08090d]` (matching Dashboard/Editor)
- Card background: `bg-[#12141c]` with `border border-white/10`
- Primary button: `bg-gradient-to-r from-red-600 to-red-800`
- Accent color: `red-500` instead of `orange-500`
- Input fields: `bg-[#08090d] border border-white/10 text-white`
- Labels: `text-gray-400` instead of `text-gray-700`
- "Forgot password" and "Create account" links: `text-red-400 hover:text-red-300`
- Add Signaturly logo at top (same as Navbar)

#### 1.4.2 Style FieldPalette Component

**File:** `client/src/components/FieldPalette.jsx` [MODIFY]

Current code is completely unstyled:
```jsx
<button className="border px-3 py-2 w-full">Add {type}</button>
```

Replace with styled buttons matching the dark theme, each with an appropriate icon:

```jsx
const FIELD_CONFIG = {
  signature: { icon: PenIcon, label: "Signature", color: "red" },
  text:      { icon: TextIcon, label: "Text Field", color: "blue" },
  date:      { icon: CalendarIcon, label: "Date", color: "purple" },
  radio:     { icon: CircleIcon, label: "Radio Button", color: "amber" },
  checkbox:  { icon: CheckIcon, label: "Checkbox", color: "emerald" },
  dropdown:  { icon: ListIcon, label: "Dropdown", color: "cyan" },
  initials:  { icon: InitialsIcon, label: "Initials", color: "pink" },
};
```

Each button should be:
- Dark background (`bg-white/5 hover:bg-white/10`)
- Left-aligned icon + label
- Matching accent color for the icon
- Consistent rounded corners (`rounded-xl`)

---

### 1.5 Security Fixes

#### 1.5.1 Secure File Serving

**File:** `server/src/app.js` [MODIFY]

Currently signed PDFs are served as unprotected static files:
```js
app.use("/uploads", express.static(path.resolve("uploads")));
```

Replace with authenticated file serving:

```diff
- app.use("/uploads", express.static(path.resolve("uploads")));
+ import { serveProtectedFile } from "./middlewares/file.middleware.js";
+ app.use("/uploads", serveProtectedFile);
```

**File:** `server/src/middlewares/file.middleware.js` [NEW]

```js
// Validates that the requesting user owns the file OR is a recipient
// Falls through to express.static if authorized
export const serveProtectedFile = async (req, res, next) => {
  // Extract userId from path: /uploads/:userId/:filename
  // Verify JWT token from Authorization header OR query param ?token=xxx
  // Allow if:
  //   1. req.user.id === userId (owner)
  //   2. OR the file's PDF has a recipient with a valid token
  // Deny with 403 otherwise
};
```

#### 1.5.2 Remove Hardcoded Cloudinary Credentials

**File:** `client/src/components/SignatureUpload.jsx` [MODIFY]

Remove the `uploadToCloudinary` function entirely (lines 24-49). The base64 data URL approach already works and is used by default. The Cloudinary code exposes `upload_preset: "suleman"` and cloud name `dez68hqzq` to the client.

#### 1.5.3 Strengthen JWT Secrets

**File:** `server/.env` [MODIFY]

```diff
- JWT_ACCESS_SECRET=access_secret_123
- JWT_REFRESH_SECRET=refresh_secret_456
+ JWT_ACCESS_SECRET=<generate a 64-char random hex string>
+ JWT_REFRESH_SECRET=<generate a different 64-char random hex string>
```

Use `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` to generate.

#### 1.5.4 Remove Password Logging

**File:** `server/src/services/auth.service.js` [MODIFY]

Remove these lines:
```diff
- console.log("🔵 [registerUser] Received password:", password);
- console.log("🔵 [loginUser] Received password for comparison.");
```

---

### 1.6 Dashboard Enhancements

#### 1.6.1 New Status Categories

**File:** `client/src/pages/Dashboard.jsx` [MODIFY]

Update the filter tabs and stats to reflect the new document statuses:

```
Stats cards (expand from 3 to 5):
├── Total Documents
├── Awaiting My Signature (I'm a recipient, haven't signed)
├── Waiting for Others (I sent, waiting on recipients)
├── Completed (all signed)
└── Draft / Expired / Voided

Filter tabs:
├── All
├── Needs My Signature
├── Sent (Waiting for Others)
├── Completed
├── Draft
└── Expired / Voided
```

#### 1.6.2 Document Card Actions Update

Each document card should show:
- **For documents I own:** "Edit" | "Send" | "View Audit" | "Void" | "Delete"
- **For documents sent to me:** "Sign Now" | "Decline" | "View"
- Progress indicator: "2 of 3 signed" with colored dots per recipient

---

## Phase 2 — Workflow & Polish

### 2.1 Templates System

#### 2.1.1 New Model: `Template`

**File:** `server/src/models/Template.model.js` [NEW]

```js
const templateSchema = new mongoose.Schema({
  userId: { type: ObjectId, ref: "User", required: true, index: true },
  name: { type: String, required: true },
  description: { type: String },
  
  // Store the original PDF reference
  sourcePdfPath: { type: String, required: true },
  pageCount: { type: Number, required: true },
  
  // Pre-configured roles (not specific people, just role names)
  roles: [{
    name: { type: String, required: true },       // e.g., "Client", "Agent", "Witness"
    color: { type: String, required: true },
    signingOrder: { type: Number, default: 1 },
  }],
  
  // Pre-placed fields with role assignments (not recipient IDs)
  fields: [{
    type: { type: String, required: true },
    roleName: { type: String, required: true },    // which role this field belongs to
    page: { type: Number, required: true },
    xPercent: Number,
    yPercent: Number,
    widthPercent: Number,
    heightPercent: Number,
    label: String,
    required: { type: Boolean, default: true },
  }],
  
  usageCount: { type: Number, default: 0 },
}, { timestamps: true });
```

#### 2.1.2 Template Routes

**File:** `server/src/routes/template.routes.js` [NEW]

```
GET    /api/templates              → list user's templates
POST   /api/templates              → create template (from existing doc or upload)
GET    /api/templates/:id          → get template details
PUT    /api/templates/:id          → update template
DELETE /api/templates/:id          → delete template
POST   /api/templates/:id/use      → create new document from template
```

#### 2.1.3 Client Pages

**File:** `client/src/pages/Templates.jsx` [NEW]

```
Template gallery page:
- Grid of template cards (similar to Dashboard document cards)
- "Create Template" button
- Each card shows: name, page count, number of roles, usage count
- Actions: "Use Template" | "Edit" | "Delete"
```

**File:** `client/src/pages/TemplateEditor.jsx` [NEW]

```
Similar to AssignFields.jsx but:
- Instead of specific recipients, user defines "roles" (e.g., "Client", "Witness")
- Fields are assigned to roles, not people
- "Save Template" button instead of "Send"
```

**File:** `client/src/pages/UseTemplate.jsx` [NEW]

```
Flow:
1. Select template → show role list
2. Assign actual people (name + email) to each role
3. Optionally modify fields
4. Send for signing
```

Add to Navbar:
```diff
  const navLinks = [
    { label: "Dashboard", path: "/dashboard" },
    { label: "Upload PDF", path: "/upload" },
+   { label: "Templates", path: "/templates" },
    { label: "Signature Studio", path: "/signature-remover" },
  ];
```

---

### 2.2 More Form Field Types

#### 2.2.1 Add Checkbox Field

**File:** `client/src/utils/constants.js` [MODIFY]

```diff
  export const FIELD_TYPES = {
    SIGNATURE: "signature",
    TEXT: "text",
    DATE: "date",
    RADIO: "radio",
+   CHECKBOX: "checkbox",
+   DROPDOWN: "dropdown",
+   INITIALS: "initials",
  };
```

#### 2.2.2 Update DraggableField for New Types

**File:** `client/src/components/DraggableField.jsx` [MODIFY]

Add render functions:

```js
// Checkbox: Square with checkmark when checked
const renderCheckboxField = () => (
  <div className="w-full h-full flex items-center justify-center">
    <div className={`rounded border-2 cursor-pointer flex items-center justify-center ${
      localField.checked ? "bg-red-600 border-red-600" : "bg-white border-gray-400"
    }`} style={{ width: size, height: size }}
      onClick={() => handleUpdate({ checked: !localField.checked })}>
      {localField.checked && <CheckIcon />}
    </div>
  </div>
);

// Dropdown: Select element with options
const renderDropdownField = () => (
  <select value={localField.value} onChange={...}
    className="w-full h-full bg-white text-gray-900 border-0 rounded">
    <option value="">Select...</option>
    {(localField.options || []).map(opt => <option key={opt}>{opt}</option>)}
  </select>
);

// Initials: Small signature-like field, auto-filled with user's initials
const renderInitialsField = () => (
  // Similar to signature but smaller, shows first letters of name
);
```

#### 2.2.3 Update PDF Signing Service

**File:** `server/src/services/pdfSign.service.js` [MODIFY]

Add cases in the `switch (field.type)` block for:
- `checkbox`: Draw a filled square or checkmark symbol
- `dropdown`: Draw the selected text value
- `initials`: Draw initials text or embedded initials image

---

### 2.3 Settings & Profile Page

#### 2.3.1 New Page

**File:** `client/src/pages/Settings.jsx` [NEW]

```
Tabs:
├── Profile
│   ├── Name (editable)
│   ├── Email (read-only)
│   ├── Avatar / initials
│   └── "Save Changes" button
│
├── Security
│   ├── Change Password (current + new + confirm)
│   └── Active Sessions (future)
│
├── Signatures
│   ├── Saved signatures grid
│   ├── Set default signature
│   ├── Delete saved signatures
│   └── "Add New Signature" → opens SignatureManager
│
└── Notifications (future)
    ├── Email on document sent
    ├── Email on document signed
    ├── Email on document declined
    └── Reminder frequency
```

#### 2.3.2 New Routes

**File:** `server/src/routes/user.routes.js` [NEW]

```
GET    /api/user/profile          → get current user profile
PUT    /api/user/profile          → update name
PUT    /api/user/password         → change password (requires current password)
```

---

### 2.4 Forgot Password Flow

#### 2.4.1 New Model: `PasswordReset`

**File:** `server/src/models/PasswordReset.model.js` [NEW]

```js
const passwordResetSchema = new mongoose.Schema({
  userId: { type: ObjectId, ref: "User", required: true },
  token: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },           // 1 hour from creation
  used: { type: Boolean, default: false },
}, { timestamps: true });
```

#### 2.4.2 Routes

**File:** `server/src/routes/auth.routes.js` [MODIFY]

```diff
+ router.post("/forgot-password", forgotPasswordController);
+ router.post("/reset-password", resetPasswordController);
```

#### 2.4.3 Flow

1. User enters email on `/forgot-password` page
2. Server generates a token, stores in `PasswordReset`, sends email
3. Email contains link: `{APP_URL}/reset-password?token=xxx`
4. User clicks link → `/reset-password` page → enters new password
5. Server verifies token, hashes new password, updates user, marks token as used

#### 2.4.4 Client Pages

**File:** `client/src/pages/ForgotPassword.jsx` [NEW]  
**File:** `client/src/pages/ResetPassword.jsx` [NEW]

---

### 2.5 Richer Audit Trail

#### 2.5.1 Audit Certificate PDF Generation

**File:** `server/src/services/auditCertificate.service.js` [NEW]

Generates a PDF audit certificate (similar to BoldSign) containing:
- Document title and ID
- SHA-256 hash of original document
- SHA-256 hash of signed document
- Timeline of all events (created → sent → viewed → signed)
- For each signer: name, email, IP, timestamp, status
- Signaturly branding and tamper-evident notice

Use `pdf-lib` (already installed) to generate this PDF.

#### 2.5.2 New Route

**File:** `server/src/routes/pdf.routes.js` [MODIFY]

```diff
+ router.get("/:id/audit-certificate", protect, getAuditCertificateController);
```

#### 2.5.3 Combined Download

Optionally append the audit certificate as the last page(s) of the signed PDF:

```
POST /api/pdf/:id/download?includeAudit=true
```

---

## Phase 3 — Growth Features

### 3.1 Landing Page

**File:** `client/src/pages/Landing.jsx` [NEW]

```
Sections:
├── Hero: "Sign documents faster, smarter, securely" + CTA buttons
├── Features grid: Send for signing, Templates, Audit trails, etc.
├── How it works: 3-step visual (Upload → Add signers → Done)
├── Trust/security badges: SHA-256, encryption icons
├── Pricing cards (if applicable)
└── Footer: Links, social, copyright

Design: Full dark theme, gradient hero section, animated feature cards
```

**File:** `client/src/pages/HomeRedirect.jsx` [MODIFY]

```diff
- // Currently redirects to /dashboard or /login
+ // Show Landing page for unauthenticated users
+ // Redirect to /dashboard for authenticated users
```

---

### 3.2 Automated Reminders

#### 3.2.1 Reminder Logic

**File:** `server/src/services/reminder.service.js` [NEW]

```
Cron job (runs every hour):
1. Find all PDFs where status === "pending" and expiresAt > now
2. For each, find recipients where status === "sent" or "viewed" (not signed)
3. Check last reminder timestamp
4. If > reminderInterval days since last reminder → send reminder email
5. Log reminder event in audit trail
```

**File:** `server/src/config/cron.js` [NEW]

```bash
npm install node-cron
```

```js
import cron from "node-cron";
import { processReminders } from "../services/reminder.service.js";
import { processExpirations } from "../services/expiration.service.js";

// Every hour: check for reminders to send
cron.schedule("0 * * * *", processReminders);

// Every hour: check for expired documents
cron.schedule("30 * * * *", processExpirations);
```

---

### 3.3 Bulk Sending

#### 3.3.1 Flow

1. User selects a template from template gallery
2. Clicks "Bulk Send"
3. Uploads a CSV file with columns: Name, Email, [custom fields]
4. Preview shows the list of recipients parsed from CSV
5. "Send All" → creates individual PDF copies + recipients for each row
6. Dashboard shows bulk send as a group with progress tracking

#### 3.3.2 Files

**File:** `server/src/services/bulkSend.service.js` [NEW]  
**File:** `server/src/routes/bulk.routes.js` [NEW]  
**File:** `client/src/pages/BulkSend.jsx` [NEW]

```
POST /api/bulk/send
Body: { templateId, csvData: [{ name, email, ...customFields }] }
```

---

### 3.4 Mobile-Responsive Editor

**File:** `client/src/pages/PdfEditor.jsx` [MODIFY]

Current issues on mobile:
- Sidebar is fixed at `w-80` — takes entire screen on mobile
- PDF viewer doesn't zoom/pan on touch
- Field toolbar overlaps on small screens

Improvements:
- Bottom sheet pattern for sidebar on mobile (slide-up panel)
- Pinch-to-zoom on PDF viewer
- Floating action button (FAB) for "Add Field" on mobile
- Touch-friendly field manipulation (larger hit targets)

---

## Appendix — Current Architecture Reference

### Current File Tree
```
Signaturly/
├── client/
│   └── src/
│       ├── api/
│       │   ├── auth.api.js
│       │   ├── axios.js          (interceptors, token refresh)
│       │   └── pdf.api.js
│       ├── components/
│       │   ├── DraggableField.jsx (drag + resize + inline edit)
│       │   ├── FieldPalette.jsx   (⚠️ unstyled)
│       │   ├── Navbar.jsx
│       │   ├── PdfViewer.jsx
│       │   └── SignatureUpload.jsx (⚠️ has Cloudinary creds)
│       ├── pages/
│       │   ├── Dashboard.jsx
│       │   ├── HomeRedirect.jsx
│       │   ├── Login.jsx          (⚠️ inconsistent theme)
│       │   ├── PdfEditor.jsx
│       │   ├── Register.jsx       (⚠️ inconsistent theme)
│       │   ├── RemoveBg.jsx       (Signature Studio - has draw pad)
│       │   └── UploadPdf.jsx
│       ├── store/
│       │   ├── authActions.js
│       │   ├── authSlice.js
│       │   └── store.js
│       ├── utils/
│       │   └── constants.js       (4 field types only)
│       ├── workers/
│       │   └── signature.worker.js
│       ├── App.jsx
│       └── main.jsx
│
└── server/
    └── src/
        ├── config/
        │   ├── db.js
        │   ├── env.js
        │   └── multer.js
        ├── controllers/
        │   ├── auth.controller.js
        │   ├── pdf.controller.js
        │   └── sign.controller.js
        ├── middlewares/
        │   ├── auth.middleware.js
        │   └── error.middleware.js
        ├── models/
        │   ├── Pdf.model.js       (userId, fileName, hash, status, pageCount)
        │   ├── PdfAudit.model.js  (pdfId, hashes, fieldsMeta, signedAt)
        │   └── User.model.js     (name, email, password, JWT methods)
        ├── routes/
        │   ├── auth.routes.js
        │   ├── index.js
        │   ├── pdf.routes.js
        │   └── sign.routes.js
        ├── services/
        │   ├── auth.service.js    (⚠️ logs passwords)
        │   ├── coordinate.service.js
        │   ├── hash.service.js
        │   ├── pdfSign.service.js (field→PDF embedding)
        │   └── pdfUpload.service.js
        ├── utils/
        │   ├── ApiError.js
        │   ├── ApiResponse.js
        │   ├── asyncHandler.js
        │   └── file.utils.js
        ├── app.js                 (⚠️ unprotected /uploads static)
        └── server.js
```

### New Files Summary (All Phases)

```
SERVER — New Files:
├── models/Recipient.model.js
├── models/Template.model.js
├── models/SignatureAsset.model.js
├── models/PasswordReset.model.js
├── services/recipient.service.js
├── services/send.service.js
├── services/email.service.js
├── services/reminder.service.js
├── services/expiration.service.js
├── services/auditCertificate.service.js
├── services/bulkSend.service.js
├── routes/send.routes.js
├── routes/signing.routes.js
├── routes/template.routes.js
├── routes/signature.routes.js
├── routes/user.routes.js
├── routes/bulk.routes.js
├── controllers/send.controller.js
├── controllers/signing.controller.js
├── controllers/template.controller.js
├── controllers/signature.controller.js
├── controllers/user.controller.js
├── middlewares/file.middleware.js
├── config/email.js
├── config/cron.js
└── templates/ (6 HTML email templates)

CLIENT — New Files:
├── pages/SendDocument.jsx
├── pages/AssignFields.jsx
├── pages/SigningPage.jsx
├── pages/Templates.jsx
├── pages/TemplateEditor.jsx
├── pages/UseTemplate.jsx
├── pages/Settings.jsx
├── pages/ForgotPassword.jsx
├── pages/ResetPassword.jsx
├── pages/Landing.jsx
├── pages/BulkSend.jsx
├── components/SignaturePad.jsx (extracted from RemoveBg)
├── components/TypeSignature.jsx
├── components/SignatureManager.jsx (replaces SignatureUpload)
├── api/send.api.js
├── api/signing.api.js
├── api/template.api.js
├── api/signature.api.js
└── api/user.api.js

SERVER — Modified Files:
├── models/Pdf.model.js (new fields, expanded status enum)
├── models/PdfAudit.model.js (new event tracking fields)
├── services/auth.service.js (remove password logging)
├── services/pdfSign.service.js (new field type cases)
├── routes/index.js (register new route modules)
├── config/env.js (email + app config)
├── app.js (protected file serving)
└── .env (email creds, stronger JWT secrets)

CLIENT — Modified Files:
├── App.jsx (new routes)
├── pages/Dashboard.jsx (new statuses, enriched cards)
├── pages/Login.jsx (dark theme)
├── pages/Register.jsx (dark theme)
├── pages/HomeRedirect.jsx (landing page logic)
├── components/FieldPalette.jsx (styled with icons)
├── components/DraggableField.jsx (new field type renderers)
├── components/Navbar.jsx (Templates link)
└── utils/constants.js (new field types)
```

### NPM Dependencies to Install

```bash
# Server
cd server
npm install nodemailer node-cron uuid

# Client
cd client
npm install react-signature-canvas
```

### Priority Order for Implementation

```
1. Security fixes (1.5)                    → 1-2 hours
2. Design consistency (1.4)                → 2-3 hours
3. Draw/Type signature (1.3)               → 3-4 hours
4. Recipient model + send flow (1.1)       → 2-3 days
5. Email notifications (1.2)               → 1 day
6. Dashboard enhancements (1.6)            → 1 day
7. More field types (2.2)                   → 1 day
8. Settings page (2.3)                     → 4-5 hours
9. Forgot password (2.4)                   → 3-4 hours
10. Templates system (2.1)                 → 2-3 days
11. Audit certificate PDF (2.5)            → 1 day
12. Landing page (3.1)                     → 1 day
13. Automated reminders (3.2)              → 4-5 hours
14. Bulk sending (3.3)                     → 2-3 days
15. Mobile-responsive editor (3.4)         → 2-3 days
```

---

> **Total estimated effort:** ~3-4 weeks for a solo developer working full-time.  
> **Phase 1 alone** transforms Signaturly from a self-signing tool into a legitimate e-signature platform.
