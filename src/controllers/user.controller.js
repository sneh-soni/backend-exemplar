import asyncHandler from "../utils/asyncHandler.js";
import ErrorApi from "../utils/ErrorApi.js";
import ResponseApi from "../utils/ResponseApi.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

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
  // Get { oldPassword, newPassword } from request
  const { oldPassword, newPassword } = req.body;

  // find user using req.user?._id
  const user = await User.findById(req.user?._id);

  // check if password is correct ==> defined in user model
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  // if password is not correct
  if (!isPasswordCorrect) {
    throw new ErrorApi(404, "Wrong password entered");
  }

  // set new password to user
  user.password = newPassword;

  // Save user
  await user.save({ validateBeforeSave: false });

  // return response
  return res
    .status(200)
    .json(new ResponseApi(200, "Password changed successfylly"));
});

export const updateAccoutDetails = asyncHandler(async (req, res) => {
  // Get { username, fullname } from request
  const { username, fullname } = req.body;

  // check if username or fullname is empty
  if (!username || !fullname) {
    throw new ErrorApi(404, "Invalid username or fullname");
  }

  // find user and update directly using $set
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        username: username,
        fullname: fullname,
      },
    },
    { new: true } // throws updated user in respose
  ).select("-password"); // remove password from user to show in response

  // return response
  return res
    .status(200)
    .json(new ResponseApi(200, "Details updated successfully", user));
});

export const updateAvatar = asyncHandler(async (req, res) => {
  // Get avatarLocalPath from req.file by multer
  const avatarLocalPath = req.file?.path;

  // avatarLocalPath not present
  if (!avatarLocalPath) {
    throw new ErrorApi(404, "Invalid Avatar Image");
  }

  // Upload to cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);

  // update user in db
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        avatar: avatar.secure_url,
      },
    },
    { new: true }
  );

  // return response
  return res
    .status(200)
    .json(new ResponseApi(200, "User avatar updated successfully", user));
});

export const updateCoverImage = asyncHandler(async (req, res) => {
  // Get coverImageLocalPath from req.file by multer
  const coverImageLocalPath = req.file?.path;

  // coverImageLocalPath not present
  if (!coverImageLocalPath) {
    throw new ErrorApi(404, "Invalid Cover Image");
  }

  // Upload to cloudinary
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  // update user in db
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        coverImage: coverImage.secure_url,
      },
    },
    { new: true }
  );

  // return response
  return res
    .status(200)
    .json(new ResponseApi(200, "User CoverImage updated successfully", user));
});

//TODO: make a function to delete older avatar and coverImage from cloudinary

export const getUserChannel = asyncHandler(async (req, res) => {
  // Get username form req
  // const { username } = req.query; ==> Query input
  const { username } = req.params;

  // empty username
  if (!username?.trim()) {
    throw new ErrorApi(400, "Username is required");
  }

  // Get channel // using aggregation on user
  const channel = await User.aggregate([
    // array of objects ==> each object is a pipeline
    // output of previous pipeline is input to next pipeline
    {
      // match user with username came in req ==> single user here
      // can also use await User.find({username}) to get user
      $match: {
        username: username,
      },
    },
    {
      // aggregates "subscribers" array to user
      // for all localField: "_id" (in user) ===  foreignField: "channel" (in subscription),
      // select fields where, (user._id === subscription.channel)
      // to count subscribers of userChannel
      $lookup: {
        from: "subscription",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      // aggregates "subscribedTo" array to user
      // for all localField: "_id" (in user) ===  foreignField: "subscriber" (in subscription),
      // select fields where, (user._id === subscription.subscriber)
      // to count channels to whom userChannel is subscribed To
      $lookup: {
        from: "subscription",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      // addFields to user
      $addFields: {
        subscribers: {
          // counting size of "subscribers" field, therefore used $
          $size: "$subscribers",
        },
        subscribedTo: {
          // counting size of "subscribedTo" field
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            // true if any of subscribers field.subscriber === req.user?._id
            then: true,
            else: false,
          },
        },
      },
    },
    {
      // things to put in final user response
      $project: {
        username: 1,
        fullname: 1,
        avatar: 1,
        coverImage: 1,
        subscribers: 1,
        subscribedTo: 1,
        isSubscribed: 1,
      },
    },
  ]);

  // User channel not found
  if (!channel?.length) {
    throw new ErrorApi(404, "User not found");
  }

  // return response (channel ==> array of objects (here we've only one object in it))
  return res
    .status(200)
    .json(
      new ResponseApi(200, "User channel fetched successfullt", channel[0])
    );
});

export const getUserWatchHistory = asyncHandler(async (req, res) => {
  // Get user with watchHistory using aggregation
  const user = await User.aggregate([
    {
      // match user with id
      // _id is string but _id in monogodb is ObjectId('string _id here')
      // mongoose converts ObjectId to string and vice versa behind the scenes
      // therefore to match _id(string) in db
      // we need to convert req.user?._id to ObjectId first using mongoose
      $match: {
        _id: new mongoose.Types.ObjectId(req.user?._id),
      },
    },
    {
      // we are in user
      // aggregate watcHistory from videos
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        // since videos have owner field of type User
        // therefore to aggregate/populate owner we applied sub pipeline again
        // from videos to users
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  // use $project since user is very large
                  // and we don't want all info in owner
                  $project: {
                    username: 1,
                    fullname: 1,
                    avatar: 1,
                    coverImage: 1,
                  },
                },
              ],
            },
          },
          {
            // Add owner[0] in user for simplicity in frontend
            $addFields: {
              owner: {
                $first: "$owner", // since owner is a field now, therefore $
              },
            },
          },
        ],
      },
    },
  ]);

  // return response
  return res.status(200).json(
    new ResponseApi(
      200,
      "User watch history fetched successfully",
      user[0].watchHistory // since returns array
    )
  );
});
