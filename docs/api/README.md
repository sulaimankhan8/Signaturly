# PactDoc API

Send documents for signature from your own software and be told when they are signed.

The full list of requests and answers is in [openapi.yaml](openapi.yaml). This page covers what
that file cannot: how to start, how test mode behaves, how to check a webhook, and how to show a
signing page inside your own website.

> Status: version 1 of the API passes its automated tests but has not yet been used by a
> customer, and the examples on this page are not run automatically. Treat it as a preview until
> this note is removed.

## Start

1. In the app, open **Developer settings** and create a **test key**. The key is shown once.
2. Call the API with the key in the `Authorization` header:

```bash
curl https://api.pactdoc.com/api/v1/me \
  -H "Authorization: Bearer pd_test_..."
```

The address above is a placeholder: use the address of your own PactDoc API.

Every answer is JSON of the form `{ "data": ... }`. Lists add `hasMore` and `nextCursor`; pass
`nextCursor` back as `cursor` to get the next page. An error has an HTTP status that says what
went wrong and a `message` in plain words.

| Status | Meaning |
| --- | --- |
| 400 | Something in the request is wrong; the message says what |
| 401 | The key is missing, mistyped or revoked |
| 403 | The key lacks the scope, the plan does not include the API, or the workspace is read-only |
| 404 | No such document, or it belongs to the other mode (live or test) |
| 409 | The document is not in a state that allows this, for example already sent |
| 429 | Too many requests for this key in the last minute; see `Retry-After` |

## Keys, scopes and limits

A key belongs to one workspace and works on that workspace's documents. It carries only the
scopes it was created with:

| Scope | Allows |
| --- | --- |
| `documents:read` | List and read documents, get download links |
| `documents:write` | Upload, send, void, remind, create embedded signing sessions |
| `templates:read` | List the workspace's saved templates |
| `webhooks:manage` | Create, list and delete webhooks, read and replay deliveries |

Each key may make 120 requests a minute. The headers `X-RateLimit-Limit` and
`X-RateLimit-Remaining` say where you stand.

Keep keys on your server. Never put one in a web page or a mobile app.

## Test mode

A key that starts `pd_test_` is a test key. With it:

- every document is watermarked **TEST DOCUMENT - NOT VALID** on every page;
- nothing is counted against your plan;
- **nobody is emailed or messaged.** Each recipient in the answer carries a `signingUrl` you can
  open yourself to try the signing page;
- test documents and live documents never see each other: a live key gets 404 for a test
  document, and the reverse.

Webhooks fire for test documents too. The payload says `"test": true`.

## Send a document

```bash
# 1. Upload the PDF
curl https://api.pactdoc.com/api/v1/documents \
  -H "Authorization: Bearer pd_test_..." \
  -F "file=@agreement.pdf"

# 2. Send it. Field positions are fractions of the page: 0 is the left or top edge, 1 the right or bottom.
curl https://api.pactdoc.com/api/v1/documents/DOCUMENT_ID/send \
  -H "Authorization: Bearer pd_test_..." \
  -H "Content-Type: application/json" \
  -d '{
    "recipients": [{ "name": "Asha Rao", "email": "asha@example.com" }],
    "fields": [{ "type": "signature", "page": 1, "xPercent": 0.6, "yPercent": 0.85,
                 "widthPercent": 0.25, "heightPercent": 0.05, "recipientEmail": "asha@example.com" }],
    "message": "Please sign by Friday."
  }'
```

A document can be sent once. To change who signs it, void it and upload it again.

To send from a template saved in the app, post the signers for each of its roles to
`/v1/templates/TEMPLATE_ID/documents`.

## Webhooks

Create a webhook in Developer settings or with `POST /v1/webhooks`. The address must use https
and be reachable from the internet. The answer contains a signing secret (`whsec_...`), shown
once.

Events: `envelope.sent`, `recipient.viewed`, `recipient.signed`, `envelope.completed`,
`envelope.declined`, `envelope.voided`.

Each delivery is a POST with this body:

```json
{
  "id": "5d1c...",
  "type": "envelope.completed",
  "created": 1791700000,
  "data": { "document": { "id": "...", "title": "agreement.pdf", "status": "signed", "test": false } }
}
```

### Check that it came from PactDoc

Every delivery carries `X-PactDoc-Signature: t=<unix time>,v1=<hex>`. `v1` is the HMAC-SHA256,
keyed with your signing secret, of the text `<t>.<raw request body>`. Compute it over the body
exactly as received, before parsing it, and compare in constant time. Refuse a delivery whose
`t` is more than five minutes old.

```js
import crypto from "crypto";

export function isFromPactDoc(rawBody, header, secret) {
  const parts = Object.fromEntries(header.split(",").map((part) => part.split("=")));
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${parts.t}.${rawBody}`).digest("hex");
  const given = Buffer.from(parts.v1 || "", "hex");
  return given.length === 32 && crypto.timingSafeEqual(given, Buffer.from(expected, "hex"));
}
```

### Delivery and retries

Answer with any 2xx status within 10 seconds. Anything else counts as a failure and is retried
up to five times with longer waits between. Redirects are not followed.

The same event can arrive more than once. Use `id` to recognise a repeat: it is the same on
every attempt and on a replay. Deliveries of the last 30 days are listed in Developer settings,
where any of them can be sent again.

## Embedded signing

To show a signing page inside your own website:

1. In the app, open the team's **Rules** and add your website's origin (for example
   `https://app.example.com`) to the sites allowed to embed signing.
2. When your signer is on your page, ask for a session:

```bash
curl https://api.pactdoc.com/api/v1/documents/DOCUMENT_ID/recipients/RECIPIENT_ID/embed \
  -H "Authorization: Bearer pd_live_..." \
  -H "Content-Type: application/json" \
  -d '{ "origin": "https://app.example.com" }'
```

3. Load the `url` from the answer in an `<iframe>` within 15 minutes.

What to know:

- A signing page refuses to appear inside any site without a valid session for that site.
- You are responsible for knowing that the person in front of your page is the signer. The
  document's signing record says the page was presented by your website. If you need the signer
  to prove who they are to PactDoc as well, send the recipient with `"authType": "otp"`.
- Aadhaar eSign sends the signer to the provider's own page, which will not open inside a frame.
  Do not embed documents that use it.

## Not available through the API yet

Guided templates from the catalogue, contact lists and bulk send, idempotency keys, and Aadhaar
eSign.
