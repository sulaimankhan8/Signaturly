import dotenv from "dotenv";
dotenv.config();

const toBool = (value, fallback) => {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
};

// Built from a plain object so tests can check how production settings are derived
export const buildEnv = (source) => {
  const nodeEnv = source.NODE_ENV || "development";
  const isProd = nodeEnv === "production";
  const isTest = nodeEnv === "test";

  return {
    port : source.PORT || 5000,
    mongoUri : source.MONGO_URI,
    accessSecret: source.JWT_ACCESS_SECRET,
    refreshSecret: source.JWT_REFRESH_SECRET,
    nodeEnv,
    isProd,
    isTest,
    corsOrigin: source.CORS_ORIGIN || "http://localhost:5173",
    smtpHost: source.SMTP_HOST,
    smtpPort: parseInt(source.SMTP_PORT) || 587,
    smtpUser: source.SMTP_USER,
    smtpPass: source.SMTP_PASS,
    smtpFrom: source.SMTP_FROM || "noreply@pactdoc.com",
    appName: source.APP_NAME || "PactDoc",
    appUrl: source.APP_URL || "http://localhost:5173",
    adminSecret: source.ADMIN_SECRET_KEY,
    adminJwtSecret: source.ADMIN_JWT_SECRET,
    storageProvider: source.STORAGE_PROVIDER || "local",
    uploadsDir: source.UPLOADS_DIR || "uploads",
    gcpProjectId: source.GCP_PROJECT_ID || source.GOOGLE_CLOUD_PROJECT,
    gcsBucketName: source.GCS_BUCKET_NAME || "pactdoc-documents",
    gcsSignedUrlExpires: parseInt(source.GCS_SIGNED_URL_EXPIRES) || 900,
    // Signed file links (served through /uploads) stay valid for this many seconds
    fileUrlTtlSeconds: parseInt(source.FILE_URL_TTL_SECONDS) || 3600,
    fileUrlSecret: source.FILE_URL_SECRET || source.JWT_ACCESS_SECRET,
    signingLinkTtlDays: parseInt(source.SIGNING_LINK_TTL_DAYS) || 30,
    // Billing stays off in production until the provider-driven rebuild ships
    billingEnabled: toBool(source.BILLING_ENABLED, !isProd),
    // The simulated upgrade is a development convenience and can never run in production
    devBillingSimulation: !isProd && toBool(source.DEV_BILLING_SIMULATION, true),
    stripeSecretKey: source.STRIPE_SECRET_KEY,
    stripeWebhookSecret: source.STRIPE_WEBHOOK_SECRET,
    razorpayWebhookSecret: source.RAZORPAY_WEBHOOK_SECRET,
    trustProxy: source.TRUST_PROXY !== undefined ? source.TRUST_PROXY : (isProd ? "1" : ""),
    rateLimitDisabled: toBool(source.RATE_LIMIT_DISABLED, false),
    // SMS and WhatsApp. No commercial provider is wired in yet, so production keeps this off.
    messagingEnabled: toBool(source.MESSAGING_ENABLED, !isProd),
    messagingProvider: source.MESSAGING_PROVIDER || (isTest ? "test" : "console"),
    // Key for the audit log's hash chain. Outside production it falls back to a value derived from the access secret.
    auditHmacKey: source.AUDIT_HMAC_KEY || (isProd ? undefined : `dev-audit:${source.JWT_ACCESS_SECRET || ""}`),
    // Certificate that seals completed PDFs (PKCS#12, base64). Outside production one is generated on first use.
    sealP12Base64: source.SEAL_P12_BASE64,
    sealP12Password: source.SEAL_P12_PASSWORD || "",
    // Shared secret for scheduler-triggered internal endpoints
    internalSecret: source.INTERNAL_JOB_SECRET,
    // In production schedules are triggered from outside (Cloud Scheduler); locally a timer inside the process is enough
    inProcessCron: toBool(source.IN_PROCESS_CRON, !isProd && !isTest),
  };
};

export const env = buildEnv(process.env);

const KNOWN_WEAK_VALUES = [
  "signaturly-superadmin-secret",
  "your_super_secret_jwt_access_token_key_64_characters",
  "your_super_secret_jwt_refresh_token_key_64_characters",
];

/**
 * Lists configuration problems. Missing or placeholder secrets are always a problem;
 * production adds length, separation and CORS rules.
 */
export const validateEnv = (config = env) => {
  const problems = [];
  const required = {
    MONGO_URI: config.mongoUri,
    JWT_ACCESS_SECRET: config.accessSecret,
    JWT_REFRESH_SECRET: config.refreshSecret,
    ADMIN_SECRET_KEY: config.adminSecret,
    ADMIN_JWT_SECRET: config.adminJwtSecret,
  };

  for (const [name, value] of Object.entries(required)) {
    if (!value || !String(value).trim()) {
      problems.push(`${name} is not set`);
    } else if (KNOWN_WEAK_VALUES.includes(value)) {
      problems.push(`${name} still has its placeholder value`);
    }
  }

  if (config.isProd) {
    const productionOnly = {
      AUDIT_HMAC_KEY: config.auditHmacKey,
      SEAL_P12_BASE64: config.sealP12Base64,
      INTERNAL_JOB_SECRET: config.internalSecret,
    };
    for (const [name, value] of Object.entries(productionOnly)) {
      if (!value || !String(value).trim()) problems.push(`${name} is not set`);
    }

    for (const name of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "ADMIN_SECRET_KEY", "ADMIN_JWT_SECRET"]) {
      const value = required[name];
      if (value && String(value).length < 32) {
        problems.push(`${name} must be at least 32 characters in production`);
      }
    }
    if (config.adminJwtSecret && config.adminJwtSecret === config.accessSecret) {
      problems.push("ADMIN_JWT_SECRET must differ from JWT_ACCESS_SECRET");
    }
    const origins = String(config.corsOrigin || "").split(",").map((s) => s.trim());
    if (origins.includes("*")) {
      problems.push("CORS_ORIGIN must list exact origins in production, not *");
    }
  }

  return problems;
};

// Refuses to start with missing or placeholder secrets
export const assertValidEnv = () => {
  const problems = validateEnv();
  if (problems.length > 0) {
    throw new Error(`Invalid configuration:\n - ${problems.join("\n - ")}`);
  }
};
