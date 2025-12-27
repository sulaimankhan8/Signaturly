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
    },

    password:{
        type: String,
        required: true,
        select: false,
    },

    refreshToken:{
        type: String,
        select: false,
    },

    role:{
        type: String,
        default: "user"
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
    { expiresIn: "30d" }
  );
};

export const User = mongoose.model("User", userSchema); 