import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { ensureDir, writeFile } from "../utils/file.utils.js";
import path from "path";
import fs from "fs";

const PREBUILT_DIR = path.join("uploads", "templates", "prebuilt");

// Helper to create a multi-section legally compliant contract page
const createContractDoc = async ({
  title,
  subtitle,
  referenceCode,
  party1Label,
  party2Label,
  sections,
}) => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]); // Standard US Letter (8.5 x 11 in)
  const { width, height } = page.getSize();

  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await doc.embedFont(StandardFonts.Courier);

  // 1. Top Header Banner
  page.drawRectangle({
    x: 0,
    y: height - 60,
    width: width,
    height: 60,
    color: rgb(0.06, 0.08, 0.12),
  });

  page.drawRectangle({
    x: 0,
    y: height - 63,
    width: width,
    height: 3,
    color: rgb(0.86, 0.15, 0.15),
  });

  page.drawText(title.toUpperCase(), {
    x: 36,
    y: height - 34,
    size: 13,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText(subtitle, {
    x: 36,
    y: height - 48,
    size: 8,
    font: fontRegular,
    color: rgb(0.8, 0.82, 0.85),
  });

  page.drawText(`REF: ${referenceCode}`, {
    x: width - 150,
    y: height - 34,
    size: 7.5,
    font: fontMono,
    color: rgb(0.7, 0.75, 0.8),
  });

  page.drawText("LEGALLY COMPLIANT (IT ACT / ESIGN / eIDAS)", {
    x: width - 230,
    y: height - 48,
    size: 6.5,
    font: fontBold,
    color: rgb(0.9, 0.4, 0.4),
  });

  let currentY = height - 80;

  // 2. Render Contract Sections
  for (const sec of sections) {
    page.drawText(sec.heading, {
      x: 36,
      y: currentY,
      size: 9,
      font: fontBold,
      color: rgb(0.12, 0.15, 0.2),
    });
    currentY -= 12;

    const words = sec.body.split(" ");
    let line = "";
    for (const word of words) {
      if ((line + word).length > 105) {
        page.drawText(line, { x: 36, y: currentY, size: 7.5, font: fontRegular, color: rgb(0.25, 0.28, 0.32) });
        currentY -= 10;
        line = word + " ";
      } else {
        line += word + " ";
      }
    }
    if (line.length > 0) {
      page.drawText(line, { x: 36, y: currentY, size: 7.5, font: fontRegular, color: rgb(0.25, 0.28, 0.32) });
      currentY -= 10;
    }
    currentY -= 6;
  }

  // 3. Execution & Statutory Declaration Header
  page.drawRectangle({
    x: 36,
    y: 195,
    width: width - 72,
    height: 18,
    color: rgb(0.94, 0.96, 0.98),
    borderColor: rgb(0.85, 0.88, 0.92),
    borderWidth: 1,
  });

  page.drawText("STATUTORY EXECUTION, MUTUAL CONSENT & ELECTRONIC SIGNATURE ATTESTATION", {
    x: 44,
    y: 201,
    size: 7.5,
    font: fontBold,
    color: rgb(0.15, 0.2, 0.3),
  });

  // 4. Party 1 Signature Box (Left Side: x = 36 to 290)
  page.drawRectangle({
    x: 36,
    y: 45,
    width: 250,
    height: 145,
    color: rgb(0.98, 0.99, 1),
    borderColor: rgb(0.8, 0.85, 0.9),
    borderWidth: 1,
  });

  page.drawRectangle({
    x: 36,
    y: 168,
    width: 250,
    height: 22,
    color: rgb(0.92, 0.95, 0.98),
  });

  page.drawText(`PARTY 1: ${party1Label.toUpperCase()}`, {
    x: 44,
    y: 175,
    size: 8,
    font: fontBold,
    color: rgb(0.1, 0.3, 0.6),
  });

  page.drawText("Electronic Signature Anchor:", { x: 44, y: 154, size: 7, font: fontBold, color: rgb(0.4, 0.4, 0.4) });
  page.drawRectangle({
    x: 44,
    y: 95,
    width: 234,
    height: 52,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.85, 0.88, 0.92),
    borderWidth: 1,
  });

  page.drawText("Date Signed:", { x: 44, y: 80, size: 7, font: fontBold, color: rgb(0.4, 0.4, 0.4) });
  page.drawRectangle({
    x: 44,
    y: 54,
    width: 234,
    height: 22,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.85, 0.88, 0.92),
    borderWidth: 1,
  });

  // 5. Party 2 Signature Box (Right Side: x = 326 to 576)
  page.drawRectangle({
    x: 326,
    y: 45,
    width: 250,
    height: 145,
    color: rgb(0.98, 0.99, 1),
    borderColor: rgb(0.8, 0.85, 0.9),
    borderWidth: 1,
  });

  page.drawRectangle({
    x: 326,
    y: 168,
    width: 250,
    height: 22,
    color: rgb(0.92, 0.95, 0.98),
  });

  page.drawText(`PARTY 2: ${party2Label.toUpperCase()}`, {
    x: 334,
    y: 175,
    size: 8,
    font: fontBold,
    color: rgb(0.05, 0.5, 0.3),
  });

  page.drawText("Electronic Signature Anchor:", { x: 334, y: 154, size: 7, font: fontBold, color: rgb(0.4, 0.4, 0.4) });
  page.drawRectangle({
    x: 334,
    y: 95,
    width: 234,
    height: 52,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.85, 0.88, 0.92),
    borderWidth: 1,
  });

  page.drawText("Date Signed:", { x: 334, y: 80, size: 7, font: fontBold, color: rgb(0.4, 0.4, 0.4) });
  page.drawRectangle({
    x: 334,
    y: 54,
    width: 234,
    height: 22,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.85, 0.88, 0.92),
    borderWidth: 1,
  });

  // Footer Disclaimer
  page.drawText("Executed under India IT Act 2000 (Sec 10A), US ESIGN (15 U.S.C. 7001), and EU eIDAS (No 910/2014) • Signaturly Pro", {
    x: 36,
    y: 20,
    size: 6.5,
    font: fontRegular,
    color: rgb(0.5, 0.5, 0.5),
  });

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
};

