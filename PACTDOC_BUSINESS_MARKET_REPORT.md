# PactDoc Business & Market Report

Oct 10, 2026 · @sulaiman khan

## Summary

PactDoc should not try to be a cheaper DocuSign for everyone; it should be the simplest pay-as-you-grow signing tool for Indian small businesses and freelancers, then expand outward. That segment sits between enterprise-only Indian vendors and US tools priced in dollars per seat. The code already leans this way: rupee pricing, Razorpay, and an Indian evidence certificate.

Four recommendations follow from the research:

1. **Pick the India small-business wedge.** Add Aadhaar eSign through a licensed provider, regional-language signing and rupee pay-per-use pricing.
2. **Fix the pricing.** The $69 lifetime plan and the $14.99 flat "Enterprise" plan give away the most expensive things for the least money. Remove ads from signing pages.
3. **Grow through the product.** Every signer is a prospect. The template library and free signature tools are ready-made search traffic.
4. **Earn trust before spending on growth.** The technical audit lists issues that would end the business if a customer found them first.

The technical findings are in the companion document, PactDoc Product & Technology Audit.

## Market

E-signature is a large, growing and commoditised market led by one company, with the small-business end served mostly by self-serve tools competing on price.

**Size.** Research firms publish 2025 estimates between roughly $7 billion and $13 billion for digital signatures, with forecast growth near 30% a year. These are headline figures from search results that I did not verify, and the firms define the market differently. Treat them as direction only.

**The leader.** Docusign's [annual report for fiscal 2026 (Feb 2025 to Jan 2026)](https://www.sec.gov/Archives/edgar/data/1261333/000126133326000021/docu-20260131.htm) gives the clearest picture of where the money is:

| Docusign metric, fiscal 2026 | Value |
| --- | --- |
| Total customers | Over 1.8 million |
| Direct enterprise and commercial customers | About 280,000 |
| Customers above $300,000 a year | 1,205 |
| Revenue from self-serve digital sales | 15% |
| Revenue from outside the US | 29% |
| Revenue from subscriptions | 98% |
| Employees | 7,044 |

Reported revenue was about $3.2 billion, up about 8%; that figure comes from earnings summaries, not the filing extract I read.

**What this tells you.** About 1.5 million Docusign customers buy online and together produce only 15% of revenue. The leader earns its money from sales-led enterprise deals and is moving further up-market with its agreement-management suite, now 10.8% of recurring revenue. The self-serve small customer is low priority for it. That is the opening, and also the warning: small customers pay little each, so the business needs low costs and a growth loop that does not depend on paid sales.

**Segments.**

| Segment | What they need | Who serves them now |
| --- | --- | --- |
| Individuals and freelancers | A few documents a month, free or near-free | Free tiers of Zoho Sign, Documenso, DocuSeal, Dropbox Sign |
| Small businesses | Templates, reminders, a few seats, simple billing | Dropbox Sign, signNow, Zoho Sign, PandaDoc |
| Developers and platforms | API, embedded signing, per-document pricing | DocuSeal, Documenso, Dropbox Sign API |
| Indian regulated lenders and insurers | Aadhaar eSign, e-stamping, integrations | Leegality, Digio, eMudhra |
| Enterprises | SSO, compliance, contract lifecycle | Docusign, Adobe |

## How competitors make money

There are four business models in this market: seats with envelope caps, flat seats with unlimited sending, open-core with usage fees, and per-signature APIs. Prices are from vendor pages opened on 10 October 2026 unless marked.

