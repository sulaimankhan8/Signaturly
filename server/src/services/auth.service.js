import { User } from "../models/User.model.js";
import { ApiError } from "../utils/ApiError.js";

export const registerUser = async ({ name, email, password }) => {
  console.log("🔵 [registerUser] Attempting to register user with email:", email);
  console.log("🔵 [registerUser] Received name:", name);
  // WARNING: Never log passwords in production!
  console.log("🔵 [registerUser] Received password:", password);

  console.log("🔵 [registerUser] Checking if user already exists in the database...");
  const existingUser = await User.findOne({ email });
  console.log("🔵 [registerUser] Database query result for existing user:", existingUser);

  if (existingUser) {
    console.log("🔴 [registerUser] User already exists. Throwing an error.");
    throw new ApiError(400, "user already vibing");
  }

  console.log("🟢 [registerUser] User does not exist. Proceeding to create new user.");
  const newUser = await User.create({ name, email, password });
  console.log("✅ [registerUser] Successfully created new user:", newUser);

  return newUser;
};

export const loginUser = async ({ email, password }) => {
  console.log("🔵 [loginUser] Attempting to log in user with email:", email);
  // WARNING: Never log passwords in production!
  console.log("🔵 [loginUser] Received password for comparison.");

  console.log("🔵 [loginUser] Fetching user from database, including password field...");
  const user = await User.findOne({ email }).select("+password");
  console.log("🔵 [loginUser] Database query result for user:", user);

  if (!user) {
    console.log("🔴 [loginUser] No user found with that email. Throwing authentication error.");
    throw new ApiError(401, "invalid email or password");
  }

  console.log("🔵 [loginUser] User found. Comparing provided password with stored hash...");
  const match = await user.comparePassword(password);
  console.log("🔵 [loginUser] Password comparison result (match = true/false):", match);

  if (!match) {
    console.log("🔴 [loginUser] Passwords do not match. Throwing authentication error.");
    throw new ApiError(401, "invalid email or password");
  }

  console.log("🟢 [loginUser] Passwords match. Generating tokens...");
  const at = user.generateAccessToken();
  const rt = user.generateRefreshToken();
  

  
  user.refreshToken = rt;
  await user.save({ validateBeforeSave: false });
  console.log("✅ [loginUser] User object with refresh token saved successfully.");

  const returnObject = { user, accessToken: at, refreshToken: rt };
  console.log("✅ [loginUser] Login successful. Returning user and tokens:", returnObject);

  return returnObject;
};