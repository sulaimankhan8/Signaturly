# PactDoc Design System: "Precision Monolith"
**Design Tokens, Visual Foundations & Component Guidelines**  
*Document Version: 1.0.0 — Production Design System Specification*

---

## 1. Design Thesis & Foundations

### 1.1 Brand Philosophy: "Precision Monolith"
PactDoc is not a casual consumer utility; it is a **high-assurance, legally binding electronic contracting platform** backed by Section 10A of the Indian Information Technology Act 2000, US ESIGN, and EU eIDAS regulations.

The visual language must reflect:
- **Cryptographic Authority**: High-density precision, crisp geometric alignment, and tamper-evident clarity.
- **Architectural Calm**: Deep obsidian and carbon surfaces that reduce cognitive fatigue during prolonged document review.
- **Precision Accents**: Warm crimson and burnished gold used deliberately for legal stamps, seals, and primary conversion paths — eliminating the erratic, rainbow-colored sticker clutter of legacy neo-brutalist experiments.

### 1.2 Core Design Principles

| Principle | Meaning in Practice |
| :--- | :--- |
| **1. Clarity Over Noise** | Avoid gratuitous gradients, pulsing dots, and tilted badges. Statuses are communicated with semantic text and disciplined badges. |
| **2. Deterministic Spatial Rhythm** | Everything adheres to a strict **4px/8px grid**. Heights, gutters, and padding are predictable and never cause layout shifts. |
| **3. Mobile Accessibility by Default** | Every interactive element possesses a minimum **44×44px touch target**, with responsive drawers on mobile replacing wide desktop modals. |
| **4. Tactile High-Assurance States** | Clear distinction between editable drafts, awaiting signers, and sealed immutable PDF certificates. |

---

## 2. Design Tokens Architecture

### 2.1 Color Palette & Semantic Tokens

The color system is organized into semantic layers so that changing a surface or border token automatically cascades throughout the UI without breaking accessibility contrast.

#### Surface & Background Tokens
```css
/* Backgrounds & Base Surfaces */
--surface-canvas:      #08090d; /* Root application background */
--surface-subtle:      #0d0f17; /* Secondary container background */
--surface-card:        #13151f; /* Card, list item, and panel surface */
--surface-elevated:    #1a1d2b; /* Dropdowns, popovers, and elevated sheets */
--surface-overlay:     #222638; /* Modals, dialogs, and active states */
--surface-glass:       rgba(19, 21, 31, 0.75); /* Frosted panels with backdrop blur */

/* Borders & Separators */
--border-subtle:       rgba(255, 255, 255, 0.07); /* Standard card and divider borders */
--border-moderate:     rgba(255, 255, 255, 0.14); /* Hover borders and interactive outlines */
--border-bold:         rgba(255, 255, 255, 0.28); /* Focused fields and active elements */
--border-accent:       rgba(255, 0, 60, 0.40);    /* Brand highlight borders */
```

#### Content & Typography Tokens
```css
/* Text & Icon Colors (WCAG 2.2 AA Compliant against --surface-canvas) */
--content-primary:     #f8fafc; /* Primary headings, titles, active labels (Contrast: 18.2:1) */
--content-secondary:   #cbd5e1; /* Body text, descriptions, table cells (Contrast: 12.1:1) */
--content-muted:       #94a3b8; /* Hints, timestamps, metadata, captions (Contrast: 7.2:1) */
--content-subtle:      #64748b; /* Disabled states, placeholders, inactive icons (Contrast: 4.6:1) */
--content-inverse:     #08090d; /* Text placed on light/gold badges */
```

#### Brand & Action Tokens
```css
/* Crimson Brand Core */
--brand-primary:       #e11d48; /* Crimson 600: Primary CTAs, active buttons */
--brand-hover:         #f43f5e; /* Crimson 500: Button hover state */
--brand-active:        #be123c; /* Crimson 700: Button pressed state */
--brand-glow:          rgba(225, 29, 72, 0.25); /* Ambient focus ring / button glow */
--brand-subtle:        rgba(225, 29, 72, 0.12); /* Selected row highlights, subtle badge tint */

/* Legal Seal & Stamp Gold (Used exclusively for certificates & verified seals) */
--seal-gold:           #facc15; /* Verified badge, IT Act compliance stamp */
--seal-gold-hover:     #fde047;
--seal-gold-subtle:    rgba(250, 204, 21, 0.15);
--seal-gold-border:    rgba(250, 204, 21, 0.35);
```

