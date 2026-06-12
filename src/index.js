import dotenv from "dotenv"
import connectDB from "./db/index.js";
import app from './app.js'
dotenv.config({
    path : "./env"
})



connectDB()
.then(() => {
    app.listen(process.env.PORT || 8000, () => {
        console.log(`⚙️  Server is running on port ${process.env.PORT}`);
    });
})
.catch((error) => {
    console.log("mongodb connection failed: ", error);
})






// its the other method to connect to database
/*const app = express();
( async ()=>{
    try{
        mongoose.connect('${process.env.MY_DATABASE}/${DB}')
        app.on("error", (error)=>{
            console.log("ERROR : ", error);
            throw error;
        })
        app.listen(process.env.PORT, ()=>{
            console.log(`Server is running on port ${process.env.PORT}`);
        })
    }
    catch(error){
        console.error("Error :", error);
        throw error;
    }
})()*/
