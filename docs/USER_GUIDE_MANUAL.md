# 📖 Signaturly Pro - Complete User Guide & Application Manual

---

## 📌 1. Executive Summary & Legal Compliance Framework

**Signaturly Pro** is an enterprise-grade electronic signature and document management platform built for legal enforceability, statutory audit integrity, and streamlined contract execution.

### Global Legal Compliance Standards
- **US ESIGN Act (15 U.S.C. § 7001)**: Mandatory electronic record disclosure, explicit intent capture, SHA-256 tamper-evident checksums, and immutable audit certificate generation.
- **Section 10A Indian IT Act 2000**: Statutory validity of electronic contracts, multi-factor recipient verification (Email OTP), and timestamped IP logging.
- **EU eIDAS Regulation (No 910/2014)**: Advanced Electronic Signature (AES) standards, cryptographic checksums, and biometric signature canvas logging.

---

## 🗺️ 2. Comprehensive Page-by-Page Application Breakdown

---

### Page 1: Home Redirect & Marketing Landing Page (`/` and `/landing`)
- **Purpose**: Primary marketing hub showcasing platform capabilities, legal compliance trust badges, interactive demo previews, features, and quick onboarding.
- **Key Features**:
  - **Hero Header**: Action buttons for instant registration and interactive guide access.
  - **Feature Showcase**: Detailed cards highlighting legal audit trails, prebuilt contracts, and OTP authorization.
  - **Security Section**: SHA-256 hash verification engine preview.

---

### Page 2: User Sign In Vault (`/login`)
- **Purpose**: Secure authentication portal for existing users to access their document vault and contract workspace.
- **Key Features**:
  - **Email Normalization**: Automated trimming and lowercasing (`suleman@gmail.com`).
  - **Password Visibility Toggle**: Hide/reveal password option.
  - **Recovery Link**: Instant access to `/forgot-password`.
  - **Token Management**: JWT Access and HTTP-only Refresh Token authentication.

---

### Page 3: Account Registration & Statutory Consent Gate (`/register`)
- **Purpose**: New user onboarding portal equipped with a mandatory, non-bypassable Terms & Conditions legal consent modal.
- **Key Features**:
  - **Registration Form**: Full Name, Email Address, and Password fields.
  - **`TermsConsentModal`**: Renders ESIGN, IT Act 2000, and eIDAS disclosures.
  - **Dual Statutory Checkboxes**: Mandatory explicit consent required before the "Accept & Proceed" button unlocks.

---

### Page 4: Password Recovery & Reset Portal (`/forgot-password` and `/reset-password`)
- **Purpose**: Self-service account recovery workflow utilizing 1-hour expiration UUID tokens.
- **Key Features**:
  - **Reset Dispatch**: Email submission triggering single-use reset links.
  - **Password Complexity Check**: Minimum 6-character password policy enforcement.

---

### Page 5: Document Vault & Workspace Dashboard (`/dashboard`)
- **Purpose**: Central management console for executed agreements, pending signers, drafts, and document metrics.
- **Key Features**:
  - **Vault Metrics Cards**: Live counters for Total Documents, In Progress, Completed, and Drafts.
  - **Filter Tabs**: Toggle between All Docs, In Progress, Completed, Drafts, and Declined/Void.
  - **Real-Time Search Bar**: Instant title-based search filtering.
  - **Quick Actions**: One-click shortcuts for "Upload PDF", "Use Template", and "Download Audit Certificate".

---

### Page 6: PDF Document Upload & Processing Engine (`/upload`)
- **Purpose**: Portal for uploading custom PDF contracts into the Signaturly processing pipeline.
- **Key Features**:
  - **Drag-and-Drop Area**: File drop zone supporting PDFs up to 50MB.
  - **Parsing Engine**: Automatic page count extraction, thumbnail generation, and title parsing.

---

### Page 7: Visual Canvas Field Assignment Studio (`/assign/:pdfId`)
- **Purpose**: Interactive studio for placing signature fields, dates, text inputs, and checkboxes onto PDF pages.
- **Key Features**:
  - **Drag-and-Drop Elements**: Signature, Initials, Date, Text, and Checkbox.
  - **Multi-Recipient Color Coding**: Visual role assignment with distinct hex colors per signer.
  - **DPI Coordinate Mapper**: Converts browser canvas coordinates to 72 DPI PDF point space.

---

### Page 8: Recipient Dispatch & Security Settings (`/send/:pdfId`)
- **Purpose**: Configuration screen for defining signers, signing order, email OTP, and expiration dates.
- **Key Features**:
  - **Sequential Order Control**: Strict signing sequence enforcement (Signer 1 -> Signer 2).
  - **Email OTP Verification**: Optional 6-digit passcode authorization prior to signature access.
  - **Document Expiration & Reminders**: Calendar expiration picker and automated reminder schedule toggle.

---