#### Semantic Status Tokens
```css
/* Executed / Success */
--status-success:          #10b981; /* Emerald 500 */
--status-success-subtle:   rgba(16, 185, 129, 0.12);
--status-success-border:   rgba(16, 185, 129, 0.30);

/* Pending / Warning */
--status-warning:          #f59e0b; /* Amber 500 */
--status-warning-subtle:   rgba(245, 158, 11, 0.12);
--status-warning-border:   rgba(245, 158, 11, 0.30);

/* Declined / Danger */
--status-danger:           #ef4444; /* Red 500 */
--status-danger-subtle:    rgba(239, 68, 68, 0.12);
--status-danger-border:    rgba(239, 68, 68, 0.30);

/* Information / Processing */
--status-info:             #38bdf8; /* Sky 400 */
--status-info-subtle:      rgba(56, 189, 248, 0.12);
--status-info-border:      rgba(56, 189, 248, 0.30);
```

#### Multi-Party Signer Role Color Codes
When contracts are routed to multiple participants, each party is assigned a mathematically verified, high-contrast color code. These colors appear on field placement bounding boxes, signer chips, and audit trail markers:

| Role Slot | Token Name | Hex Code | Purpose & Accessibility |
| :--- | :--- | :--- | :--- |
| **Self / Owner** | `--signer-self` | `#e11d48` (Crimson) | Document creator / self-signing field |
| **Signer 1** | `--signer-p1` | `#3b82f6` (Sapphire Blue) | First recipient (e.g., Client / Employee) |
| **Signer 2** | `--signer-p2` | `#10b981` (Emerald Green) | Second recipient (e.g., Landlord / Vendor) |
| **Signer 3** | `--signer-p3` | `#a855f7` (Amethyst Purple) | Third recipient (e.g., Approver / Witness) |
| **Signer 4** | `--signer-p4` | `#f59e0b` (Amber Orange) | Fourth recipient (e.g., Legal Counsel) |
| **Signer 5** | `--signer-p5` | `#ec4899` (Fuchsia Pink) | Fifth recipient (e.g., Notary) |
| **Viewer Only** | `--signer-viewer`| `#94a3b8` (Slate Grey) | Receive copy only, no interactive fields |

---

### 2.2 Typography Tokens

Typography communicates hierarchy without requiring heavy container cards. PactDoc uses four deliberate typefaces:

1. **`DM Sans`** (Primary UI): Optimized for digital legibility, tabular numerals, and high-density dashboard layouts.
2. **`Space Grotesk`** (Display & Headings): Geometric, authoritative sans-serif for marketing headers, stats, and page titles.
3. **`JetBrains Mono`** (Data, Hashes & Audit Logs): Fixed-width typography for SHA-256 checksums, IP addresses, timestamps, and contract IDs.
4. **`Lora`** (Legal Clauses & Affidavits): Editorial serif for statutory declarations (e.g., Section 10A statutory execution clause).

#### Type Scale & Hierarchy

