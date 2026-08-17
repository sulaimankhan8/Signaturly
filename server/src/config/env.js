import dotenv from "dotenv";
dotenv.config();

export const env = {
    port : process.env.PORT || 5000,
    mongoUri : process.env.MONGO_URI,
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    nodeEnv: process.env.NODE_ENV || "development",
    corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
    smtpHost: process.env.SMTP_HOST,
    smtpPort: parseInt(process.env.SMTP_PORT) || 587,
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    smtpFrom: process.env.SMTP_FROM || "noreply@signaturly.com",
    appName: process.env.APP_NAME || "Signaturly Pro",
    appUrl: process.env.APP_URL || "http://localhost:5173",
};