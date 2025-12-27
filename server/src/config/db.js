import mongoose from "mongoose";
import { env } from "./env.js";

export const connectDB = async ()=> {
    try{
        const connect = await mongoose.connect(env.mongoUri);
        console.log("gg mongodb conneccted");
        
    }catch(err){
        console.error("iie mongodb wa disconnected");
        process.exit(1);
    }
}



