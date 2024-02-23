import asyncHandler from "../utils/asyncHandler.js";
import ErrorApi from "../utils/ErrorApi.js";
import ResponseApi from "../utils/ResponseApi.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

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
  if (!username || !email) {
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

  // Generate access token and refresh token
  const accessToken = await user.generateAccessToken();
  const refreshToken = await user.generateRefreshToken();

  // Update refresh token of user in db
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  // Refetch user as loggedIn user since refresh token is updated in db
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // Set cookie options
  // using cookie parser
  // secure: true ==> cookies can only be altered on server side
  const options = {
    httpOnly: true,
    secure: true,
  };

  // Return response while setting cookies
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(new ResponseApi(200, "user loggedIn successfully", loggedInUser));
});

export const logoutUser = asyncHandler(async (req, res) => {
  // Delete refresh token from db
  await User.findByIdAndUpdate(req.user._id, {
    refreshToken: "",
  });

  const options = {
    httpOnly: true,
    secure: true,
  };

  // Clearing cookies from user
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ResponseApi(200, "User logged out successfully", {}));
});
