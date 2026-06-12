import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

    cloudinary.config({ 
        cloud_name: process.env.CLOUDINARY_NAME, 
        api_key: process.env.CLOUDINARY_KEY, 
        api_secret: process.env.CLOUDINARY_SECRET 
    });


    const uploadonCloudinary = async (localFilePath) => {
        try {
            const response = await cloudinary.uploader.upload(localFilePath, {
                resource_type: "auto",
            })
            // console.log("file is been uploaded:",response);
            fs.unlinkSync(localFilePath)
            return response;
        } catch (error) {
            fs.unlinkSync(localFilePath) // remove the locally saved temporary file as the upload operation got failed
            return null;
        }
    }



export {uploadonCloudinary};