import { Tweet } from "../models/tweet.model.js";
import ErrorApi from "../utils/ErrorApi.js";
import ResponseApi from "../utils/ResponseApi.js";
import asyncHandler from "../utils/asyncHandler.js";

const createTweet = asyncHandler(async (req, res) => {
  const { content } = req.body;

  if (!content) {
    throw new ErrorApi(405, "Invalid tweet content");
  }

  const tweet = await Tweet.create({
    content,
    owner: req.user,
  });

  return res
    .status(200)
    .json(new ResponseApi(200, "Tweet created Successfully", tweet));
});

const getUserTweets = asyncHandler(async (req, res) => {
  const userTweets = await Tweet.aggregate([
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "userTweets",
      },
    },
    {
      $project: {
        content: 1,
      },
    },
  ]);

  return res
    .status(200)
    .json(new ResponseApi(200, "User Tweets Fetched Successfully", userTweets));
});

const updateTweet = asyncHandler(async (req, res) => {
  const { newContent } = req.body;

  const { tweet_id } = req.params;

  const newTweet = await Tweet.findByIdAndUpdate(
    tweet_id,
    {
      content: newContent,
    },
    { new: true }
  );

  await newTweet.save();

  return res
    .status(200)
    .json(new ResponseApi(200, "Tweet Updated Successfully", newTweet));
});

const deleteTweet = asyncHandler(async (req, res) => {
  const { tweet_id } = req.params;

  await Tweet.findByIdAndDelete(tweet_id);

  return res
    .status(200)
    .json(new ResponseApi(200, "Tweet Deleted Successfully"));
});

export { createTweet, getUserTweets, updateTweet, deleteTweet };
