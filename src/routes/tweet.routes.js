import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  createTweet,
  deleteTweet,
  getUserTweets,
  updateTweet,
} from "../controllers/tweet.controller.js";

const router = Router();

router.use(verifyJWT);

router.route("/createTweet").post(createTweet);
router.route("/userTweets").get(getUserTweets);
router.route("/updateTweet/:tweet_id").patch(updateTweet);
router.route("/deleteTweet/:tweet_id").delete(deleteTweet);

export default router;
