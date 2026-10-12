import { User } from "../models/User.model.js";
import { ApiError } from "../utils/ApiError.js";
import { randomToken, sha256Hex } from "../utils/tokens.js";
import { sendEmailVerificationEmail } from "./email.service.js";
import { verifySecondStep } from "./twoFactor.service.js";

const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

export const issueEmailVerification = async (user) => {
  const token = randomToken();
  user.emailVerifyTokenHash = sha256Hex(token);
  user.emailVerifyExpiresAt = new Date(Date.now() + EMAIL_VERIFY_TTL_MS);
  await user.save({ validateBeforeSave: false });

  await sendEmailVerificationEmail({ email: user.email, name: user.name, token });
  return token;
};

export const registerUser = async ({ name, email, password }) => {
  const normalizedEmail = email?.trim().toLowerCase();

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new ApiError(400, "User already exists with this email");
  }

  const newUser = await User.create({ name, email: normalizedEmail, password, emailVerified: false });
  try {
    await issueEmailVerification(newUser);
  } catch (err) {
    // The account exists; the user can ask for the email again after signing in
    console.error("Could not send confirmation email:", err.message);
  }
  return newUser;
};

export const verifyEmailToken = async (token) => {
  const user = await User.findOne({ emailVerifyTokenHash: sha256Hex(token) }).select(
    "+emailVerifyTokenHash +emailVerifyExpiresAt"
  );

  if (!user || !user.emailVerifyExpiresAt || user.emailVerifyExpiresAt < new Date()) {
    throw new ApiError(400, "This confirmation link is invalid or has expired");
  }

  user.emailVerified = true;
  user.emailVerifyTokenHash = undefined;
  user.emailVerifyExpiresAt = undefined;
  await user.save({ validateBeforeSave: false });
  return user;
};

// Stores only a hash of the refresh token, replacing any earlier one (rotation)
export const issueSession = async (user) => {
  // Covers every way in: password, single sign-on and renewing a session
  if (user.suspendedAt) {
    throw new ApiError(403, "ACCOUNT_SUSPENDED: This account has been suspended. Write to support if you think this is a mistake.");
  }

  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        refreshTokenHash: sha256Hex(refreshToken),
        previousRefreshTokenHash: user.refreshTokenHash || null,
        refreshRotatedAt: new Date(),
      },
    }
  );
  return { accessToken, refreshToken };
};

export const revokeSessions = async (userId) => {
  await User.updateOne(
    { _id: userId },
    { $unset: { refreshTokenHash: 1, previousRefreshTokenHash: 1, refreshRotatedAt: 1 } }
  );
};

export const loginUser = async ({ email, password, code }) => {
  const normalizedEmail = email?.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail }).select("+password");

  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  const match = await user.comparePassword(password);
  if (!match) {
    throw new ApiError(401, "Invalid email or password");
  }

  // Two-step sign-in: the password alone is not enough. The reply says a code is needed
  // only after the password was right, so it tells a stranger nothing.
  if (user.twoFactor?.enabled) {
    if (!code) throw new ApiError(401, "TWO_FACTOR_CODE_NEEDED: Enter the code from your authenticator app.");
    if (!(await verifySecondStep(user._id, code))) throw new ApiError(401, "TWO_FACTOR_CODE_WRONG: That code is not right.");
  }

  const { accessToken, refreshToken } = await issueSession(user);
  return { user, accessToken, refreshToken };
};
