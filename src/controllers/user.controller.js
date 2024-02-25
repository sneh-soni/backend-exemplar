import asyncHandler from "../utils/asyncHandler.js";
import ErrorApi from "../utils/ErrorApi.js";
import ResponseApi from "../utils/ResponseApi.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";

// Set cookie options (using cookie parser, we can access user's cookies)
// {secure: true} ==> cookies can only be altered on server side
const options = {
  httpOnly: true,
  secure: true,
};

const generateAccessAndRefreshToken = async (user_id) => {
  // Get user from db using id
  const user = await User.findById(user_id);

  // user not present
  if (!user) {
    throw new ErrorApi(404, "Invalid User");
  }

  // Generate access token and refresh token
  const accessToken = await user.generateAccessToken();
  const refreshToken = await user.generateRefreshToken();

  // Update refresh token of user in db
  user.refreshToken = refreshToken;

  // Saves user without validating any feild
  await user.save({ validateBeforeSave: false });

  // Refetch user as newUser since refresh token is updated in db
  const newUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  return { accessToken, refreshToken, newUser };
};

export const registerUser = asyncHandler(async (req, res) => {
  // Get data from request
  const { username, fullname, email, password } = req.body;

  /*
  console.log("Request.body: ", req.body);

  Request.body:  [Object: null prototype] {
  email: 'email@gmail.com',
  password: 'password',
  username: 'sneh',
  fullname: 'sneh soni'
  }
  */

  // Check if all fields are filled
  if (
    [username, fullname, email, password].some((field) => {
      return field?.trim() === "";
    })
  ) {
    throw new ErrorApi(400, "All fields are mandatory");
  }

  // Search if User already exists with same username || email
  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  // If user already exists
  if (existedUser) {
    throw new ErrorApi(402, "Username or email already exists");
  }

  /*
  console.log("Request.files: ", req.files);

  Request.files:  [Object: null prototype] {
  avatar: [
    {
      fieldname: 'avatar',
      originalname: 'me.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      destination: './public',
      filename: 'me.jpg',
      path: 'public\\me.jpg',
      size: 55511
    }
  ],
  coverImage: [
    {
      fieldname: 'coverImage',
      originalname: '1.png',
      encoding: '7bit',
      mimetype: 'image/png',
      destination: './public',
      filename: '1.png',
      path: 'public\\1.png',
      size: 799828
    }
  ]
}
  */

  // multer gives access to req.files
  // Each is an array of object
  const avatarLocalPath = req.files?.avatar[0]?.path;

  // Since coverImage is not required it is not checked furthur, so we have to checkit here
  let coverImageLocalPath = "";
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0]?.path;
  }

  // Check avatarLocalPath
  if (!avatarLocalPath) {
    throw new ErrorApi(400, "Avatar is required");
  }

  // Upload both to cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  // If avatar not uploaded to cloudinary
  if (!avatar) {
    throw new ErrorApi(400, "Avatar is required");
  }

  // Create a user
  const user = await User.create({
    username: username.toLowerCase(),
    fullname: fullname,
    email: email,
    avatar: avatar.secure_url,
    coverImage: coverImage?.secure_url || "",
    password: password,
  });

  // Remove sensitive(password) / not required while registering(refresh token)
  // feilds from created user to create a response to send
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // Last check if user is successfully registered
  if (!createdUser) {
    throw new ErrorApi(500, "something went wrong while registering the user");
  }

  // return response
  return res
    .status(202)
    .json(new ResponseApi(202, "user registered successfully", createdUser));
});

export const loginUser = asyncHandler(async (req, res) => {
  // Get data from request
  const { username, email, password } = req.body;

  // check if data must have username || email
  if (!username && !email) {
    throw new ErrorApi(400, "Username or email is required");
  }

  // Find user with username || email
  const user = await User.findOne({
    $or: [{ username: username.toLowerCase() }, { email }],
  });

  // User does not exist
  if (!user) {
    throw new ErrorApi(404, "Username or email does not exist");
  }

  /*
    All the methods created in user model are part of "user" now
    since we created them in model so we can directly use 
    those methods (without importing) on "user.method" and not on "User.method", 
    "User" is reference to database.
  */
  // Password check of user
  const isPassValid = await user.isPasswordCorrect(password);

  // Invalid password
  if (!isPassValid) {
    throw new ErrorApi(402, "Password is incorrect");
  }

  // Get access and refresh token from generateAccessAndRefreshToken
  const { accessToken, refreshToken, newUser } =
    await generateAccessAndRefreshToken(user._id);

  // Return response while setting user's cookies
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ResponseApi(200, "user loggedIn successfully", {
        loggedInUser: newUser,
        accessToken,
        refreshToken,
      })
    );
});

export const logoutUser = asyncHandler(async (req, res) => {
  // Delete refresh token from db
  await User.findByIdAndUpdate(req.user._id, {
    refreshToken: "",
  });

  // Clearing cookies from user
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ResponseApi(200, "User logged out successfully", {}));
});

export const refreshAccessToken = asyncHandler(async (req, res) => {
  // Get user's refresh token
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  // user don't have one
  if (!incomingRefreshToken) {
    throw new ErrorApi(406, "Unauthorized Refresh Token");
  }

  // Decode token
  const decodedToken = await jwt.verify(
    incomingRefreshToken,
    process.env.REFRESH_TOKEN_SECRET
  );

  // Get user from _id we got from decodedToken (defined in user.model.js)
  const user = await User.findById(decodedToken?._id);

  // user not present
  if (!user) {
    throw new ErrorApi(401, "Invalid User with refresh token");
  }

  // Incoming refreshToken doen not match with user's db's refreshToken
  if (user?.refreshToken !== incomingRefreshToken) {
    throw new ErrorApi(408, "Wrong or invalid refresh token");
  }

  // Generate new access and refresh tokens
  const { accessToken, refreshToken, newUser } =
    await generateAccessAndRefreshToken(user._id);

  //return response while setting user's cookies
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ResponseApi(202, "Access Token Refreshed Successfully", {
        refreshedUser: newUser,
        newRefreshToken: refreshToken,
        accessToken,
      })
    );
});

export const updatePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);

  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ErrorApi(404, "Wrong password entered");
  }

  user.password = newPassword;

  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ResponseApi(200, "Password changed successfylly"));
});

export const updateAccoutDetails = asyncHandler(async (req, res) => {
  const { username, fullname } = req.body;

  if (!username || !fullname) {
    throw new ErrorApi(404, "Invalid username or fullname");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        username: username,
        fullname: fullname,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ResponseApi(200, "Details updated successfully", user));
});

export const updateAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new ErrorApi(404, "Invalid Avatar Image");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        avatar: avatar.secure_url,
      },
    },
    { new: true }
  );

  return res
    .status(200)
    .json(new ResponseApi(200, "User avatar updated successfully", user));
});

export const updateCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) {
    throw new ErrorApi(404, "Invalid Cover Image");
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        coverImage: coverImage.secure_url,
      },
    },
    { new: true }
  );

  return res
    .status(200)
    .json(new ResponseApi(200, "User CoverImage updated successfully", user));
});