### Page 9: Interactive Recipient Signing Portal (`/sign/:token`)
- **Purpose**: Secure portal for signers to execute documents via unique UUID tokens.
- **Key Features**:
  - **OTP Authentication Gate**: One-Time Password verification step for passcode-protected documents.
  - **Signature Studio**: Drawn signatures, typed names with custom calligraphic fonts, and uploaded signature image seals.
  - **Completion Bar**: Enforces completion of all required fields prior to final submission.
  - **Execution Engine**: `pdf-lib` form flattening, SHA-256 hashing, and Audit Certificate attachment.

---

### Page 10: PDF Document Viewer & Audit Inspector (`/editor/:pdfId`)
- **Purpose**: Read-only inspection suite for reviewing signed documents and audit trail histories.
- **Key Features**:
  - **Multi-Page Canvas Viewer**: High-resolution rendering of flattened PDF contracts.
  - **Audit Log Timeline**: Complete timeline showing recipient IP addresses, timestamps, and hash states.

---

### Page 11: Pre-built Statutory Contract Template Suite (`/templates`)
- **Purpose**: Library of 14 pre-built, legally compliant contract templates ready for instant dispatch.
- **Key Features**:
  - **14 Pre-built Contracts**: Mutual NDA, Employment Offer Letter, Independent Contractor Agreement, Residential Lease, Sales SOW, Master Services Agreement (MSA), IP Assignment, SaaS Licensing, Commercial Lease, General Partnership, Bill of Sale, Promissory Note, Settlement Release, Corporate Board Resolution.
  - **Category Filters**: Filter by Legal & Corporate, Real Estate, HR, Sales, Consulting, and Financial.
  - **Instant Preview & Use**: One-click contract instantiation.

---

### Page 12: CSV Bulk Dispatch Studio (`/templates/bulk`)
- **Purpose**: Batch campaign generator for sending contracts to hundreds of recipients simultaneously via CSV upload.
- **Key Features**:
  - **CSV Downloader & Parser**: Sample CSV template download and row parsing.
  - **Role Column Mapping**: Map CSV data headers to contract signer roles.
  - **Batch Engine**: Mass token generation and asynchronous email dispatch with progress tracker.

---

### Page 13: Template Customization & Instantiation Studio (`/templates/edit/:templateId` and `/templates/use/:templateId`)
- **Purpose**: Interface for editing template field anchors and initializing pre-placed field instances.
- **Key Features**:
  - **Pre-Placed Anchors**: Pre-configured signature and date field layouts.
  - **Dynamic Instantiation**: Instant PDF document creation from template definitions.

---

### Page 14: Signature Studio & Background Eraser Tool (`/signature-remover`)
- **Purpose**: Utility tool for removing background noise and making physical handwritten signature uploads transparent.
- **Key Features**:
  - **Threshold Background Eraser**: Converts white/paper backgrounds to transparent PNG channels.
  - **Contrast & Crop Controls**: Rotation, cropping, and contrast adjustments.

---

### Page 15: User Profile & Security Preferences (`/settings`)
- **Purpose**: User management screen for profile settings, password changes, and API preferences.
- **Key Features**:
  - **Account Profile**: Name and email modification.
  - **Password Updates**: Password change form.
  - **Terms Acceptance Audit Badge**: Displays statutory terms version (`v1.0.0`), UTC acceptance timestamp, and recorded IP address.

---

### Page 16: Public Cryptographic Verification Portal (`/verify`)
- **Purpose**: Publicly accessible verification tool for validating document authenticity and tamper integrity.
- **Key Features**:
  - **Drag-and-Drop Hash Inspector**: Upload any executed PDF to verify its SHA-256 checksum.
  - **Database Hash Lookup**: Compares document hashes against the immutable database audit ledger.

---

### Page 17: Superadmin Oversight & System Analytics (`/admin/login` and `/admin/dashboard`)
- **Purpose**: Admin console for monitoring platform performance, user accounts, and system health.
- **Key Features**:
  - **Admin Secret Key Auth**: Isolated administrative authentication flow.
  - **Platform Metrics**: Total Users, Total PDFs Executed, Storage Usage, and System Logs.
  - **Account Controls**: User suspension and document revocation management.

---

### Page 18: Interactive Online User Documentation Suite (`/userguide`)
- **Purpose**: Built-in interactive documentation suite accessible directly within the application web interface.
- **Key Features**:
  - **Searchable Sidebar**: Interactive topic navigation.
  - **Visual Walkthroughs**: Embedded visual guides and step-by-step instructions.

---

### Page 19: Font & Canvas Render Sandbox (`/test`)
- **Purpose**: Isolated testing lab for verifying custom signature font rendering and canvas flattening.
- **Key Features**:
  - **Live Font Sandbox**: Preview signature fonts (Dancing Script, Great Vibes, Pacifico, Alex Brush).
  - **Canvas Render Verification**: `pdf-lib` bitmap output inspector.

---
*Signaturly Pro © 2026. Complete User Manual & System Guide.*