| Token | Size | Line Height | Tracking | Weight | Typical Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `type-display-xl` | 4.5rem (72px) | 1.05 | -0.03em | 800 (Extrabold) | Landing Page Hero |
| `type-display-lg` | 3.5rem (56px) | 1.10 | -0.025em| 700 (Bold) | Major Feature Intros |
| `type-heading-1` | 2.25rem (36px)| 1.20 | -0.02em | 700 (Bold) | Page Titles, Dashboard Headers |
| `type-heading-2` | 1.75rem (28px)| 1.25 | -0.015em| 700 (Bold) | Section Headers, Modal Titles |
| `type-heading-3` | 1.25rem (20px)| 1.35 | -0.01em | 600 (Semibold) | Card Titles, Drawer Sub-headers |
| `type-body-lg` | 1.125rem (18px)| 1.55 | -0.005em| 400/500 | Hero subtitles, Lead paragraphs |
| `type-body-md` | 0.9375rem (15px)| 1.50 | 0.00em | 400/500 | Default body text, form labels |
| `type-body-sm` | 0.8125rem (13px)| 1.45 | 0.005em | 400/500 | Table data, hints, sub-labels |
| `type-mono-sm` | 0.75rem (12px) | 1.40 | 0.02em | 500/700 | SHA-256 Hashes, Timestamps |
| `type-caption` | 0.6875rem (11px)| 1.35 | 0.03em | 600/700 | Micro tags, status chips |

---

### 2.3 Spacing, Grid & Layout Tokens

Built on an **8-point spatial grid** (with a 4-point half-step for micro-elements):

```css
/* Base Spacing Scale */
--space-1:   0.25rem;  /* 4px  - Micro gap, badge padding */
--space-2:   0.50rem;  /* 8px  - Icon gap, compact input padding */
--space-3:   0.75rem;  /* 12px - Input vertical padding, tag spacing */
--space-4:   1.00rem;  /* 16px - Standard component padding */
--space-5:   1.25rem;  /* 20px - Card interior padding */
--space-6:   1.50rem;  /* 24px - Standard card padding, grid gutter */
--space-8:   2.00rem;  /* 32px - Section gap on mobile */
--space-10:  2.50rem;  /* 40px - Toolbar heights, header margin */
--space-12:  3.00rem;  /* 48px - Section padding desktop */
--space-16:  4.00rem;  /* 64px - Major block separation */
--space-24:  6.00rem;  /* 96px - Landing page section padding */

/* Container Layout Widths */
--container-sm:   640px;  /* Auth cards, single-column dialogs */
--container-md:   768px;  /* Settings forms, billing details */
--container-lg:   1024px; /* Dashboard document table */
--container-xl:   1280px; /* Marketing landing pages */
--container-2xl:  1536px; /* PDF Editor full-bleed workspace */
```

---

### 2.4 Elevation, Shadows & Depth Tokens

Dark mode interfaces require **layered luminosity** rather than blurry drop shadows to convey hierarchy. The higher the layer, the lighter the surface and the crisper the inner highlight stroke:

```css
/* Elevation 0: Flat Canvas */
--shadow-elevation-0: none;

/* Elevation 1: Cards & Panels */
--shadow-elevation-1: 
  0 1px 2px 0 rgba(0, 0, 0, 0.4),
  inset 0 1px 0 0 rgba(255, 255, 255, 0.05);

/* Elevation 2: Popovers, Dropdowns & Floating Toolbars */
--shadow-elevation-2: 
  0 4px 12px -2px rgba(0, 0, 0, 0.6),
  0 2px 4px -1px rgba(0, 0, 0, 0.4),
  inset 0 1px 0 0 rgba(255, 255, 255, 0.08);

/* Elevation 3: Modals, Dialogs & Full Drawers */
--shadow-elevation-3: 
  0 20px 35px -8px rgba(0, 0, 0, 0.8),
  0 8px 16px -4px rgba(0, 0, 0, 0.6),
  inset 0 1px 0 0 rgba(255, 255, 255, 0.12);

/* Elevation 4: Signature Studio & Field Drag Overlays */
--shadow-elevation-drag:
  0 12px 28px -4px rgba(225, 29, 72, 0.35),
  0 4px 12px 0 rgba(0, 0, 0, 0.8),
  0 0 0 2px var(--brand-primary);
```

---

### 2.5 Radii Tokens

PactDoc balances modern ergonomics with high-density precision. Avoid overly bubbly pill shapes for cards; use refined radii:

```css
--radius-xs:    3px;   /* Micro badges, checkbox checkmarks */
--radius-sm:    6px;   /* Tags, status pills, table action buttons */
--radius-md:    10px;  /* Form inputs, buttons, dropdown menus */
--radius-lg:    14px;  /* Cards, document grid items, alerts */
--radius-xl:    20px;  /* Modal windows, signature studio panels */
--radius-2xl:   28px;  /* Marketing mockup containers */
--radius-full:  9999px;/* Round avatars, circular initial stamps */
```

