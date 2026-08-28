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
  {
    id: "tpl-msa",
    name: "Master Services Agreement (MSA)",
    description: "Enterprise B2B framework contract covering recurring engagement terms, SLAs, indemnification, and liability caps.",
    fileName: "Master-Services-Agreement-MSA.pdf",
    pageCount: 1,
    category: "Legal & Corporate",
    roles: [
      { id: "role-msa-provider", name: "Service Provider", color: "#3b82f6", signingOrder: 1 },
      { id: "role-msa-client", name: "Enterprise Client", color: "#10b981", signingOrder: 2 },
    ],
    generateDoc: () =>
      createContractDoc({
        title: "Master Services Agreement (MSA)",
        subtitle: "Enterprise B2B Service Framework, Liability & Statutory Compliance",
        referenceCode: "MSA-FRAMEWORK-2026",
        party1Label: "Service Provider",
        party2Label: "Enterprise Client",
        sections: [
          {
            heading: "1. Framework & Statements of Work",
            body: "This Master Services Agreement governs all Statements of Work (SOWs) executed between the parties. In the event of inconsistency, the terms of this MSA shall prevail unless explicitly stated.",
          },
          {
            heading: "2. Payment Terms, Audit & Taxes",
            body: "Invoices are due net 30 days from billing date. Late payments accrue interest at 1.5% per month. Client assumes responsibility for applicable statutory sales or service taxes.",
          },
          {
            heading: "3. Indemnification & Limitation of Liability",
            body: "Each party shall indemnify the other against third-party IP infringement claims. Neither party's aggregate liability under this agreement shall exceed total fees paid during the preceding 12 months.",
          },
          {
            heading: "4. Statutory Electronic Assent & Legal Validity",
            body: "This agreement is executed electronically pursuant to Section 10A of the IT Act 2000, US ESIGN Act (15 U.S.C. § 7001), and EU eIDAS Regulation (No 910/2014) with full legal force.",
          },
        ],
      }),
    fields: [
      {
        id: "f-msa-prov-sig",
        roleId: "role-msa-provider",
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
        id: "f-msa-prov-date",
        roleId: "role-msa-provider",
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
        id: "f-msa-cli-sig",
        roleId: "role-msa-client",
        roleName: "Enterprise Client",
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
        id: "f-msa-cli-date",
        roleId: "role-msa-client",
        roleName: "Enterprise Client",
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
    id: "tpl-ip-assignment",
    name: "Intellectual Property (IP) Assignment",
    description: "Invention assignment contract transferring all software code, inventions, trademarks, and copyrights to the company.",
    fileName: "IP-Assignment-Invention-Transfer.pdf",
    pageCount: 1,
    category: "Intellectual Property",
    roles: [
      { id: "role-assignor", name: "Assignor / Creator", color: "#f59e0b", signingOrder: 1 },
      { id: "role-assignee", name: "Assignee / Company", color: "#3b82f6", signingOrder: 2 },
    ],
    generateDoc: () =>
      createContractDoc({
        title: "Intellectual Property Assignment Agreement",
        subtitle: "Invention Transfer, Copyright Assignment & Moral Rights Waiver",
        referenceCode: "IP-ASSIGN-2026",
        party1Label: "Assignor / Creator",
        party2Label: "Assignee / Company",
        sections: [
          {
            heading: "1. Irrevocable Assignment of Rights",
            body: "The Assignor hereby irrevocably assigns, transfers, and conveys to the Assignee all right, title, and interest worldwide in and to all inventions, code, software algorithms, patents, trademarks, and copyrights.",
          },
          {
            heading: "2. Waiver of Moral Rights & Power of Attorney",
            body: "Assignor irrevocably waives all moral rights under copyright law. Assignor grants Assignee power of attorney to execute registration deeds necessary to perfect intellectual property titles.",
          },
          {
            heading: "3. Consideration & Further Assurances",
            body: "This assignment is executed for valid monetary and contractual consideration. Assignor agrees to execute subsequent assignment documentation upon reasonable request.",
          },
          {
            heading: "4. Statutory E-Signature Enforcement",
            body: "Executed under Section 10A of the IT Act 2000 / US ESIGN / EU eIDAS. Both parties confirm electronic signing confers binding legal authority.",
          },
        ],
      }),
    fields: [
      {
        id: "f-ip-asg-sig",
        roleId: "role-assignor",
        roleName: "Assignor / Creator",
        roleColor: "#f59e0b",
        type: "signature",
        page: 1,
        xPercent: 0.072,
        yPercent: 0.814,
        widthPercent: 0.382,
        heightPercent: 0.065,
        required: true,
      },
      {
        id: "f-ip-asg-date",
        roleId: "role-assignor",
        roleName: "Assignor / Creator",
        roleColor: "#f59e0b",
        type: "date",
        page: 1,
        xPercent: 0.072,
        yPercent: 0.902,
        widthPercent: 0.382,
        heightPercent: 0.028,
        required: true,
      },
      {
        id: "f-ip-com-sig",
        roleId: "role-assignee",
        roleName: "Assignee / Company",
        roleColor: "#3b82f6",
        type: "signature",
        page: 1,
        xPercent: 0.545,
        yPercent: 0.814,
        widthPercent: 0.382,
        heightPercent: 0.065,
        required: true,
      },
      {
        id: "f-ip-com-date",
        roleId: "role-assignee",
        roleName: "Assignee / Company",
        roleColor: "#3b82f6",
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
    id: "tpl-saas-license",
    name: "Software Licensing & SaaS Agreement",
    description: "Cloud software subscription agreement defining SLA uptime, user seat permissions, data privacy, and usage terms.",
    fileName: "SaaS-Software-Licensing-Agreement.pdf",
    pageCount: 1,
    category: "Technology & SaaS",
    roles: [
      { id: "role-licensor", name: "Software Licensor", color: "#3b82f6", signingOrder: 1 },
      { id: "role-licensee", name: "Subscriber / Licensee", color: "#ec4899", signingOrder: 2 },
    ],
    generateDoc: () =>
      createContractDoc({
        title: "Software Licensing & SaaS Terms Agreement",
        subtitle: "Cloud Subscription Grant, SLA Uptime & Data Security Covenants",
        referenceCode: "SAAS-LICENSE-2026",
        party1Label: "Software Licensor",
        party2Label: "Subscriber / Licensee",
        sections: [
          {
            heading: "1. Non-Exclusive License Grant",
            body: "Licensor grants Licensee a non-exclusive, non-transferable subscription license to access the SaaS platform in accordance with designated user seat quotas.",
          },
          {
            heading: "2. Service Level Agreement (SLA) & Support",
            body: "Licensor guarantees 99.9% monthly service uptime excluding scheduled maintenance windows. Technical support is furnished according to subscription tier provisions.",
          },
          {
            heading: "3. Data Protection & Cybersecurity Covenants",
            body: "Licensor agrees to maintain SOC2 / ISO27001 data security compliance and encrypt customer data in transit and at rest.",
          },
          {
            heading: "4. Electronic Signatures & Statutory Admissibility",
            body: "This licensing agreement is executed under Section 10A of the IT Act 2000, US ESIGN Act (15 U.S.C. § 7001), and EU eIDAS Regulation (No 910/2014).",
          },
        ],
      }),
    fields: [
      {
        id: "f-saas-lic-sig",
        roleId: "role-licensor",
        roleName: "Software Licensor",
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
        id: "f-saas-lic-date",
        roleId: "role-licensor",
        roleName: "Software Licensor",
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
        id: "f-saas-sub-sig",
        roleId: "role-licensee",
        roleName: "Subscriber / Licensee",
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
        id: "f-saas-sub-date",
        roleId: "role-licensee",
        roleName: "Subscriber / Licensee",
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
    id: "tpl-commercial-lease",
    name: "Commercial Property Lease",
    description: "Commercial business premises rental contract detailing base rent, CAM expenses, permitted usage, and compliance.",
    fileName: "Commercial-Property-Lease.pdf",
    pageCount: 1,
    category: "Real Estate",
    roles: [
      { id: "role-com-landlord", name: "Commercial Landlord", color: "#3b82f6", signingOrder: 1 },
      { id: "role-com-tenant", name: "Commercial Tenant", color: "#f59e0b", signingOrder: 2 },
    ],
    generateDoc: () =>
      createContractDoc({
        title: "Commercial Property Lease Agreement",
        subtitle: "Commercial Premises Tenancy, Base Rent & Operating Expense Covenants",
        referenceCode: "LEASE-COMM-2026",
        party1Label: "Commercial Landlord",
        party2Label: "Commercial Tenant",
        sections: [
          {
            heading: "1. Demised Commercial Premises & Permitted Use",
            body: "Landlord hereby leases to Tenant the commercial real estate premises strictly for corporate office, retail, or industrial operations in accordance with municipal zoning bylaws.",
          },
          {
            heading: "2. Base Rent, CAM & Taxes",
            body: "Tenant agrees to pay monthly Base Rent in advance plus Pro Rata Share of Common Area Maintenance (CAM) and real property statutory taxes.",
          },
          {
            heading: "3. Maintenance, Alterations & Insurance",
            body: "Tenant shall maintain comprehensive commercial general liability insurance and shall not execute structural alterations without prior written consent.",
          },
          {
            heading: "4. Statutory Electronic Assent & Legal Validity",
            body: "Executed pursuant to Section 10A of the IT Act 2000, Transfer of Property Act 1882, US ESIGN Act (15 U.S.C. § 7001), and EU eIDAS Regulations.",
          },
        ],
      }),
    fields: [
      {
        id: "f-com-ll-sig",
        roleId: "role-com-landlord",
        roleName: "Commercial Landlord",
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
        id: "f-com-ll-date",
        roleId: "role-com-landlord",
        roleName: "Commercial Landlord",
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
        id: "f-com-ten-sig",
        roleId: "role-com-tenant",
        roleName: "Commercial Tenant",
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
        id: "f-com-ten-date",
        roleId: "role-com-tenant",
        roleName: "Commercial Tenant",
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
    id: "tpl-partnership",
    name: "General Partnership Agreement",
    description: "Business partnership contract establishing ownership percentages, profit sharing, management duties, and dissolution terms.",
    fileName: "General-Partnership-Agreement.pdf",
    pageCount: 1,
    category: "Legal & Corporate",
    roles: [
      { id: "role-[#3b82f6]", name: "Partner A", color: "#3b82f6", signingOrder: 1 },
      { id: "role-[#10b981]", name: "Partner B", color: "#10b981", signingOrder: 2 },
    ],
    generateDoc: () =>
      createContractDoc({
        title: "General Partnership Agreement",
        subtitle: "Commercial Business Entity Formation, Equity & Governance Covenants",
        referenceCode: "PARTNERSHIP-2026",
        party1Label: "Partner A",
        party2Label: "Partner B",
        sections: [
          {
            heading: "1. Formation, Business Purpose & Capital Contributions",
            body: "The Partners establish a general partnership to conduct commercial operations. Initial capital contributions and equity ratios are recorded in equal distribution unless amended.",
          },
          {
            heading: "2. Allocation of Profits, Losses & Distributions",
            body: "Net profits and losses shall be allocated in proportion to equity holdings. Cash distributions shall occur quarterly subject to working capital reserves.",
          },
          {
            heading: "3. Management Authority & Dissolution",
            body: "Each Partner possesses equal voting rights in major business decisions. Dissolution requires unanimous written consent or statutory event of withdrawal.",
          },
          {
            heading: "4. Statutory Electronic Assent & Legal Enforceability",
            body: "Executed under Section 10A of the IT Act 2000 / Indian Partnership Act 1932 / US ESIGN / EU eIDAS Regulations.",
          },
        ],
      }),
    fields: [
      {
        id: "f-part-a-sig",
        roleId: "role-[#3b82f6]",
        roleName: "Partner A",
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
        id: "f-part-a-date",
        roleId: "role-[#3b82f6]",
        roleName: "Partner A",
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
        id: "f-part-b-sig",
        roleId: "role-[#10b981]",
        roleName: "Partner B",
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
        id: "f-part-b-date",
        roleId: "role-[#10b981]",
        roleName: "Partner B",
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
    id: "tpl-bill-of-sale",
    name: "Bill of Sale & Asset Purchase",
    description: "Legal transfer contract conveying full title and ownership of personal or commercial equipment and assets.",
    fileName: "Bill-Of-Sale-Asset-Transfer.pdf",
    pageCount: 1,
    category: "Sales & Commercial",
    roles: [
      { id: "role-seller", name: "Seller / Transferor", color: "#3b82f6", signingOrder: 1 },
      { id: "role-buyer-asset", name: "Buyer / Transferee", color: "#8b5cf6", signingOrder: 2 },
    ],
    generateDoc: () =>
      createContractDoc({
        title: "Bill of Sale & Asset Purchase Agreement",
        subtitle: "Title Conveyance, Warranty Disclaimers & Asset Ownership Transfer",
        referenceCode: "BILL-OF-SALE-2026",
        party1Label: "Seller / Transferor",
        party2Label: "Buyer / Transferee",
        sections: [
          {
            heading: "1. Asset Transfer & Purchase Consideration",
            body: "Seller hereby sells, conveys, and transfers to Buyer all right, title, and unencumbered ownership interest in the designated commercial equipment or assets.",
          },
          {
            heading: "2. Warranty of Unencumbered Title",
            body: "Seller warrants that the asset is sold free and clear of all liens, mortgages, claims, or security interests.",
          },
          {
            heading: "3. 'As-Is' Condition Disclaimer",
            body: "Unless explicitly stated, the asset is conveyed 'AS-IS, WHERE-IS' without implied warranties of merchantability or fitness for a particular purpose.",
          },
          {
            heading: "4. Electronic Signatures & Statutory Validity",
            body: "Executed under Section 10A of the IT Act 2000 / Sales of Goods Act / US ESIGN Act / EU eIDAS Regulations.",
          },
        ],
      }),
    fields: [
      {
        id: "f-bos-sel-sig",
        roleId: "role-seller",
        roleName: "Seller / Transferor",
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
        id: "f-bos-sel-date",
        roleId: "role-seller",
        roleName: "Seller / Transferor",
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
        id: "f-bos-buy-sig",
        roleId: "role-buyer-asset",
        roleName: "Buyer / Transferee",
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
        id: "f-bos-buy-date",
        roleId: "role-buyer-asset",
        roleName: "Buyer / Transferee",
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
    id: "tpl-promissory-note",
    name: "Promissory Note & Loan Agreement",
    description: "Financial loan contract establishing principal amount, annual interest rate, payment schedule, and remedies upon default.",
    fileName: "Promissory-Note-Loan-Agreement.pdf",
    pageCount: 1,
    category: "Financial & Legal",
    roles: [
      { id: "role-borrower", name: "Borrower / Debtor", color: "#ef4444", signingOrder: 1 },
      { id: "role-lender", name: "Lender / Creditor", color: "#3b82f6", signingOrder: 2 },
    ],
    generateDoc: () =>
      createContractDoc({
        title: "Promissory Note & Loan Agreement",
        subtitle: "Debt Financing, Repayment Schedule & Default Remedies",
        referenceCode: "LOAN-NOTE-2026",
        party1Label: "Borrower / Debtor",
        party2Label: "Lender / Creditor",
        sections: [
          {
            heading: "1. Principal Amount & Interest Terms",
            body: "For value received, Borrower promises to pay to Lender the Principal sum together with simple annual interest accrued on the unpaid principal balance.",
          },
          {
            heading: "2. Repayment Installments & Prepayment",
            body: "Repayment shall be made in equal monthly installments commencing 30 days from execution. Borrower reserves the right to prepay principal without penalty.",
          },
          {
            heading: "3. Events of Default & Acceleration",
            body: "Failure to pay any sum within 10 days of due date constitutes default. Lender may accelerate full remaining principal and accrued interest immediately.",
          },
          {
            heading: "4. Statutory Electronic Assent & Legal Enforceability",
            body: "Executed under Section 10A of the IT Act 2000 / Negotiable Instruments Law / US ESIGN / EU eIDAS Regulations.",
          },
        ],
      }),
    fields: [
      {
        id: "f-note-bor-sig",
        roleId: "role-borrower",
        roleName: "Borrower / Debtor",
        roleColor: "#ef4444",
        type: "signature",
        page: 1,
        xPercent: 0.072,
        yPercent: 0.814,
        widthPercent: 0.382,
        heightPercent: 0.065,
        required: true,
      },
      {
        id: "f-note-bor-date",
        roleId: "role-borrower",
        roleName: "Borrower / Debtor",
        roleColor: "#ef4444",
        type: "date",
        page: 1,
        xPercent: 0.072,
        yPercent: 0.902,
        widthPercent: 0.382,
        heightPercent: 0.028,
        required: true,
      },
      {
        id: "f-note-len-sig",
        roleId: "role-lender",
        roleName: "Lender / Creditor",
        roleColor: "#3b82f6",
        type: "signature",
        page: 1,
        xPercent: 0.545,
        yPercent: 0.814,
        widthPercent: 0.382,
        heightPercent: 0.065,
        required: true,
      },
      {
        id: "f-note-len-date",
        roleId: "role-lender",
        roleName: "Lender / Creditor",
        roleColor: "#3b82f6",
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
    id: "tpl-settlement",
    name: "Mutual Release & Settlement Agreement",
    description: "Legal dispute resolution agreement discharging claims, waiving liability, and establishing non-disparagement covenants.",
    fileName: "Mutual-Release-Settlement-Agreement.pdf",
    pageCount: 1,
    category: "Legal & Corporate",
    roles: [
      { id: "role-party-a", name: "Releasing Party A", color: "#3b82f6", signingOrder: 1 },
      { id: "role-party-b", name: "Releasing Party B", color: "#10b981", signingOrder: 2 },
    ],
    generateDoc: () =>
      createContractDoc({
        title: "Mutual Release & Settlement Agreement",
        subtitle: "Full & Final Discharge of Claims, Liability Release & Confidentiality",
        referenceCode: "SETTLEMENT-2026",
        party1Label: "Releasing Party A",
        party2Label: "Releasing Party B",
        sections: [
          {
            heading: "1. Dispute Settlement & Full Release of Claims",
            body: "The parties irrevocably release, compromise, and forever discharge each other from all past, present, or future claims, demands, liabilities, or causes of action.",
          },
          {
            heading: "2. No Admission of Liability",
            body: "This settlement is executed solely for commercial peace and shall not be construed as an admission of fault or liability by either party.",
          },
          {
            heading: "3. Non-Disparagement & Confidentiality",
            body: "Both parties agree to maintain strict confidentiality regarding settlement terms and refrain from making disparaging remarks in public or electronic forums.",
          },
          {
            heading: "4. Statutory Electronic Assent & Legal Enforceability",
            body: "Executed under Section 10A of the IT Act 2000 / Civil Procedure Laws / US ESIGN / EU eIDAS Regulations.",
          },
        ],
      }),
    fields: [
      {
        id: "f-set-a-sig",
        roleId: "role-party-a",
        roleName: "Releasing Party A",
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
        id: "f-set-a-date",
        roleId: "role-party-a",
        roleName: "Releasing Party A",
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
        id: "f-set-b-sig",
        roleId: "role-party-b",
        roleName: "Releasing Party B",
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
        id: "f-set-b-date",
        roleId: "role-party-b",
        roleName: "Releasing Party B",
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
    id: "tpl-board-resolution",
    name: "Corporate Board Resolution",
    description: "Formal board resolution documenting corporate authorizations, signing officer power, and statutory board decisions.",
    fileName: "Corporate-Board-Resolution.pdf",
    pageCount: 1,
    category: "Legal & Corporate",
    roles: [
      { id: "role-chairman", name: "Board Chairman", color: "#3b82f6", signingOrder: 1 },
      { id: "role-secretary", name: "Company Secretary", color: "#8b5cf6", signingOrder: 2 },
    ],
    generateDoc: () =>
      createContractDoc({
        title: "Corporate Board Resolution & Authorization",
        subtitle: "Certified Board Action, Officer Execution Power & Statutory Attestation",
        referenceCode: "BOARD-RES-2026",
        party1Label: "Board Chairman",
        party2Label: "Company Secretary",
        sections: [
          {
            heading: "1. Board Recitals & Resolution Approval",
            body: "RESOLVED, that the Board of Directors hereby authorizes the execution of commercial agreements and empowers designated officers to execute binding contracts on behalf of the Corporation.",
          },
          {
            heading: "2. Authorized Officer Signing Power",
            body: "FURTHER RESOLVED, that designated officers are authorized to sign, deliver, and perform all acts necessary to carry out the intent of this resolution.",
          },
          {
            heading: "3. Corporate Attestation & Certification",
            body: "The Secretary certifies that this resolution was duly adopted at a meeting of the Board of Directors with full legal quorum present.",
          },
          {
            heading: "4. Statutory Electronic Assent & Legal Enforceability",
            body: "Executed under Section 10A of the IT Act 2000 / Companies Act 2013 / US ESIGN / EU eIDAS Regulations.",
          },
        ],
      }),
    fields: [
      {
        id: "f-brd-chr-sig",
        roleId: "role-chairman",
        roleName: "Board Chairman",
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
        id: "f-brd-chr-date",
        roleId: "role-chairman",
        roleName: "Board Chairman",
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
        id: "f-brd-sec-sig",
        roleId: "role-secretary",
        roleName: "Company Secretary",
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
        id: "f-brd-sec-date",
        roleId: "role-secretary",
        roleName: "Company Secretary",
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
