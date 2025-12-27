import dotenv from "dotenv";
dotenv.config();

export const env = {
    port : process.env.PORT,
    mongoUri :process.env.MONGO_URI,
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    nodeEnv: process.env.NODE_ENV,
    corsOrigin: process.env.CORS_ORIGIN,
};