import mongoose from "mongoose";
import { DB_NAME } from "../constants";

const connectDB = async () => {
  try {
    const Connection = await mongoose.connect(
      `${process.env.MONGODB_URL}/${DB_NAME}`
    );
    console.log("Mongodb connected: ", Connection);
  } catch (error) {
    console.log("Mongodb connection error: ", error);
    process.exit(1);
  }
};
