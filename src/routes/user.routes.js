import { Router } from "express";
import {
  getUserChannel,
  getUserWatchHistory,
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
  updateAccoutDetails,
  updateAvatar,
  updateCoverImage,
  updatePassword,
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/register").post(
  // use array of objects in case of multiple files
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
    {
      name: "coverImage",
    },
  ]),
  registerUser
);

router.route("/login").post(loginUser);

router.route("/logout").post(verifyJWT, logoutUser);

router.route("/refresh-token").post(refreshAccessToken);

router.route("/update-password").post(verifyJWT, updatePassword);

router.route("/update-account-details").patch(verifyJWT, updateAccoutDetails);

router
  .route("/update-avatar")
  .patch(verifyJWT, upload.single("avatar"), updateAvatar);

router
  .route("/update-coverimage")
  .patch(verifyJWT, upload.single("coverImage"), updateCoverImage);

// router.route("/getUserChannel").get(getUserChannel); ==> Query route
router.route("/getUserChannel/:username").get(getUserChannel); // Params route

router.route("/watchHistory").get(verifyJWT, getUserWatchHistory);

export default router;
