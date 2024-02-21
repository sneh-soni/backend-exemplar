import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// localFilePath ==> file path on local database
// can upload files directly to clodinary, but
// for production grade ==> 1. upload to local database (using multer)
// 2. upload to cloudinary from database (here) 3. unlink using file system (fs)

export const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });
    console.log(response.url, " <==> ", response.secure_url);
    return response;
  } catch (error) {
    // remove local file as upload to cloudinary failed
    fs.unlinkSync(localFilePath);
    return null;
  }
};
