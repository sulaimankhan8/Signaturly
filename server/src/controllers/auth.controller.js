import { asyncHandler } from "../utils/asyncHandler.js";
import { registerUser, loginUser } from "../services/auth.service.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/User.model.js";
import { env } from "../config/env.js";


export const register = asyncHandler (async (req, res) => {
    const user = await registerUser(req.body);
    res.status(201).json(new ApiResponse({ id: user._id }, "Registered"));
});

export const login = asyncHandler (async (req, res) => {
    const { user, accessToken, refreshToken } = await loginUser(req.body);
     console.log("login controller", { userId: user._id, email: user.email });
    res
    .cookie("refreshToken", refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/", 
    })
    .status(200)
    .json(
      new ApiResponse({
        accessToken,
        user: { id: user._id, email: user.email, name: user.name, role: user.role },
      })
    );
});


export const refreshAccessToken = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;

  if (!refreshToken) {
    throw new ApiError(401, "Refresh token missing");
  }

  const decoded = jwt.verify(refreshToken, env.refreshSecret);

  const user = await User.findById(decoded.id).select("+refreshToken");

  if (!user || user.refreshToken !== refreshToken) {
    throw new ApiError(401, "Refresh token mismatch");
  }

  const newAccessToken = user.generateAccessToken();

  res.status(200).json(
    new ApiResponse({
      accessToken: newAccessToken,
    })
  );
});


export const getMe = asyncHandler(async (req, res) => {
  res.status(200).json(
    new ApiResponse({
      user: req.user,
      id: req.user._id,
    })
  );
});
