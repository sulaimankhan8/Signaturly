# 0003: E-stamping is not built yet

Date: 11 October 2026
Status: decided by the development team; needs the owner's confirmation
Plan task: P6-08

## The question

Many documents PactDoc is used for attract stamp duty: rent and licence agreements, loan
agreements, guarantees, some affidavits and undertakings. Customers will ask whether PactDoc
can pay the duty and attach the e-stamp certificate for them. Should we build that now?

## Decision

No. PactDoc does not buy, attach or check stamp duty in this release. Instead:

1. Every template that commonly attracts duty says so before the sender fills it in, in the
   signature hint and the state notes, and says that signing does not pay it.
2. A sender who has bought an e-stamp certificate themselves can upload it as the first page
   of their own PDF. Nothing in PactDoc prevents that, and nothing in PactDoc vouches for it.
3. We look at this again once Aadhaar eSign is live with a licensed provider.

## Why

- **It is a different service in every state.** Duty rates, which documents are covered, who
  may sell e-stamps and how a certificate is issued differ by state. There is no single
  interface to build against; an integration means a licensed intermediary and a commercial
  agreement, the same as Aadhaar eSign.
- **A wrong answer costs the customer.** An under-stamped document can be refused as evidence
  until duty and a penalty are paid. Calculating duty ourselves would mean giving advice we are
  not placed to give. No lawyer has yet reviewed even the wording of the templates.
- **The order matters.** The providers that sell e-stamping through an interface are largely
  the ones that sell Aadhaar eSign. Choosing the eSign provider first (task P6-01, the owner's)
  decides who we would buy stamping from, and on what terms.
- **Money handling.** Duty is paid to the state through the intermediary. Collecting it means
  holding customers' money for a third party, with its own accounting and refund rules. The
  wallet built in phase 4 could carry it, but an accountant should say how before it does.

## What would change this

- A provider chosen under P6-01 that offers e-stamping for the first target states
  (Maharashtra, Karnataka, Delhi) at a price customers would pay.
- A lawyer's written view on what PactDoc may say about duty on each template.
- An accountant's view on collecting duty through the wallet.

## What it would take

A provider interface like the one for Aadhaar eSign (`server/src/services/esign/`): ask for a
certificate for a state, a document type and a value; charge the wallet; receive the
certificate; place it as the first page before anyone signs; refund on failure. The first page
must be in the file before the first signature, so stamping would be a step between "fill in"
and "send".
