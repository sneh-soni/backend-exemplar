import {
  getSubscribedChannels,
  getUserChannelSubscribers,
  toggleSubscription,
} from "../controllers/subscription.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { Router } from "express";

const router = Router();

router
  .route("/toggleSubscription/:channel_id")
  .post(verifyJWT, toggleSubscription);

router
  .route("/getUserChannelSubscribers/:user_id")
  .get(getUserChannelSubscribers);

router
  .route("/getSubscribedChannels/:user_id")
  .get(verifyJWT, getSubscribedChannels);

export default router;
