import { User } from "../models/User.model.js";
import { ApiError } from "../utils/ApiError.js";

export const registerUser = async ({ name, email, password }) => {
  console.log("🔵 [registerUser] Attempting to register user with email:", email);

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(400, "User already exists with this email");
  }

  const newUser = await User.create({ name, email, password });
  return newUser;
};

export const loginUser = async ({ email, password }) => {
  console.log("🔵 [loginUser] Attempting to log in user with email:", email);
  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  const match = await user.comparePassword(password);
  if (!match) {
    throw new ApiError(401, "Invalid email or password");
  }

  const at = user.generateAccessToken();
  const rt = user.generateRefreshToken();

  user.refreshToken = rt;
  await user.save({ validateBeforeSave: false });

  return { user, accessToken: at, refreshToken: rt };
};