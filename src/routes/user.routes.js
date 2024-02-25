import { Router } from "express";
import {
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
  // user array of objects in case of multiple files
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

router.route("/update-account-details").post(verifyJWT, updateAccoutDetails);

router
  .route("/update-avatar")
  .post(verifyJWT, upload.single("avatar"), updateAvatar);

router
  .route("/update-coverimage")
  .post(verifyJWT, upload.single("coverImage"), updateCoverImage);

export default router;