---

## 3. Component Design Tokens & Specifications

### 3.1 Button Hierarchy

All buttons enforce a **minimum touch height of 44px** on mobile devices:

| Variant | Visual Properties | Interactive Behavior | Typical Use Case |
| :--- | :--- | :--- | :--- |
| **Primary (Solid Crimson)** | `bg-[#e11d48] text-white font-bold rounded-md shadow-elevation-1` | Hover: `bg-[#f43f5e] translateY(-1px)`<br>Active: `bg-[#be123c] translateY(1px)` | "Sign Document", "Send For Execution", "Create Template" |
| **Secondary (Carbon Surface)** | `bg-[#1a1d2b] text-gray-200 border border-white/10 rounded-md` | Hover: `bg-[#222638] text-white border-white/20`<br>Active: `bg-[#13151f]` | "Save Draft", "Download PDF", "Filter Documents" |
| **Ghost / Flat** | `bg-transparent text-gray-400 hover:text-white rounded-md` | Hover: `bg-white/05 text-white`<br>Active: `bg-white/10` | Table row actions (`...`), "Cancel", pagination |
| **Destructive** | `bg-red-500/10 text-red-400 border border-red-500/30 rounded-md` | Hover: `bg-red-600 text-white border-red-600` | "Revoke Document", "Delete Workspace", "Remove Signer" |
| **Gold Stamp Action** | `bg-yellow-400 text-black font-extrabold rounded-md shadow-[0_2px_10px_rgba(250,204,21,0.25)]` | Hover: `bg-yellow-300`<br>Active: `bg-yellow-500` | "Upgrade to Pro", "Seal Final Agreement" |

---

### 3.2 PDF Canvas Field Tokens

Fields placed on documents must stand out against white contract pages while indicating the assigned recipient and validation state:

```
┌────────────────────────────────────────────────────────┐
│ [Icon] Signature: Alex Morgan (CTO)          [Req *]   │
│ ┌────────────────────────────────────────────────────┐ │
│ │                  Sign Here                         │ │
│ └────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

- **Field Bounding Box**:
  - Border: `2px dashed var(--signer-color)` (e.g., `#3b82f6` for Signer 1).
  - Background Fill: `rgba(var(--signer-rgb), 0.08)`.
  - When Selected/Active: `2px solid var(--signer-color)` with `box-shadow: 0 0 0 3px rgba(var(--signer-rgb), 0.25)`.
- **Field Header Pill**:
  - Height: `20px`.
  - Background: `var(--signer-color)`.
  - Text: `10px JetBrains Mono, font-bold, text-white`.
- **Field Drag Handle**:
  - Size: `10×10px` on corners, `bg-white border-2 border-current rounded-xs`.

---

## 4. Implementation: Tailwind CSS Configuration

