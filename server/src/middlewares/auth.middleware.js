import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/User.model.js";
import { env } from "../config/env.js";

export const protect = async (req, res, next) => {
  // Tokens are accepted in the Authorization header only, never in a URL
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

  if (!token) {
    throw new ApiError(401, "Not authorized, token missing");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, env.accessSecret);
  } catch (err) {
    throw new ApiError(401, "Not authorized, token invalid");
  }

  const user = await User.findById(decoded.id);
  if (!user || user.deletedAt) {
    throw new ApiError(401, "User not found");
  }

  req.user = {
    _id: user._id.toString(),
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    name: user.name,
    termsAccepted: user.termsAccepted || false,
    emailVerified: user.emailVerified !== false,
  };

  next();
};

// Sending documents to other people requires a confirmed email address
export const requireVerifiedEmail = (req, res, next) => {
  if (req.user?.emailVerified === false) {
    throw new ApiError(403, "EMAIL_NOT_VERIFIED: Please confirm your email address before sending documents.");
  }
  next();
};
