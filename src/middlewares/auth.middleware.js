import { User } from "../models/user.model.js";
import ErrorApi from "../utils/ErrorApi.js";
import asyncHandler from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";

export const verifyJWT = asyncHandler(async (req, _, next) => {
  try {
    // Accessing access Token
    const token =
      req.cookies?.accessToken || req.header.authorization.split(" ")[1];

    // No Token
    if (!token) {
      throw new ErrorApi(401, "Unauthorized request");
    }

    // Verify access Token
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    // Get user from db using decodedToken
    const user = await User.findById(decodedToken?._id).select(
      "-password -refreshToken"
    );

    // user not present
    if (!user) {
      throw new ErrorApi(402, "Invalid Access Token");
    }

    // Adding user to request To access user through req.user while logging out
    req.user = user;
    next();
  } catch (error) {
    throw new ErrorApi(405, "Invalid Token");
  }
});
