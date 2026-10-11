// The general pack: the templates the product shipped with before guided templates existed,
// converted from hand-drawn PDFs into template definitions (plan task P4-01). Their wording is
// generic and has not been reviewed for India. Each one's closing clause, which declared the
// electronic signature valid under Indian, US and EU law, was removed, and the promissory note
// was left out because the IT Act still excludes it between private individuals.
// `legacyId` is the id each one had in the old prebuilt list.

export default [
  {
    "key": "general-nda",
    "legacyId": "tpl-nda",
    "version": 1,
    "language": "en",
    "pack": "general",
    "industry": "Legal & Corporate",
    "title": "Mutual Non-Disclosure Agreement (NDA)",
    "summary": "Confidentiality, Intellectual Property & Non-Disclosure Contract",
    "signatureHint": {
      "level": "check",
      "text": "Check whether stamp duty or registration applies to this document in your state before relying on it."
    },
    "stateNotes": [],
    "reviewer": null,
    "roles": [
      {
        "id": "disclosing",
        "name": "Disclosing Party",
        "color": "#3b82f6",
        "signingOrder": 1,
        "nameFrom": "disclosing_name"
      },
      {
        "id": "receiving",
        "name": "Receiving Party",
        "color": "#10b981",
        "signingOrder": 2,
        "nameFrom": "receiving_name"
      }
    ],
    "questions": [
      {
        "id": "agreement_date",
        "label": "Date of the agreement",
        "type": "date",
        "required": true,
        "default": "today"
      },
      {
        "id": "disclosing_name",
        "label": "Name of the Disclosing Party",
        "type": "text",
        "required": true
      },
      {
        "id": "receiving_name",
        "label": "Name of the Receiving Party",
        "type": "text",
        "required": true
      }
    ],
    "body": [
      {
        "type": "title",
        "text": "Mutual Non-Disclosure Agreement"
      },
      {
        "type": "paragraph",
        "text": "This agreement is made on {{agreement_date|date}} between **{{disclosing_name}}** (the \"Disclosing Party\") and **{{receiving_name}}** (the \"Receiving Party\")."
      },
      {
        "type": "clause",
        "heading": "Purpose and Consideration",
        "text": "The Disclosing Party and Receiving Party agree to share proprietary commercial, financial, and technical information strictly for evaluating and pursuing joint business opportunities, subject to full confidentiality terms."
      },
      {
        "type": "clause",
        "heading": "Definition of Confidential Information",
        "text": "Confidential Information includes all non-public technical specifications, trade secrets, software algorithms, customer data, and business strategies disclosed in oral, visual, or written electronic format."
      },
      {
        "type": "clause",
        "heading": "Non-Disclosure & Duty of Care",
        "text": "The Receiving Party agrees to maintain strict confidentiality using no less than reasonable standard of care, shall not distribute or reverse engineer materials, and shall restrict access solely to essential authorized personnel."
      },
      {
        "type": "clause",
        "heading": "Term, Governing Law & Jurisdiction",
        "text": "This Agreement remains valid for two (2) years from execution. This contract is governed by and construed in accordance with the laws of India (Indian Contract Act 1872) and international commercial jurisdiction."
      },
      {
        "type": "signatures"
      }
    ]
  },
  {
    "key": "general-offer-letter",
    "legacyId": "tpl-offer-letter",
    "version": 1,
    "language": "en",
    "pack": "general",
    "industry": "Human Resources",
    "title": "Employment Offer Letter",
    "summary": "Appointment Letter, Remuneration & Terms of Service",
    "signatureHint": {
      "level": "check",
      "text": "Check whether stamp duty or registration applies to this document in your state before relying on it."
    },
    "stateNotes": [],
    "reviewer": null,
    "roles": [
      {
        "id": "employer",
        "name": "Hiring Manager",
        "color": "#3b82f6",
        "signingOrder": 1,
        "nameFrom": "employer_name"
      },
      {
        "id": "candidate",
        "name": "Candidate",
        "color": "#8b5cf6",
        "signingOrder": 2,
        "nameFrom": "candidate_name"
      }
    ],
    "questions": [
      {
        "id": "agreement_date",
        "label": "Date of the agreement",
        "type": "date",
        "required": true,
        "default": "today"
      },
      {
        "id": "employer_name",
        "label": "Name of the Hiring Manager",
        "type": "text",
        "required": true
      },
      {
        "id": "candidate_name",
        "label": "Name of the Candidate",
        "type": "text",
        "required": true
      }
    ],
    "body": [
      {
        "type": "title",
        "text": "Employment Offer & Terms Agreement"
      },
      {
        "type": "paragraph",
        "text": "This agreement is made on {{agreement_date|date}} between **{{employer_name}}** (the \"Hiring Manager\") and **{{candidate_name}}** (the \"Candidate\")."
      },
      {
        "type": "clause",
        "heading": "Position, Role & Responsibilities",
        "text": "The Employer hereby offers and the Candidate accepts appointment to the designated role. The Candidate will perform duties diligently in compliance with company policies, standards, and directives."
      },
      {
        "type": "clause",
        "heading": "Remuneration, Benefits & Notice Period",
        "text": "The Candidate shall receive the agreed annual compensation package payable on monthly payroll cycles, along with standard statutory medical insurance, leave benefits, and a 30-day mutual notice period."
      },
      {
        "type": "clause",
        "heading": "Confidentiality, Non-Solicitation & IP Assignment",
        "text": "All intellectual property, software systems, and business documents created during employment belong exclusively to the Employer. The Candidate agrees to maintain strict commercial confidentiality."
      },
      {
        "type": "signatures"
      }
    ]
  },
  {
    "key": "general-contractor",
    "legacyId": "tpl-contractor",
    "version": 1,
    "language": "en",
    "pack": "general",
    "industry": "Consulting & Services",
    "title": "Independent Contractor Agreement",
    "summary": "Consulting Scope of Work, Milestones & IP Assignment",
    "signatureHint": {
      "level": "check",
      "text": "Check whether stamp duty or registration applies to this document in your state before relying on it."
    },
    "stateNotes": [],
    "reviewer": null,
    "roles": [
      {
        "id": "client",
        "name": "Client / Principal",
        "color": "#3b82f6",
        "signingOrder": 1,
        "nameFrom": "client_name"
      },
      {
        "id": "contractor",
        "name": "Contractor",
        "color": "#f59e0b",
        "signingOrder": 2,
        "nameFrom": "contractor_name"
      }
    ],
    "questions": [
      {
        "id": "agreement_date",
        "label": "Date of the agreement",
        "type": "date",
        "required": true,
        "default": "today"
      },
      {
        "id": "client_name",
        "label": "Name of the Client / Principal",
        "type": "text",
        "required": true
      },
      {
        "id": "contractor_name",
        "label": "Name of the Contractor",
        "type": "text",
        "required": true
      }
    ],
    "body": [
      {
        "type": "title",
        "text": "Independent Contractor Agreement"
      },
      {
        "type": "paragraph",
        "text": "This agreement is made on {{agreement_date|date}} between **{{client_name}}** (the \"Client / Principal\") and **{{contractor_name}}** (the \"Contractor\")."
      },
      {
        "type": "clause",
        "heading": "Scope of Work & Deliverables",
        "text": "The Contractor agrees to deliver independent engineering and consulting services as defined in project milestones, with professional standard of craftsmanship and timeliness."
      },
      {
        "type": "clause",
        "heading": "Compensation & Milestone Invoicing",
        "text": "Invoices will be submitted upon milestone acceptance and paid within 15 business days. The Contractor operates strictly as an independent entity responsible for their own tax obligations."
      },
      {
        "type": "clause",
        "heading": "Work Product Ownership (Work Made For Hire)",
        "text": "All deliverables, code, designs, and documentation produced under this agreement shall be the exclusive property of the Client upon completion of payment."
      },
      {
        "type": "signatures"
      }
    ]
  },
  {
    "key": "general-residential-lease",
    "legacyId": "tpl-residential-lease",
    "version": 1,
    "language": "en",
    "pack": "general",
    "industry": "Real Estate",
    "title": "Residential Lease Agreement",
    "summary": "Premises Lease, Rent Schedule & Tenancy Regulations",
    "signatureHint": {
      "level": "check",
      "text": "Check whether stamp duty or registration applies to this document in your state before relying on it."
    },
    "stateNotes": [],
    "reviewer": null,
    "roles": [
      {
        "id": "landlord",
        "name": "Landlord / Owner",
        "color": "#3b82f6",
        "signingOrder": 1,
        "nameFrom": "landlord_name"
      },
      {
        "id": "tenant",
        "name": "Tenant",
        "color": "#ec4899",
        "signingOrder": 2,
        "nameFrom": "tenant_name"
      }
    ],
    "questions": [
      {
        "id": "agreement_date",
        "label": "Date of the agreement",
        "type": "date",
        "required": true,
        "default": "today"
      },
      {
        "id": "landlord_name",
        "label": "Name of the Landlord / Owner",
        "type": "text",
        "required": true
      },
      {
        "id": "tenant_name",
        "label": "Name of the Tenant",
        "type": "text",
        "required": true
      }
    ],
    "body": [
      {
        "type": "title",
        "text": "Residential Tenancy Agreement"
      },
      {
        "type": "paragraph",
        "text": "This agreement is made on {{agreement_date|date}} between **{{landlord_name}}** (the \"Landlord / Owner\") and **{{tenant_name}}** (the \"Tenant\")."
      },
      {
        "type": "clause",
        "heading": "Demised Premises & Lease Term",
        "text": "The Landlord leases to the Tenant the designated residential property for an initial fixed term of 11/12 months, renewable upon mutual written agreement."
      },
      {
        "type": "clause",
        "heading": "Monthly Rent, Utility Charges & Security Deposit",
        "text": "Rent is payable in advance by the 5th of each calendar month. The refundable security deposit is held without interest to secure covenants and repair of damages beyond normal wear and tear."
      },
      {
        "type": "clause",
        "heading": "Maintenance, Quiet Enjoyment & Inspections",
        "text": "The Tenant shall maintain the premises cleanly, refrain from sub-leasing or illegal acts, and permit reasonable inspection with 24-hour advance written notice."
      },
      {
        "type": "signatures"
      }
    ]
  },
  {
    "key": "general-sales-proposal",
    "legacyId": "tpl-sales-proposal",
    "version": 1,
    "language": "en",
    "pack": "general",
    "industry": "Sales & Commercial",
    "title": "Sales Proposal & Statement of Work",
    "summary": "Commercial Terms, Project Pricing & Execution Sign-Off",
    "signatureHint": {
      "level": "check",
      "text": "Check whether stamp duty or registration applies to this document in your state before relying on it."
    },
    "stateNotes": [],
    "reviewer": null,
    "roles": [
      {
        "id": "vendor",
        "name": "Service Provider",
        "color": "#3b82f6",
        "signingOrder": 1,
        "nameFrom": "vendor_name"
      },
      {
        "id": "buyer",
        "name": "Client / Buyer",
        "color": "#10b981",
        "signingOrder": 2,
        "nameFrom": "buyer_name"
      }
    ],
    "questions": [
      {
        "id": "agreement_date",
        "label": "Date of the agreement",
        "type": "date",
        "required": true,
        "default": "today"
      },
      {
        "id": "vendor_name",
        "label": "Name of the Service Provider",
        "type": "text",
        "required": true
      },
      {
        "id": "buyer_name",
        "label": "Name of the Client / Buyer",
        "type": "text",
        "required": true
      }
    ],
    "body": [
      {
        "type": "title",
        "text": "Sales Proposal & Statement of Work"
      },
      {
        "type": "paragraph",
        "text": "This agreement is made on {{agreement_date|date}} between **{{vendor_name}}** (the \"Service Provider\") and **{{buyer_name}}** (the \"Client / Buyer\")."
      },
      {
        "type": "clause",
        "heading": "Scope of Deliverables & Services",
        "text": "Provider agrees to furnish software customization, technical deployment, and SLA support services as described in the agreed commercial quote."
      },
      {
        "type": "clause",
        "heading": "Commercial Pricing & Payment Milestones",
        "text": "Payment is structured 50% upon initial execution and 50% upon final acceptance sign-off. All prices are net of applicable statutory taxes."
      },
      {
        "type": "clause",
        "heading": "Warranty, Acceptance & SLA",
        "text": "Provider warrants deliverables for 90 days following deployment against programming defects and provides tier-1 response times."
      },
      {
        "type": "signatures"
      }
    ]
  },
  {
    "key": "general-msa",
    "legacyId": "tpl-msa",
    "version": 1,
    "language": "en",
    "pack": "general",
    "industry": "Legal & Corporate",
    "title": "Master Services Agreement (MSA)",
    "summary": "Enterprise B2B Service Framework and Liability",
    "signatureHint": {
      "level": "check",
      "text": "Check whether stamp duty or registration applies to this document in your state before relying on it."
    },
    "stateNotes": [],
    "reviewer": null,
    "roles": [
      {
        "id": "msa-provider",
        "name": "Service Provider",
        "color": "#3b82f6",
        "signingOrder": 1,
        "nameFrom": "msa_provider_name"
      },
      {
        "id": "msa-client",
        "name": "Enterprise Client",
        "color": "#10b981",
        "signingOrder": 2,
        "nameFrom": "msa_client_name"
      }
    ],
    "questions": [
      {
        "id": "agreement_date",
        "label": "Date of the agreement",
        "type": "date",
        "required": true,
        "default": "today"
      },
      {
        "id": "msa_provider_name",
        "label": "Name of the Service Provider",
        "type": "text",
        "required": true
      },
      {
        "id": "msa_client_name",
        "label": "Name of the Enterprise Client",
        "type": "text",
        "required": true
      }
    ],
    "body": [
      {
        "type": "title",
        "text": "Master Services Agreement (MSA)"
      },
      {
        "type": "paragraph",
        "text": "This agreement is made on {{agreement_date|date}} between **{{msa_provider_name}}** (the \"Service Provider\") and **{{msa_client_name}}** (the \"Enterprise Client\")."
      },
      {
        "type": "clause",
        "heading": "Framework & Statements of Work",
        "text": "This Master Services Agreement governs all Statements of Work (SOWs) executed between the parties. In the event of inconsistency, the terms of this MSA shall prevail unless explicitly stated."
      },
      {
        "type": "clause",
        "heading": "Payment Terms, Audit & Taxes",
        "text": "Invoices are due net 30 days from billing date. Late payments accrue interest at 1.5% per month. Client assumes responsibility for applicable statutory sales or service taxes."
      },
      {
        "type": "clause",
        "heading": "Indemnification & Limitation of Liability",
        "text": "Each party shall indemnify the other against third-party IP infringement claims. Neither party's aggregate liability under this agreement shall exceed total fees paid during the preceding 12 months."
      },
      {
        "type": "signatures"
      }
    ]
  },
  {
    "key": "general-ip-assignment",
    "legacyId": "tpl-ip-assignment",
    "version": 1,
    "language": "en",
    "pack": "general",
    "industry": "Intellectual Property",
    "title": "Intellectual Property (IP) Assignment",
    "summary": "Invention Transfer, Copyright Assignment & Moral Rights Waiver",
    "signatureHint": {
      "level": "check",
      "text": "Check whether stamp duty or registration applies to this document in your state before relying on it."
    },
    "stateNotes": [],
    "reviewer": null,
    "roles": [
      {
        "id": "assignor",
        "name": "Assignor / Creator",
        "color": "#f59e0b",
        "signingOrder": 1,
        "nameFrom": "assignor_name"
      },
      {
        "id": "assignee",
        "name": "Assignee / Company",
        "color": "#3b82f6",
        "signingOrder": 2,
        "nameFrom": "assignee_name"
      }
    ],
    "questions": [
      {
        "id": "agreement_date",
        "label": "Date of the agreement",
        "type": "date",
        "required": true,
        "default": "today"
      },
      {
        "id": "assignor_name",
        "label": "Name of the Assignor / Creator",
        "type": "text",
        "required": true
      },
      {
        "id": "assignee_name",
        "label": "Name of the Assignee / Company",
        "type": "text",
        "required": true
      }
    ],
    "body": [
      {
        "type": "title",
        "text": "Intellectual Property Assignment Agreement"
      },
      {
        "type": "paragraph",
        "text": "This agreement is made on {{agreement_date|date}} between **{{assignor_name}}** (the \"Assignor / Creator\") and **{{assignee_name}}** (the \"Assignee / Company\")."
      },
      {
        "type": "clause",
        "heading": "Irrevocable Assignment of Rights",
        "text": "The Assignor hereby irrevocably assigns, transfers, and conveys to the Assignee all right, title, and interest worldwide in and to all inventions, code, software algorithms, patents, trademarks, and copyrights."
      },
      {
        "type": "clause",
        "heading": "Waiver of Moral Rights & Power of Attorney",
        "text": "Assignor irrevocably waives all moral rights under copyright law. Assignor grants Assignee power of attorney to execute registration deeds necessary to perfect intellectual property titles."
      },
      {
        "type": "clause",
        "heading": "Consideration & Further Assurances",
        "text": "This assignment is executed for valid monetary and contractual consideration. Assignor agrees to execute subsequent assignment documentation upon reasonable request."
      },
      {
        "type": "signatures"
      }
    ]
  },
  {
    "key": "general-saas-license",
    "legacyId": "tpl-saas-license",
    "version": 1,
    "language": "en",
    "pack": "general",
    "industry": "Technology & SaaS",
    "title": "Software Licensing & SaaS Agreement",
    "summary": "Cloud Subscription Grant, SLA Uptime & Data Security Covenants",
    "signatureHint": {
      "level": "check",
      "text": "Check whether stamp duty or registration applies to this document in your state before relying on it."
    },
    "stateNotes": [],
    "reviewer": null,
    "roles": [
      {
        "id": "licensor",
        "name": "Software Licensor",
        "color": "#3b82f6",
        "signingOrder": 1,
        "nameFrom": "licensor_name"
      },
      {
        "id": "licensee",
        "name": "Subscriber / Licensee",
        "color": "#ec4899",
        "signingOrder": 2,
        "nameFrom": "licensee_name"
      }
    ],
    "questions": [
      {
        "id": "agreement_date",
        "label": "Date of the agreement",
        "type": "date",
        "required": true,
        "default": "today"
      },
      {
        "id": "licensor_name",
        "label": "Name of the Software Licensor",
        "type": "text",
        "required": true
      },
      {
        "id": "licensee_name",
        "label": "Name of the Subscriber / Licensee",
        "type": "text",
        "required": true
      }
    ],
    "body": [
      {
        "type": "title",
        "text": "Software Licensing & SaaS Terms Agreement"
      },
      {
        "type": "paragraph",
        "text": "This agreement is made on {{agreement_date|date}} between **{{licensor_name}}** (the \"Software Licensor\") and **{{licensee_name}}** (the \"Subscriber / Licensee\")."
      },
      {
        "type": "clause",
        "heading": "Non-Exclusive License Grant",
        "text": "Licensor grants Licensee a non-exclusive, non-transferable subscription license to access the SaaS platform in accordance with designated user seat quotas."
      },
      {
        "type": "clause",
        "heading": "Service Level Agreement (SLA) & Support",
        "text": "Licensor guarantees 99.9% monthly service uptime excluding scheduled maintenance windows. Technical support is furnished according to subscription tier provisions."
      },
      {
        "type": "clause",
        "heading": "Data Protection & Cybersecurity Covenants",
        "text": "Licensor agrees to maintain SOC2 / ISO27001 data security compliance and encrypt customer data in transit and at rest."
      },
      {
        "type": "signatures"
      }
    ]
  },
  {
    "key": "general-commercial-lease",
    "legacyId": "tpl-commercial-lease",
    "version": 1,
    "language": "en",
    "pack": "general",
    "industry": "Real Estate",
    "title": "Commercial Property Lease",
    "summary": "Commercial Premises Tenancy, Base Rent & Operating Expense Covenants",
    "signatureHint": {
      "level": "check",
      "text": "Check whether stamp duty or registration applies to this document in your state before relying on it."
    },
    "stateNotes": [],
    "reviewer": null,
    "roles": [
      {
        "id": "com-landlord",
        "name": "Commercial Landlord",
        "color": "#3b82f6",
        "signingOrder": 1,
        "nameFrom": "com_landlord_name"
      },
      {
        "id": "com-tenant",
        "name": "Commercial Tenant",
        "color": "#f59e0b",
        "signingOrder": 2,
        "nameFrom": "com_tenant_name"
      }
    ],
    "questions": [
      {
        "id": "agreement_date",
        "label": "Date of the agreement",
        "type": "date",
        "required": true,
        "default": "today"
      },
      {
        "id": "com_landlord_name",
        "label": "Name of the Commercial Landlord",
        "type": "text",
        "required": true
      },
      {
        "id": "com_tenant_name",
        "label": "Name of the Commercial Tenant",
        "type": "text",
        "required": true
      }
    ],
    "body": [
      {
        "type": "title",
        "text": "Commercial Property Lease Agreement"
      },
      {
        "type": "paragraph",
        "text": "This agreement is made on {{agreement_date|date}} between **{{com_landlord_name}}** (the \"Commercial Landlord\") and **{{com_tenant_name}}** (the \"Commercial Tenant\")."
      },
      {
        "type": "clause",
        "heading": "Demised Commercial Premises & Permitted Use",
        "text": "Landlord hereby leases to Tenant the commercial real estate premises strictly for corporate office, retail, or industrial operations in accordance with municipal zoning bylaws."
      },
      {
        "type": "clause",
        "heading": "Base Rent, CAM & Taxes",
        "text": "Tenant agrees to pay monthly Base Rent in advance plus Pro Rata Share of Common Area Maintenance (CAM) and real property statutory taxes."
      },
      {
        "type": "clause",
        "heading": "Maintenance, Alterations & Insurance",
        "text": "Tenant shall maintain comprehensive commercial general liability insurance and shall not execute structural alterations without prior written consent."
      },
      {
        "type": "signatures"
      }
    ]
  },
  {
    "key": "general-partnership",
    "legacyId": "tpl-partnership",
    "version": 1,
    "language": "en",
    "pack": "general",
    "industry": "Legal & Corporate",
    "title": "General Partnership Agreement",
    "summary": "Commercial Business Entity Formation, Equity & Governance Covenants",
    "signatureHint": {
      "level": "check",
      "text": "Check whether stamp duty or registration applies to this document in your state before relying on it."
    },
    "stateNotes": [],
    "reviewer": null,
    "roles": [
      {
        "id": "partner-a",
        "name": "Partner A",
        "color": "#3b82f6",
        "signingOrder": 1,
        "nameFrom": "partner_a_name"
      },
      {
        "id": "partner-b",
        "name": "Partner B",
        "color": "#10b981",
        "signingOrder": 2,
        "nameFrom": "partner_b_name"
      }
    ],
    "questions": [
      {
        "id": "agreement_date",
        "label": "Date of the agreement",
        "type": "date",
        "required": true,
        "default": "today"
      },
      {
        "id": "partner_a_name",
        "label": "Name of the Partner A",
        "type": "text",
        "required": true
      },
      {
        "id": "partner_b_name",
        "label": "Name of the Partner B",
        "type": "text",
        "required": true
      }
    ],
    "body": [
      {
        "type": "title",
        "text": "General Partnership Agreement"
      },
      {
        "type": "paragraph",
        "text": "This agreement is made on {{agreement_date|date}} between **{{partner_a_name}}** (the \"Partner A\") and **{{partner_b_name}}** (the \"Partner B\")."
      },
      {
        "type": "clause",
        "heading": "Formation, Business Purpose & Capital Contributions",
        "text": "The Partners establish a general partnership to conduct commercial operations. Initial capital contributions and equity ratios are recorded in equal distribution unless amended."
      },
      {
        "type": "clause",
        "heading": "Allocation of Profits, Losses & Distributions",
        "text": "Net profits and losses shall be allocated in proportion to equity holdings. Cash distributions shall occur quarterly subject to working capital reserves."
      },
      {
        "type": "clause",
        "heading": "Management Authority & Dissolution",
        "text": "Each Partner possesses equal voting rights in major business decisions. Dissolution requires unanimous written consent or statutory event of withdrawal."
      },
      {
        "type": "signatures"
      }
    ]
  },
  {
    "key": "general-bill-of-sale",
    "legacyId": "tpl-bill-of-sale",
    "version": 1,
    "language": "en",
    "pack": "general",
    "industry": "Sales & Commercial",
    "title": "Bill of Sale & Asset Purchase",
    "summary": "Title Conveyance, Warranty Disclaimers & Asset Ownership Transfer",
    "signatureHint": {
      "level": "check",
      "text": "Check whether stamp duty or registration applies to this document in your state before relying on it."
    },
    "stateNotes": [],
    "reviewer": null,
    "roles": [
      {
        "id": "seller",
        "name": "Seller / Transferor",
        "color": "#3b82f6",
        "signingOrder": 1,
        "nameFrom": "seller_name"
      },
      {
        "id": "buyer-asset",
        "name": "Buyer / Transferee",
        "color": "#8b5cf6",
        "signingOrder": 2,
        "nameFrom": "buyer_asset_name"
      }
    ],
    "questions": [
      {
        "id": "agreement_date",
        "label": "Date of the agreement",
        "type": "date",
        "required": true,
        "default": "today"
      },
      {
        "id": "seller_name",
        "label": "Name of the Seller / Transferor",
        "type": "text",
        "required": true
      },
      {
        "id": "buyer_asset_name",
        "label": "Name of the Buyer / Transferee",
        "type": "text",
        "required": true
      }
    ],
    "body": [
      {
        "type": "title",
        "text": "Bill of Sale & Asset Purchase Agreement"
      },
      {
        "type": "paragraph",
        "text": "This agreement is made on {{agreement_date|date}} between **{{seller_name}}** (the \"Seller / Transferor\") and **{{buyer_asset_name}}** (the \"Buyer / Transferee\")."
      },
      {
        "type": "clause",
        "heading": "Asset Transfer & Purchase Consideration",
        "text": "Seller hereby sells, conveys, and transfers to Buyer all right, title, and unencumbered ownership interest in the designated commercial equipment or assets."
      },
      {
        "type": "clause",
        "heading": "Warranty of Unencumbered Title",
        "text": "Seller warrants that the asset is sold free and clear of all liens, mortgages, claims, or security interests."
      },
      {
        "type": "clause",
        "heading": "'As-Is' Condition Disclaimer",
        "text": "Unless explicitly stated, the asset is conveyed 'AS-IS, WHERE-IS' without implied warranties of merchantability or fitness for a particular purpose."
      },
      {
        "type": "signatures"
      }
    ]
  },
  {
    "key": "general-settlement",
    "legacyId": "tpl-settlement",
    "version": 1,
    "language": "en",
    "pack": "general",
    "industry": "Legal & Corporate",
    "title": "Mutual Release & Settlement Agreement",
    "summary": "Full & Final Discharge of Claims, Liability Release & Confidentiality",
    "signatureHint": {
      "level": "check",
      "text": "Check whether stamp duty or registration applies to this document in your state before relying on it."
    },
    "stateNotes": [],
    "reviewer": null,
    "roles": [
      {
        "id": "party-a",
        "name": "Releasing Party A",
        "color": "#3b82f6",
        "signingOrder": 1,
        "nameFrom": "party_a_name"
      },
      {
        "id": "party-b",
        "name": "Releasing Party B",
        "color": "#10b981",
        "signingOrder": 2,
        "nameFrom": "party_b_name"
      }
    ],
    "questions": [
      {
        "id": "agreement_date",
        "label": "Date of the agreement",
        "type": "date",
        "required": true,
        "default": "today"
      },
      {
        "id": "party_a_name",
        "label": "Name of the Releasing Party A",
        "type": "text",
        "required": true
      },
      {
        "id": "party_b_name",
        "label": "Name of the Releasing Party B",
        "type": "text",
        "required": true
      }
    ],
    "body": [
      {
        "type": "title",
        "text": "Mutual Release & Settlement Agreement"
      },
      {
        "type": "paragraph",
        "text": "This agreement is made on {{agreement_date|date}} between **{{party_a_name}}** (the \"Releasing Party A\") and **{{party_b_name}}** (the \"Releasing Party B\")."
      },
      {
        "type": "clause",
        "heading": "Dispute Settlement & Full Release of Claims",
        "text": "The parties irrevocably release, compromise, and forever discharge each other from all past, present, or future claims, demands, liabilities, or causes of action."
      },
      {
        "type": "clause",
        "heading": "No Admission of Liability",
        "text": "This settlement is executed solely for commercial peace and shall not be construed as an admission of fault or liability by either party."
      },
      {
        "type": "clause",
        "heading": "Non-Disparagement & Confidentiality",
        "text": "Both parties agree to maintain strict confidentiality regarding settlement terms and refrain from making disparaging remarks in public or electronic forums."
      },
      {
        "type": "signatures"
      }
    ]
  },
  {
    "key": "general-board-resolution",
    "legacyId": "tpl-board-resolution",
    "version": 1,
    "language": "en",
    "pack": "general",
    "industry": "Legal & Corporate",
    "title": "Corporate Board Resolution",
    "summary": "Certified Board Action and Officer Execution Power",
    "signatureHint": {
      "level": "check",
      "text": "Check whether stamp duty or registration applies to this document in your state before relying on it."
    },
    "stateNotes": [],
    "reviewer": null,
    "roles": [
      {
        "id": "chairman",
        "name": "Board Chairman",
        "color": "#3b82f6",
        "signingOrder": 1,
        "nameFrom": "chairman_name"
      },
      {
        "id": "secretary",
        "name": "Company Secretary",
        "color": "#8b5cf6",
        "signingOrder": 2,
        "nameFrom": "secretary_name"
      }
    ],
    "questions": [
      {
        "id": "agreement_date",
        "label": "Date of the agreement",
        "type": "date",
        "required": true,
        "default": "today"
      },
      {
        "id": "chairman_name",
        "label": "Name of the Board Chairman",
        "type": "text",
        "required": true
      },
      {
        "id": "secretary_name",
        "label": "Name of the Company Secretary",
        "type": "text",
        "required": true
      }
    ],
    "body": [
      {
        "type": "title",
        "text": "Corporate Board Resolution & Authorization"
      },
      {
        "type": "paragraph",
        "text": "This agreement is made on {{agreement_date|date}} between **{{chairman_name}}** (the \"Board Chairman\") and **{{secretary_name}}** (the \"Company Secretary\")."
      },
      {
        "type": "clause",
        "heading": "Board Recitals & Resolution Approval",
        "text": "RESOLVED, that the Board of Directors hereby authorizes the execution of commercial agreements and empowers designated officers to execute binding contracts on behalf of the Corporation."
      },
      {
        "type": "clause",
        "heading": "Authorized Officer Signing Power",
        "text": "FURTHER RESOLVED, that designated officers are authorized to sign, deliver, and perform all acts necessary to carry out the intent of this resolution."
      },
      {
        "type": "clause",
        "heading": "Corporate Attestation & Certification",
        "text": "The Secretary certifies that this resolution was duly adopted at a meeting of the Board of Directors with full legal quorum present."
      },
      {
        "type": "signatures"
      }
    ]
  }
];
