import mongoose from "mongoose";
import { env } from "../config/env.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema({
    name:{
        type: String,
        required: true,
    },

    email:{
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
    },

    password:{
        type: String,
        required: true,
        select: false,
    },

    // SHA-256 of the current refresh token; the token itself is never stored
    refreshTokenHash:{
        type: String,
        select: false,
    },
    // The token replaced by the last rotation stays usable for a few seconds,
    // so two tabs refreshing at once do not sign the user out
    previousRefreshTokenHash:{
        type: String,
        select: false,
    },
    refreshRotatedAt:{
        type: Date,
        select: false,
    },

    role:{
        type: String,
        default: "user"
    },

    // Accounts created before email verification existed have no value here and are treated as verified
    emailVerified:{
        type: Boolean,
    },
    emailVerifyTokenHash:{
        type: String,
        select: false,
    },
    emailVerifyExpiresAt:{
        type: Date,
        select: false,
    },

    // Set when the account is closed; the profile is anonymised at the same moment
    deletedAt:{
        type: Date,
        default: null,
    },

    // Two-step sign-in with an authenticator app. Secrets are stored encrypted and never returned.
    twoFactor: {
        enabled: { type: Boolean, default: false },
        enabledAt: { type: Date },
        secret: { type: String, select: false },
        pendingSecret: { type: String, select: false },
        // The 30-second step of the last code used, so a code cannot be used twice
        lastStep: { type: Number, select: false },
        recoveryHashes: { type: [String], select: false, default: undefined },
    },

    // What the customer wants printed on their invoices
    billing: {
        legalName: { type: String, default: "" },
        address: { type: String, default: "" },
        gstin: { type: String, default: "" },
        stateCode: { type: String, default: "" },
    },

    termsAccepted:{
        type: Boolean,
        default: false,
    },
    termsAcceptedAt:{
        type: Date,
    },
    termsVersion:{
        type: String,
        default: "1.0.0",
    },
    termsIpAddress:{
        type: String,
    },
},{ timestamps: true   });

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});


userSchema.methods.comparePassword = function (password) {
  return bcrypt.compare(password, this.password);
};

userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    { id: this._id, role: this.role },
    env.accessSecret,
    { expiresIn: "15m" }
  );
};

userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    { id: this._id },
    env.refreshSecret,
    { expiresIn: "30d", jwtid: new mongoose.Types.ObjectId().toString() }
  );
};

export const User = mongoose.model("User", userSchema);
