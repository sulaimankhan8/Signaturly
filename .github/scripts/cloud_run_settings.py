"""Writes the settings the API is deployed with.

Run by .github/workflows/deploy-backend.yml. It reads the repository's variables from the
environment and produces two things for `gcloud run deploy`:

  * a YAML file of plain settings, for --env-vars-file. A file is used, and not a list on the
    command line, because values such as "PactDoc <noreply@pactdoc.com>" contain characters
    that a command-line list would split on.
  * the list of secrets to mount from Secret Manager, for --set-secrets, printed on stdout.

A setting that must be there stops the deploy when it is missing. A setting that is optional is
passed only when the repository has a value for it, so the server's own default applies otherwise.

    python cloud_run_settings.py <path of the YAML file to write>
"""

import json
import os
import re
import sys

# Fixed for every deploy
FIXED = {
    "NODE_ENV": "production",
    "STORAGE_PROVIDER": "gcs",
    "GCS_SIGNED_URL_EXPIRES": "900",
}

# The deploy stops if the repository has no value for one of these
REQUIRED = ["GCP_PROJECT_ID", "GCS_BUCKET_NAME", "SMTP_HOST", "SMTP_PORT", "SMTP_FROM", "CORS_ORIGIN", "APP_URL"]

# Passed only when set. What each does is in PENDING_TASKS_AND_PRODUCTION_ROADMAP.md, section 7.
OPTIONAL = [
    "API_URL",
    "BILLING_ENABLED",
    "RAZORPAY_KEY_ID",
    "SELLER_LEGAL_NAME",
    "SELLER_ADDRESS",
    "SELLER_GSTIN",
    "SELLER_STATE_CODE",
    "USAGE_CHARGING_ENABLED",
    "MESSAGING_ENABLED",
    "MESSAGING_PROVIDER",
    "TEMPLATES_ALLOW_UNREVIEWED",
    "SIGNING_LINK_TTL_DAYS",
    "FILE_URL_TTL_SECONDS",
    "TRUST_PROXY",
]

# Always mounted. The server refuses to start in production without most of them.
REQUIRED_SECRETS = [
    "MONGO_URI",
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
    "ADMIN_SECRET_KEY",
    "ADMIN_JWT_SECRET",
    "AUDIT_HMAC_KEY",
    "SEAL_P12_BASE64",
    "SEAL_P12_PASSWORD",
    "INTERNAL_JOB_SECRET",
    "SMTP_USER",
    "SMTP_PASS",
]

# Mounted only when named in the repository variable OPTIONAL_SECRETS (comma-separated), because
# a deploy fails if it asks for a secret that does not exist yet.
ALLOWED_OPTIONAL_SECRETS = [
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_WEBHOOK_SECRET",
    "DATA_ENCRYPTION_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "FILE_URL_SECRET",
]


def build(environ):
    """Returns (settings, secret names, problems)."""
    problems = []
    settings = dict(FIXED)

    for name in REQUIRED:
        value = (environ.get(name) or "").strip()
        if not value:
            problems.append(f"The repository variable {name} is not set")
        settings[name] = value

    for name in OPTIONAL:
        value = (environ.get(name) or "").strip()
        if value:
            settings[name] = value

    secrets = list(REQUIRED_SECRETS)
    for name in re.split(r"[,\s]+", environ.get("OPTIONAL_SECRETS") or ""):
        if not name:
            continue
        if name not in ALLOWED_OPTIONAL_SECRETS:
            problems.append(f"OPTIONAL_SECRETS names {name}, which is not one of: {', '.join(ALLOWED_OPTIONAL_SECRETS)}")
        elif name not in secrets:
            secrets.append(name)

    # Settings that only work together
    if settings.get("RAZORPAY_KEY_ID") and "RAZORPAY_KEY_SECRET" not in secrets:
        problems.append("RAZORPAY_KEY_ID is set, so OPTIONAL_SECRETS must name RAZORPAY_KEY_SECRET")
    if settings.get("RAZORPAY_KEY_ID") and "RAZORPAY_WEBHOOK_SECRET" not in secrets:
        problems.append("RAZORPAY_KEY_ID is set, so OPTIONAL_SECRETS must name RAZORPAY_WEBHOOK_SECRET: without it a paid order is never granted")

    return settings, secrets, problems


def to_yaml(settings):
    # A JSON string is a valid YAML string, and quoting every value keeps "true" and "900" as text
    return "".join(f"{name}: {json.dumps(value)}\n" for name, value in sorted(settings.items()))


def main(argv, environ):
    if len(argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2

    settings, secrets, problems = build(environ)
    if problems:
        for problem in problems:
            print(f"::error::{problem}", file=sys.stderr)
        return 1

    with open(argv[1], "w", encoding="utf-8") as handle:
        handle.write(to_yaml(settings))

    print(",".join(f"{name}={name}:latest" for name in secrets))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv, os.environ))