export const PREBUILT_TEMPLATES_DEFINITIONS = [
  {
    id: "tpl-nda",
    name: "Mutual Non-Disclosure Agreement (NDA)",
    description: "Legally enforceable mutual confidentiality contract compliant with India IT Act, US ESIGN, and EU eIDAS.",
    fileName: "Mutual-NDA-Agreement.pdf",
    pageCount: 1,
    category: "Legal & Corporate",
    roles: [
      { id: "role-disclosing", name: "Disclosing Party", color: "#3b82f6", signingOrder: 1 },
      { id: "role-receiving", name: "Receiving Party", color: "#10b981", signingOrder: 2 },
    ],
    generateDoc: () =>
      createContractDoc({
        title: "Mutual Non-Disclosure Agreement",
        subtitle: "Confidentiality, Intellectual Property & Non-Disclosure Contract",
        referenceCode: "NDA-SEC10A-2026",
        party1Label: "Disclosing Party",
        party2Label: "Receiving Party",
        sections: [
          {
            heading: "1. Purpose and Consideration",
            body: "The Disclosing Party and Receiving Party agree to share proprietary commercial, financial, and technical information strictly for evaluating and pursuing joint business opportunities, subject to full confidentiality terms.",
          },
          {
            heading: "2. Definition of Confidential Information",
            body: "Confidential Information includes all non-public technical specifications, trade secrets, software algorithms, customer data, and business strategies disclosed in oral, visual, or written electronic format.",
          },
          {
            heading: "3. Non-Disclosure & Duty of Care",
            body: "The Receiving Party agrees to maintain strict confidentiality using no less than reasonable standard of care, shall not distribute or reverse engineer materials, and shall restrict access solely to essential authorized personnel.",
          },
          {
            heading: "4. Term, Governing Law & Jurisdiction",
            body: "This Agreement remains valid for two (2) years from execution. This contract is governed by and construed in accordance with the laws of India (Indian Contract Act 1872) and international commercial jurisdiction.",
          },
          {
            heading: "5. Statutory Electronic Execution & Legal Admissibility",
            body: "The parties explicitly consent and agree that this document is executed via cryptographic electronic signature in compliance with Section 10A of the Indian Information Technology Act, 2000, US ESIGN Act (15 U.S.C. § 7001), and EU eIDAS Regulation (No 910/2014), holding full legal validity and admissibility.",
          },
        ],
      }),
    fields: [
      // Disclosing Party (Left Box: x: 44/612 = 0.072, y: top to 95/792 -> yPercent: (792 - 147)/792 = 0.814)
      {
        id: "f-nda-disc-sig",
        roleId: "role-disclosing",
        roleName: "Disclosing Party",
        roleColor: "#3b82f6",
        type: "signature",
        page: 1,
        xPercent: 0.072,
        yPercent: 0.814,
        widthPercent: 0.382,
        heightPercent: 0.065,
        required: true,
      },
      {
        id: "f-nda-disc-date",
        roleId: "role-disclosing",
        roleName: "Disclosing Party",
        roleColor: "#3b82f6",
        type: "date",
        page: 1,
        xPercent: 0.072,
        yPercent: 0.902,
        widthPercent: 0.382,
        heightPercent: 0.028,
        required: true,
      },
      // Receiving Party (Right Box: x: 334/612 = 0.545)
      {
        id: "f-nda-rec-sig",
        roleId: "role-receiving",
        roleName: "Receiving Party",
        roleColor: "#10b981",
        type: "signature",
        page: 1,
        xPercent: 0.545,
        yPercent: 0.814,
        widthPercent: 0.382,
        heightPercent: 0.065,
        required: true,
      },
      {
        id: "f-nda-rec-date",
        roleId: "role-receiving",
        roleName: "Receiving Party",
        roleColor: "#10b981",
        type: "date",
        page: 1,
        xPercent: 0.545,
        yPercent: 0.902,
        widthPercent: 0.382,
        heightPercent: 0.028,
        required: true,
      },
    ],
  },
  {
    id: "tpl-offer-letter",
    name: "Employment Offer Letter",
    description: "Standard formal employment agreement detailing compensation, role responsibilities, and terms of employment.",
    fileName: "Employment-Offer-Letter.pdf",
    pageCount: 1,
    category: "Human Resources",
    roles: [
      { id: "role-employer", name: "Hiring Manager", color: "#3b82f6", signingOrder: 1 },
      { id: "role-candidate", name: "Candidate", color: "#8b5cf6", signingOrder: 2 },
    ],
    generateDoc: () =>
      createContractDoc({
        title: "Employment Offer & Terms Agreement",
        subtitle: "Appointment Letter, Remuneration & Terms of Service",
        referenceCode: "EMP-OFFER-2026",
        party1Label: "Employer / Company",
        party2Label: "Appointed Candidate",
        sections: [
          {
            heading: "1. Position, Role & Responsibilities",
            body: "The Employer hereby offers and the Candidate accepts appointment to the designated role. The Candidate will perform duties diligently in compliance with company policies, standards, and directives.",
          },
          {
            heading: "2. Remuneration, Benefits & Notice Period",
            body: "The Candidate shall receive the agreed annual compensation package payable on monthly payroll cycles, along with standard statutory medical insurance, leave benefits, and a 30-day mutual notice period.",
          },
          {
            heading: "3. Confidentiality, Non-Solicitation & IP Assignment",
            body: "All intellectual property, software systems, and business documents created during employment belong exclusively to the Employer. The Candidate agrees to maintain strict commercial confidentiality.",
          },
          {
            heading: "4. Governing Law & Electronic Signatures Consent",
            body: "This contract is executed in accordance with applicable labor laws and Section 10A of the Indian IT Act 2000 / US ESIGN Act. The parties agree electronic execution constitutes valid legal acceptance.",
          },
        ],
      }),
    fields: [
      {
        id: "f-offer-emp-sig",
        roleId: "role-employer",
        roleName: "Hiring Manager",
        roleColor: "#3b82f6",
        type: "signature",
        page: 1,
        xPercent: 0.072,
        yPercent: 0.814,
        widthPercent: 0.382,
        heightPercent: 0.065,
        required: true,
      },
      {
        id: "f-offer-emp-date",
        roleId: "role-employer",
        roleName: "Hiring Manager",
        roleColor: "#3b82f6",
        type: "date",
        page: 1,
        xPercent: 0.072,
        yPercent: 0.902,
        widthPercent: 0.382,
        heightPercent: 0.028,
        required: true,
      },
      {
        id: "f-offer-cand-sig",
        roleId: "role-candidate",
        roleName: "Candidate",
        roleColor: "#8b5cf6",
        type: "signature",
        page: 1,
        xPercent: 0.545,
        yPercent: 0.814,
        widthPercent: 0.382,
        heightPercent: 0.065,
        required: true,
      },
      {
        id: "f-offer-cand-date",
        roleId: "role-candidate",
        roleName: "Candidate",
        roleColor: "#8b5cf6",
        type: "date",
        page: 1,
        xPercent: 0.545,
        yPercent: 0.902,
        widthPercent: 0.382,
        heightPercent: 0.028,
        required: true,
      },
    ],
  },
  {
    id: "tpl-contractor",
    name: "Independent Contractor Agreement",
    description: "Professional consulting and services agreement with deliverables, payment milestones, and IP ownership.",
    fileName: "Contractor-Consulting-Agreement.pdf",
    pageCount: 1,
    category: "Consulting & Services",
    roles: [
      { id: "role-client", name: "Client / Principal", color: "#3b82f6", signingOrder: 1 },
      { id: "role-contractor", name: "Contractor", color: "#f59e0b", signingOrder: 2 },
    ],
    generateDoc: () =>
      createContractDoc({
        title: "Independent Contractor Agreement",
        subtitle: "Consulting Scope of Work, Milestones & IP Assignment",
        referenceCode: "ICA-CONSULT-2026",
        party1Label: "Client / Principal",
        party2Label: "Contractor / Consultant",
        sections: [
          {
            heading: "1. Scope of Work & Deliverables",
            body: "The Contractor agrees to deliver independent engineering and consulting services as defined in project milestones, with professional standard of craftsmanship and timeliness.",
          },
          {
            heading: "2. Compensation & Milestone Invoicing",
            body: "Invoices will be submitted upon milestone acceptance and paid within 15 business days. The Contractor operates strictly as an independent entity responsible for their own tax obligations.",
          },
          {
            heading: "3. Work Product Ownership (Work Made For Hire)",
            body: "All deliverables, code, designs, and documentation produced under this agreement shall be the exclusive property of the Client upon completion of payment.",
          },
          {
            heading: "4. Legal Enforceability & E-Signature Assent",
            body: "This agreement is executed under Section 10A of the IT Act 2000 / US ESIGN / eIDAS. The parties agree electronic execution carries identical binding authority as physical signatures.",
          },
        ],
      }),
    fields: [
      {
        id: "f-cont-cli-sig",
        roleId: "role-client",
        roleName: "Client / Principal",
        roleColor: "#3b82f6",
        type: "signature",
        page: 1,
        xPercent: 0.072,
        yPercent: 0.814,
        widthPercent: 0.382,
        heightPercent: 0.065,
        required: true,
      },
      {
        id: "f-cont-cli-date",
        roleId: "role-client",
        roleName: "Client / Principal",
        roleColor: "#3b82f6",
        type: "date",
        page: 1,
        xPercent: 0.072,
        yPercent: 0.902,
        widthPercent: 0.382,
        heightPercent: 0.028,
        required: true,
      },
      {
        id: "f-cont-ctr-sig",
        roleId: "role-contractor",
        roleName: "Contractor",
        roleColor: "#f59e0b",
        type: "signature",
        page: 1,
        xPercent: 0.545,
        yPercent: 0.814,
        widthPercent: 0.382,
        heightPercent: 0.065,
        required: true,
      },
      {
        id: "f-cont-ctr-date",
        roleId: "role-contractor",
        roleName: "Contractor",
        roleColor: "#f59e0b",
        type: "date",
        page: 1,
        xPercent: 0.545,
        yPercent: 0.902,
        widthPercent: 0.382,
        heightPercent: 0.028,
        required: true,
      },
    ],
  },
  {
    id: "tpl-residential-lease",
    name: "Residential Lease Agreement",
    description: "Property tenancy contract detailing monthly rental, security deposit, maintenance, and rules.",
    fileName: "Residential-Lease-Agreement.pdf",
    pageCount: 1,
    category: "Real Estate",
    roles: [
      { id: "role-landlord", name: "Landlord / Owner", color: "#3b82f6", signingOrder: 1 },
      { id: "role-tenant", name: "Tenant", color: "#ec4899", signingOrder: 2 },
    ],
    generateDoc: () =>
      createContractDoc({
        title: "Residential Tenancy Agreement",
        subtitle: "Premises Lease, Rent Schedule & Tenancy Regulations",
        referenceCode: "LEASE-RES-2026",
        party1Label: "Landlord / Lessor",
        party2Label: "Tenant / Lessee",
        sections: [
          {
            heading: "1. Demised Premises & Lease Term",
            body: "The Landlord leases to the Tenant the designated residential property for an initial fixed term of 11/12 months, renewable upon mutual written agreement.",
          },
          {
            heading: "2. Monthly Rent, Utility Charges & Security Deposit",
            body: "Rent is payable in advance by the 5th of each calendar month. The refundable security deposit is held without interest to secure covenants and repair of damages beyond normal wear and tear.",
          },
          {
            heading: "3. Maintenance, Quiet Enjoyment & Inspections",
            body: "The Tenant shall maintain the premises cleanly, refrain from sub-leasing or illegal acts, and permit reasonable inspection with 24-hour advance written notice.",
          },
          {
            heading: "4. Statutory Enforceability & E-Signature Assent",
            body: "This tenancy agreement is executed electronically in compliance with Section 10A of the IT Act 2000, Transfer of Property Act 1882, and US/EU E-Signature standards.",
          },
        ],
      }),
    fields: [
      {
        id: "f-lease-ll-sig",
        roleId: "role-landlord",
        roleName: "Landlord / Owner",
        roleColor: "#3b82f6",
        type: "signature",
        page: 1,
        xPercent: 0.072,
        yPercent: 0.814,
        widthPercent: 0.382,
        heightPercent: 0.065,
        required: true,
      },
      {
        id: "f-lease-ll-date",
        roleId: "role-landlord",
        roleName: "Landlord / Owner",
        roleColor: "#3b82f6",
        type: "date",
        page: 1,
        xPercent: 0.072,
        yPercent: 0.902,
        widthPercent: 0.382,
        heightPercent: 0.028,
        required: true,
      },
      {
        id: "f-lease-ten-sig",
        roleId: "role-tenant",
        roleName: "Tenant",
        roleColor: "#ec4899",
        type: "signature",
        page: 1,
        xPercent: 0.545,
        yPercent: 0.814,
        widthPercent: 0.382,
        heightPercent: 0.065,
        required: true,
      },
      {
        id: "f-lease-ten-date",
        roleId: "role-tenant",
        roleName: "Tenant",
        roleColor: "#ec4899",
        type: "date",
        page: 1,
        xPercent: 0.545,
        yPercent: 0.902,
        widthPercent: 0.382,
        heightPercent: 0.028,
        required: true,
      },
    ],
  },
  {
    id: "tpl-sales-proposal",
    name: "Sales Proposal & Statement of Work",
    description: "Commercial service order, pricing quote, and project sign-off agreement.",
    fileName: "Sales-Proposal-SOW.pdf",
    pageCount: 1,
    category: "Sales & Commercial",
    roles: [
      { id: "role-vendor", name: "Service Provider", color: "#3b82f6", signingOrder: 1 },
      { id: "role-buyer", name: "Client / Buyer", color: "#10b981", signingOrder: 2 },
    ],
    generateDoc: () =>
      createContractDoc({
        title: "Sales Proposal & Statement of Work",
        subtitle: "Commercial Terms, Project Pricing & Execution Sign-Off",
        referenceCode: "SOW-SALES-2026",
        party1Label: "Service Provider",
        party2Label: "Client / Buyer",
        sections: [
          {
            heading: "1. Scope of Deliverables & Services",
            body: "Provider agrees to furnish software customization, technical deployment, and SLA support services as described in the agreed commercial quote.",
          },
          {
            heading: "2. Commercial Pricing & Payment Milestones",
            body: "Payment is structured 50% upon initial execution and 50% upon final acceptance sign-off. All prices are net of applicable statutory taxes.",
          },
          {
            heading: "3. Warranty, Acceptance & SLA",
            body: "Provider warrants deliverables for 90 days following deployment against programming defects and provides tier-1 response times.",
          },
          {
            heading: "4. Execution & Electronic Admissibility",
            body: "Executed under Section 10A of the IT Act 2000 / US ESIGN / EU eIDAS. Both parties confirm electronic signing confers binding commercial authority.",
          },
        ],
      }),
    fields: [
      {
        id: "f-sales-ven-sig",
        roleId: "role-vendor",
        roleName: "Service Provider",
        roleColor: "#3b82f6",
        type: "signature",
        page: 1,
        xPercent: 0.072,
        yPercent: 0.814,
        widthPercent: 0.382,
        heightPercent: 0.065,
        required: true,
      },
      {
        id: "f-sales-ven-date",
        roleId: "role-vendor",
        roleName: "Service Provider",
        roleColor: "#3b82f6",
        type: "date",
        page: 1,
        xPercent: 0.072,
        yPercent: 0.902,
        widthPercent: 0.382,
        heightPercent: 0.028,
        required: true,
      },
      {
        id: "f-sales-buy-sig",
        roleId: "role-buyer",
        roleName: "Client / Buyer",
        roleColor: "#10b981",
        type: "signature",
        page: 1,
        xPercent: 0.545,
        yPercent: 0.814,
        widthPercent: 0.382,
        heightPercent: 0.065,
        required: true,
      },
      {
        id: "f-sales-buy-date",
        roleId: "role-buyer",
        roleName: "Client / Buyer",
        roleColor: "#10b981",
        type: "date",
        page: 1,
        xPercent: 0.545,
        yPercent: 0.902,
        widthPercent: 0.382,
        heightPercent: 0.028,
        required: true,
      },
    ],
  },
];

// Ensure all prebuilt PDFs exist on disk with fresh updated layout
export const ensurePrebuiltPdfsExist = async (forceRegenerate = true) => {
  ensureDir(PREBUILT_DIR);
  for (const tpl of PREBUILT_TEMPLATES_DEFINITIONS) {
    const filePath = path.join(PREBUILT_DIR, tpl.fileName);
    if (!fs.existsSync(filePath) || forceRegenerate) {
      const buffer = await tpl.generateDoc();
      writeFile(filePath, buffer);
    }
  }
};
