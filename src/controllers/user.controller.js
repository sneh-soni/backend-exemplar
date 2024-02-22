import asyncHandler from "../utils/asyncHandler.js";
import ErrorApi from "../utils/ErrorApi.js";
import ResponseApi from "../utils/ResponseApi.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

export const registerUser = asyncHandler(async (req, res) => {
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

  if (
    [username, fullname, email, password].some((field) => {
      return field?.trim() === "";
    })
  ) {
    throw new ErrorApi(400, "All fields are mandatory");
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });
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

  const avatarLocalPath = req.files?.avatar[0]?.path;
  let coverImageLocalPath = "";
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0]?.path;
  }

  if (!avatarLocalPath) {
    throw new ErrorApi(400, "Avatar is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ErrorApi(400, "Avatar is required");
  }

  const user = await User.create({
    username: username.toLowerCase(),
    fullname: fullname,
    email: email,
    avatar: avatar.secure_url,
    coverImage: coverImage?.secure_url || "",
    password: password,
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ErrorApi(500, "something went wrong while registering the user");
  }

  return res
    .status(202)
    .json(new ResponseApi(202, "user registered successfully", createdUser));
});