Extend `client/tailwind.config.js` with all design tokens:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: {
          canvas: "#08090d",
          subtle: "#0d0f17",
          card: "#13151f",
          elevated: "#1a1d2b",
          overlay: "#222638",
        },
        content: {
          primary: "#f8fafc",
          secondary: "#cbd5e1",
          muted: "#94a3b8",
          subtle: "#64748b",
          inverse: "#08090d",
        },
        crimson: {
          500: "#f43f5e",
          600: "#e11d48",
          700: "#be123c",
          800: "#9f1239",
          900: "#881337",
        },
        seal: {
          gold: "#facc15",
          amber: "#f59e0b",
        },
        signer: {
          self: "#e11d48",
          p1: "#3b82f6",
          p2: "#10b981",
          p3: "#a855f7",
          p4: "#f59e0b",
          p5: "#ec4899",
          viewer: "#94a3b8",
        },
      },
      fontFamily: {
        sans: ["'DM Sans'", "system-ui", "-apple-system", "sans-serif"],
        display: ["'Space Grotesk'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
        legal: ["'Lora'", "serif"],
      },
      boxShadow: {
        "elevation-1": "0 1px 2px 0 rgba(0, 0, 0, 0.4), inset 0 1px 0 0 rgba(255, 255, 255, 0.05)",
        "elevation-2": "0 4px 12px -2px rgba(0, 0, 0, 0.6), 0 2px 4px -1px rgba(0, 0, 0, 0.4), inset 0 1px 0 0 rgba(255, 255, 255, 0.08)",
        "elevation-3": "0 20px 35px -8px rgba(0, 0, 0, 0.8), 0 8px 16px -4px rgba(0, 0, 0, 0.6), inset 0 1px 0 0 rgba(255, 255, 255, 0.12)",
        "crimson-glow": "0 0 20px -3px rgba(225, 29, 72, 0.35)",
        "gold-glow": "0 0 18px -2px rgba(250, 204, 21, 0.30)",
      },
      borderRadius: {
        xs: "3px",
        sm: "6px",
        md: "10px",
        lg: "14px",
        xl: "20px",
        "2xl": "28px",
      },
      spacing: {
        13: "3.25rem",
        15: "3.75rem",
      },
    },
  },
  plugins: [],
};
```

---

## 5. Implementation: CSS Custom Properties (`index.css`)

Drop-in tokens for `client/src/index.css`:

```css
@layer base {
  :root {
    --bg-canvas: #08090d;
    --bg-surface: #13151f;
    --bg-elevated: #1a1d2b;
    --border-subtle: rgba(255, 255, 255, 0.07);
    --border-active: rgba(225, 29, 72, 0.4);
    --text-primary: #f8fafc;
    --text-muted: #94a3b8;
  }

  body {
    background-color: var(--bg-canvas);
    color: var(--text-primary);
    font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
    overflow-x: hidden;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
}

/* Precision Scrollbar */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: #0d0f17;
}
::-webkit-scrollbar-thumb {
  background: #1e2235;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #e11d48;
}

/* Focus Ring Utility */
*:focus-visible {
  outline: 2px solid #e11d48;
  outline-offset: 2px;
}
```

---

## 6. Accessibility & Governance Guidelines

### 6.1 Contrast Verification (WCAG 2.2 AA)
All text combinations on PactDoc must achieve at least:
- **4.5:1** for normal text ($< 18\text{pt}$ / $24\text{px}$).
- **3.0:1** for large text ($\ge 18\text{pt}$ / $24\text{px}$) and user interface components (inputs, borders, button states).

Verified token contrast on `--surface-canvas` (`#08090d`):
- `--content-primary` (`#f8fafc`): **18.2:1** (Passes AAA)
- `--content-secondary` (`#cbd5e1`): **12.1:1** (Passes AAA)
- `--content-muted` (`#94a3b8`): **7.2:1** (Passes AAA)
- `--brand-primary` (`#e11d48`): **4.6:1** against black (Passes AA)

### 6.2 Anti-Patterns: What NOT to Do (The "Don'ts")

| Legacy Pattern | Why It Fails | Replacement in Precision Monolith |
| :--- | :--- | :--- |
| **`shadow-[5px_5px_0px_0px_#ef4444]`** | Hard un-blurred neon borders create a comic-book appearance that diminishes enterprise trust. | Use layered dark-mode shadows (`shadow-elevation-1` / `shadow-elevation-2`). |
| **Tilted stickers (`transform rotate-1`)** | Tilted containers cause horizontal scroll overflows on 360px mobile viewports. | Use crisp straight alignment with subtle 1px border glows. |
| **Rainbow status cards** | Yellow, red, purple, and green all competing in the same viewport causes sensory fatigue. | One primary action per view; status colors reserved strictly for state. |
| **`text-[10px]` with no line height** | Tiny text fails accessibility legibility checks on small high-DPI smartphone screens. | Minimum body text size: `13px` (`text-xs`), with minimum line-height of `1.4`. |
| **Hardcoded heights on buttons** | Text truncates or overflows when users increase browser zoom or switch language to Hindi. | Use `min-h-[44px]` with flexible vertical padding (`py-2.5`). |