| Company | Model | Entry paid price | Free tier | Where the real money comes from |
| --- | --- | --- | --- | --- |
| Docusign | Per seat, capped envelopes, annual contracts | $11 a month Personal (5 envelopes a month); $30 and $45 per user for Standard and Business Pro (100 envelopes per user a year), per a [third-party July 2026 guide](https://automationatlas.io/answers/docusign-pricing-explained-2026/) | None | Enterprise contracts sold by a direct sales force; add-ons; agreement-management suite |
| [Dropbox Sign](https://sign.dropbox.com/info/pricing) | Per seat, unlimited requests | $15 a month for one user; $25 per user with a 2-user minimum | Sign-only | Bundling with Dropbox; a separately priced API; custom Premium tier from 5 users |
| [Zoho Sign](https://www.zoho.com/sign/pricing.html) | Per seat plus credits | Prices not shown on the page read; Standard allows 25 envelopes per user a month | 1 user, 5 envelopes a month | Cross-sell inside the Zoho suite; credits for SMS, bulk send and API |
| [Documenso](https://documenso.com/pricing) | Open-core, flat tiers | $25 a month individual; $40 a month for a 5-user team, $8 per extra user | 5 documents a month | $250 a month Platform tier for API and white-label embedding; enterprise self-host licences |
| [DocuSeal](https://www.docuseal.com/pricing) | Open-core, seats plus usage | $20 per user a month | 10 signature requests a month | $0.20 per document completed through API or embedding; $2 ID checks; $2 to $4 qualified signatures; $0.20 per SMS |
| Leegality, Digio, eMudhra | Per signature, sold to businesses | Not published; indicative ₹5 to ₹50 per Aadhaar eSign from secondary sources | None | High-volume contracts with lenders and insurers; e-stamping; KYC bundles |

Three patterns matter for PactDoc:

- **Nobody profitable sells unlimited use for a one-time fee.** Even the open-source vendors charge every month and add usage fees.
- **API and embedding are the premium tier everywhere.** Documenso charges ten times its individual price for it. DocuSeal meters it per document.
- **Identity checks are sold as pass-through add-ons with margin.** SMS, ID documents and qualified signatures are all priced per use.

PactDoc's current prices, from `server/src/services/billing.service.js`:

| Plan | Price | What it includes |
| --- | --- | --- |
| Free | $0 | 15 sends a month, ads on signing pages |
| Pro monthly | $5.99 or ₹499 | Unlimited sends, templates, bulk send |
| Pro annual | $49 or ₹3,999 | Same |
| Lifetime | $69 or ₹5,499, once | Same, forever |
| Business & Enterprise | $14.99 or ₹1,199 a month, flat | Workspaces, branding, API keys, webhooks |

## What customers complain about

Buyers of the incumbents complain most about caps, lock-in and surprise fees; that is where a newcomer can be visibly better. The first four rows are visible on the vendors' own pricing pages. The last three come from review-site summaries in search results, many written by rival vendors, so weigh them accordingly.

| Complaint | Evidence | PactDoc's opening |
| --- | --- | --- |
| Envelope caps on paid plans | Docusign Standard: 100 envelopes per user a year | Clear monthly allowances with cheap top-ups |
| Seat minimums | Dropbox Sign Standard starts at 2 users | One-person plans that grow one seat at a time |
| API priced as a separate product | Dropbox Sign, Documenso Platform at $250 | Low monthly minimum plus per-document fee |
| Tiny free tiers | 5 a month at Zoho Sign and Documenso; none at Docusign | A free tier that is useful, funded by branding, not ads |
| Annual auto-renewal and hard cancellation | Review summaries | Monthly billing and one-click cancel |
| Add-on fees that are hard to predict | Review summaries | A public price list for every add-on |
| Slow support for small accounts | Review summaries | Fast human support as a stated promise |

**The gap in India.** The Aadhaar eSign vendors sell through sales teams to lenders and insurers and do not publish prices. US tools charge in dollars per seat, and few advertise Aadhaar eSign; Zoho Sign and signNow do. A small business, landlord, HR consultant or accountant who wants a legally strong signature for a few rupees, paid by UPI, has few self-serve choices. I could not verify the size of this segment; test it with interviews before committing.

## Positioning, pricing and packaging

Position PactDoc as "legally strong e-signatures for small businesses, priced per use, in your language", and rebuild the price list around seats plus pass-through add-ons. Everything in this section is my recommendation, not a researched fact.

**Three ways to position, and why the first wins.**

| Option | For | Against |
| --- | --- | --- |
| India small-business wedge | Under-served self-serve segment; rupee pricing, Razorpay and the evidence certificate already exist; Aadhaar eSign is a real moat against global tools | Needs a registered business and a provider contract; lower revenue per customer |
| Global cheap Docusign alternative | Largest audience | Crowded; free open-source rivals; no reason to choose PactDoc |
| Developer API | Highest revenue per customer | DocuSeal already charges $0.20 a document; demands reliability PactDoc does not have yet |

**Problems with today's pricing.**

- **Lifetime at $69** sells unlimited sending, storage and email forever for less than 12 months of Pro. Each buyer is a permanent cost and can never pay again.
- **"Enterprise" at $14.99 flat** includes unlimited members, API and white-labelling. Documenso charges $250 a month for the comparable tier.
- **Unlimited sending on every paid plan** leaves no reason to upgrade and no revenue from heavy users.
- **Ads on signing pages** show third-party adverts to your customer's customer while they sign a legal document. That costs trust and earns very little.
- **Free at 15 sends a month** is three times Zoho Sign and Documenso. Generous is fine as a growth tactic, but it should be a decision, with branding on every free document.

**Proposed packaging.** Prices are starting points to test.

| Plan | Price | Includes |
| --- | --- | --- |
| Free | ₹0 | 5 documents a month, 1 sender, "Signed with PactDoc" on emails and the completion page, no ads |
| Solo | ₹299 or $6 a month | 50 documents a month, templates, reminders, email OTP, own logo |
| Team | ₹499 or $10 per user a month | Pooled 100 documents per user, shared workspace, roles, bulk send, branding |
| Platform | ₹2,499 or $39 a month, plus ₹10 or $0.15 per completed document | API, webhooks, embedded signing, sandbox |
| Add-ons | Per use | Aadhaar eSign, SMS OTP, ID check, extra documents |

Price each add-on at provider cost plus a margin, and publish the list. Close the lifetime plan to new buyers, or cap it at a fixed number of founder seats with a monthly fair-use limit. Keep annual billing at two months free.

## India-first recommendation

Launch in India first, aimed at small businesses and freelancers, and treat the global market as a later step. The full plan is in the companion document, PactDoc India Strategy & Build Plan.

**Why India first**

- **The gap.** Indian Aadhaar eSign vendors sell through sales teams to banks and insurers and do not publish prices. US tools charge in dollars per seat. A small business, landlord, accountant or HR consultant who wants a strong signature for a few rupees, paid by UPI, has few self-serve options.
- **A head start.** The code already has rupee pricing, Razorpay and an Indian evidence certificate.
- **The alternative is crowded.** As a cheap Docusign, PactDoc competes with Dropbox Sign, signNow, Zoho Sign and free open-source tools, with nothing that makes it the obvious choice.

**What to build for India**

1. Aadhaar eSign through a licensed provider. PactDoc cannot issue it itself and needs a registered business to sign a provider contract.
2. Hindi and regional-language signing. Non-English text is currently deleted from signed PDFs.
3. WhatsApp-friendly signing links.
4. Rupee pay-per-use pricing, with Aadhaar eSign and SMS OTP as per-use add-ons.

**Pricing changes**

| Now | Suggested |
| --- | --- |
| Free: 15 sends a month, with ads | Free: 5 a month, no ads, PactDoc branding |
| Pro: ₹499 a month, unlimited | Solo: ₹299 a month, 50 documents |
| Enterprise: ₹1,199 flat, unlimited members and API | Team: ₹499 per user; a separate API plan at ₹2,499 plus ₹10 per document |
| Lifetime: ₹5,499 once, unlimited forever | Closed, or capped to a fixed number of founder seats |

**How to get customers**

- Signers: after someone signs, offer to send their own document free.
- Search: publish the templates as public pages.
- Partners: give accountants, company secretaries and property brokers a referral commission.

**Not verified.** The size of the paying segment, the real provider cost per Aadhaar signature, and which document types need Aadhaar eSign. Interview 20 to 30 small businesses, get provider quotes and ask a lawyer before committing.

## Go-to-market and growth

Grow through the product and search, not paid sales: every signed document should bring a new sender, and every template should bring a searcher. These are recommendations.

**1. The signer loop.** Each envelope puts PactDoc in front of people who did not choose it. After signing, show one screen: "Your copy is ready. Send your own document free." Measure the share of signers who become senders. This loop is how the low-priced tools grow, and it is why ads on that page are the wrong trade.

**2. Search.** Three assets already exist in the code:

- The prebuilt template library. Publish each template as a public page, such as rent agreement, offer letter, NDA and freelance contract, with a "fill and send" button.
- The signature tools: draw, type and background remover. Publish them as free tools without login.
- The public verification page, which is a trust signal that most small rivals lack.

Add comparison pages for "Docusign alternative" and a pricing calculator. The complaints table gives the copy.

**3. Channels in India.** Accountants, company secretaries, HR consultants and property brokers each handle documents for many small clients. Offer them a partner plan with a referral commission. Make signing links easy to share over WhatsApp, since small businesses there rarely work by email alone.

**4. Trust page.** Publish how signatures are sealed, which laws apply in each country, where data is stored and how to verify a document. Only claim what the product does.

**5. Later: integrations as distribution.** Listings on Zapier and the Google Workspace Marketplace bring users who are already looking.

**Launch order.**

1. Fix the critical issues in the audit.
2. Private beta with 20 to 30 real small businesses; interview each one.
3. Public launch of the free and Solo plans with template pages live.
4. Add Team once shared workspaces work.
5. Add Aadhaar eSign and the Platform plan.

**Numbers to watch from day one.**

| Metric | Why |
| --- | --- |
| Sign-ups who send a document within 24 hours | Shows the first-use experience works |
| Envelopes completed out of envelopes sent | Shows signers are not getting stuck |
| Signers who become senders | The growth loop |
| Free to paid conversion | Shows the price and limits are set right |
| Monthly churn of paid accounts | Shows the product is habit, not a one-off |
| Cost to serve per document | Keeps low prices sustainable |

## Costs and risks

The business can start on a few thousand rupees a month, but not on zero, and its largest risks are legal and reputational, not technical. Cost levels below are approximate, from general knowledge, and need real quotes.

| Cost | Level | When |
| --- | --- | --- |
| Database with backups | Low monthly fee | Before launch |
| Transactional email on your domain | Free to low at small volume | Before launch |
| Hosting with one always-on instance | Low monthly fee | Before launch |
| Lawyer review of terms, privacy policy and legal claims | One-off | Before launch |
| Payment fees | A few percent of revenue | From first sale |
| Company registration and tax registration | One-off plus filings | Before a provider contract |
| Aadhaar eSign provider | Per signature, possibly a deposit or minimum | Phase 3 |
| Adobe-trusted signing certificate | Yearly fee | When customers ask |
| SOC 2 or ISO 27001 audit | Large; the main enterprise cost | Only when deals need it |

| Risk | Why it matters | What to do |
| --- | --- | --- |
| Exposed credentials in the public repo | The database may already have been copied | Rotate today. If real users' data was in it, take legal advice on notification. |
| Legal claims the product cannot back | A signed contract that fails in a dispute lands on you | Reword now; build the seal and audit log next |
| Lifetime-plan liabilities | Unlimited cost, no future revenue | Close or cap the plan |
| Commoditisation | Open-source tools are free to self-host | Compete on local compliance, language and simplicity |
| Provider dependency | Aadhaar eSign, payments and email all rely on third parties | Keep each behind an interface so it can be swapped |
| Brand | The code, emails and legal text still say Signaturly; PactDoc has not been checked against existing trademarks | Run a trademark search before spending on the name |
| Payments from outside India | Card acceptance and tax handling differ by country | Use Razorpay for rupees; consider a merchant-of-record service for other currencies |
| Solo founder capacity | Security, support and sales compete for one person's time | Keep the scope to one segment until revenue arrives |

## Sources

Opened on 10 October 2026: [Docusign FY2026 Form 10-K](https://www.sec.gov/Archives/edgar/data/1261333/000126133326000021/docu-20260131.htm), [Docusign pricing guide by Automation Atlas](https://automationatlas.io/answers/docusign-pricing-explained-2026/), [Dropbox Sign pricing](https://sign.dropbox.com/info/pricing), [Zoho Sign pricing](https://www.zoho.com/sign/pricing.html), [Documenso pricing](https://documenso.com/pricing), [DocuSeal pricing](https://www.docuseal.com/pricing). Docusign's own pricing page and PandaDoc's could not be loaded. Market-size figures, Indian per-signature prices and review-site complaints come from search summaries and are unverified.
