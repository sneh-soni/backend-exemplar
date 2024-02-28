import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// localFilePath ==> file path on local system ==> defined in multer middleware
// can upload files directly to clodinary, but
// for production grade ==> 1. upload to local (using multer)
// 2. upload to cloudinary from localpath (here) 3. unlink using file system (fs)

export const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });
    fs.unlinkSync(localFilePath);

    /*
    ("Cloudinary response: ", response);

    Cloudinary response:  {
      asset_id: '9c3782100ac3d1a52efd8a1371ad6427',
      public_id: 'ioukdriplhmkmkjjdfp8',
      version: 1708617659,
      version_id: 'fbf56dc0bbcc0047ca0c6d2053e87ec3',
      signature: '6f40b9119d748eaf3c11f0b1b99b7b0df246e01f',
      width: 1584,
      height: 396,
      format: 'png',
      resource_type: 'image',
      created_at: '2024-02-22T16:00:59Z',
      tags: [],
      bytes: 799828,
      type: 'upload',
      etag: '3084e373957f6d290c6085286bd5280a',
      placeholder: false,
      url: 'http://res.cloudinary.com/dw61knhif/image/upload/v1708617659/ioukdriplhmkmkjjdfp8.png',     
      secure_url: 'https://res.cloudinary.com/dw61knhif/image/upload/v1708617659/ioukdriplhmkmkjjdfp8.png',
      folder: '',
      original_filename: '1',
      api_key: '897781582589997'
    }
    */

    return response;
  } catch (error) {
    // remove local file as upload to cloudinary failed
    fs.unlinkSync(localFilePath);
    return null;
  }
};
