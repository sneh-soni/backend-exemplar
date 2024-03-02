import mongoose from "mongoose";
import { subscription } from "../models/subscription.model.js";
import ErrorApi from "../utils/ErrorApi.js";
import ResponseApi from "../utils/ResponseApi.js";
import asyncHandler from "../utils/asyncHandler.js";

const toggleSubscription = asyncHandler(async (req, res) => {
  const { channel_id } = req.params;
  const channelObjectId = new mongoose.Types.ObjectId(channel_id);

  if (channelObjectId.equals(req.user._id)) {
    throw new ErrorApi(400, "user cannot subscribe to his/her own channel");
  }

  const existingUser = await subscription.findOne({
    $and: [{ subscriber: req.user._id }, { channel: channel_id }],
  });

  if (!existingUser) {
    await subscription.create({
      subscriber: req.user._id,
      channel: channel_id,
    });
  } else {
    await subscription.findByIdAndDelete(existingUser._id);
  }

  return res
    .status(200)
    .json(new ResponseApi(200, "Subscription Updated Successfully"));
});

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { user_id } = req.params;

  const subscribers = await subscription.aggregate([
    {
      $match: {
        channel: new mongoose.Types.ObjectId(user_id),
      },
    },
    {
      $project: {
        channel: 1,
        subscriber: 1,
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "subscriber",
        foreignField: "_id",
        as: "subscriber",
        pipeline: [
          {
            $project: {
              username: 1,
              email: 1,
              fullname: 1,
              avatar: 1,
              coverImage: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        subscriber: {
          $first: "$subscriber",
        },
      },
    },
    {
      $project: {
        subscriber: 1,
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ResponseApi(200, "Subscribers fetched successfully", subscribers)
    );
});

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
  const { user_id } = req.params;

  const subscribedChannels = await subscription.aggregate([
    {
      $match: {
        subscriber: new mongoose.Types.ObjectId(user_id),
      },
    },
    {
      $project: {
        channel: 1,
        subscriber: 1,
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "channel",
        foreignField: "_id",
        as: "subscribed",
        pipeline: [
          {
            $project: {
              username: 1,
              email: 1,
              fullname: 1,
              avatar: 1,
              coverImage: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        subscribed: {
          $first: "$subscribed",
        },
      },
    },
    {
      $project: {
        subscribed: 1,
      },
    },
  ]);

  res
    .status(200)
    .json(
      new ResponseApi(
        200,
        "Subscribed Channels fetched successfully",
        subscribedChannels
      )
    );
});

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };
