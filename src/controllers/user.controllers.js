import { asynchandler } from "../utils/asynchandler.js";
import {ApiError} from "../utils/ApiError.js"
import { User } from "../models/user.model.js";
import {uploadonCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import mongoose from "mongoose";
import jwt from "jsonwebtoken"



const generateaccessAndRefeshToken = async (userid) => {
    try {
        const user = await User.findById(userid)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshtoken = refreshToken
        await user.save({ validateBeforeSave: false })

        return {accessToken, refreshToken}
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating referesh and access token")
    }
}

const registerUser = asynchandler(async (req, res) => {
    // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res
    
    const {email, password, fullname, username} = req.body
    console.log("email:", email)
    console.log(req.body)

    // we can check all fields in this way as well

    // if(fullname === ""){
    //     throw new ApiError(400, "Fullname is required")
    // }

    if (
        [fullname, email, password].some((field) => field?.trim() === "") 
    ) 
    {
        throw new ApiError(400, "All fields are required")
    }

    const existeduser = await User.findOne({
        $or : [{email},{username}]
    })

    if(existeduser){
        throw new ApiError(400, "User already exists")
    }
    console.log(req.files)

    const avatarlocalpath = req.files?.avatar[0]?.path
    // const coverimagelocalpath = req.files?.coverimage[0]?.path

    // let coverimagelocalpath;
    // if (req.files && Array.isArray(req.files.coverimage) && req.files.coverimage.length > 0) {
    //     coverimagelocalpath = req.files.coverimage[0].path
    // }
    if(!avatarlocalpath){                                          // problem with coverimage uploading need to fix it
        throw new ApiError(400, "Avatar is required")
    }
    let coverImageLocalPath
    if (req.files?.coverimage?.[0]?.path) {
        coverImageLocalPath = req.files.coverimage[0].path;
    }
                                                    
    const avatar = await uploadonCloudinary(avatarlocalpath)
    const coverimage = await uploadonCloudinary(coverImageLocalPath)
    if(!avatar){
        throw new ApiError(500, "Error while uploading avatar")
    }
    console.log(req.files)

    const user = await User.create({
        fullname,
        avatar : avatar.url,
        coverimage : coverimage?.url || "",
        email,
        password,
        username : username.toLowerCase()
    })
    const createduser = await User.findById(user._id).select("-password -refreshtoken") // -password and -refreshtoken means we don't want to return these fields in response (its syntax of mongoose)
    if(!createduser){
        throw new ApiError(500, "Error while creating user")
    }

    return res.status(201).json(
        new ApiResponse(200, createduser, "user registered successfully")
    )

})


   
// creating login for user and for that steps are:-
        // req body -> data
        // username or email
        //find the user
        //password check
        //access and referesh token
        //send cookie

const loginUser = asynchandler(async (req, res) =>{
    const {email, password, username} = req.body
    if(!email || !username){
        throw new ApiError(400, "username and email required")
    }

    const user = await User.findOne({
        $or:[{email}, {username}]
    })
    if(!user){
        throw new ApiError(400, "user not exist")
    }

    const ispasswordvalid = await user.isPasswordCorrect(password)
    if(!ispasswordvalid){
        throw new ApiError(404, "password invalid")
    }

    const {accessToken, refreshToken} = await generateaccessAndRefeshToken(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(200, 
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged In Successfully"
        )
    )

})


const logoutUser = asynchandler(async(req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1 // this removes the field from document
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"))
})


const refreshAccessToken = asynchandler(async(req, res) => {
    const incomingRefreshToken = req.cookie.refreshToken || req.body.refreshToken
    if(!incomingRefreshToken){
        throw new ApiError(401, "unauthorized request")
    }

    try {
        
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
        const user = await User.findById(decodedToken?._id)
        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }
        
            if (incomingRefreshToken !== user?.refreshtoken) {
                throw new ApiError(401, "Refresh token is expired or used")
                
            }
        
            const options = {
                httpOnly: true,
                secure: true
            }
        
            const {accessToken, newRefreshToken} = await generateaccessAndRefeshToken(user._id)
        
            return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200, 
                    {accessToken, refreshToken: newRefreshToken},
                    "Access token refreshed"
                )
            )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }
})


const changeCurrentPassword = asynchandler(async(req, res) => {
    const {oldPassword, newPassword} = req.body
    const user = await User.findById(req.user?._id)

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
    if(!isPasswordCorrect){
        throw new ApiError(401, "invalid old password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res.status(200)
    .json(200, {}, "password changed successfully")
})


const getCurrentUser = asynchandler(async(req, res) => {
    return res.status(200)
    .json(200, req.user, "user details fetched successfully")
})

const changeAccountDetails = asynchandler(async(req, res) => {
    const {fullname, email} = req.body
    if(!fullname || !email){
        throw new ApiError(400, "user details required")
    }

    const user = User.findByIdAndUpdate(
        req.user?._id,
        {$set:{
            fullname: fullname,
            email: email
        }},
        {new: true}    // with this it will return new document in the response
    ).select("-password")

    return res.status(200).json(200, user, "account details changed successfully")
    
})


const updateUserAvatar = asynchandler(async(req, res) => {
    const avatarLocalPath = req.file?.path
    const avatar = await uploadonCloudinary(avatarLocalPath)
    if(!avatar.url){
        throw new ApiError(400, "error while uploading avatar")
    }

    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password")

    return res.status(200).json(200, user , "avatar updated successfully")
})


const updateUserCoverimage = asynchandler(async(req, res) => {
    const coverimageLocalPath = req.file?.path
    const coverimage = await uploadonCloudinary(coverimageLocalPath)
    if(!coverimage.url){
        throw new ApiError(400, "error while uploading avatar")
    }

    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set:{
                coverimage: coverimage.url
            }
        },
        {new: true}
    ).select("-password")

    return res.status(200).json(200, user , "coverimage updated successfully")
})



export {registerUser, loginUser, logoutUser, refreshAccessToken, 
    changeCurrentPassword, getCurrentUser, updateUserAvatar, updateUserCoverimage}