import app from "./app.js";
import { connectDB } from "./config/db.js";
import { env } from "./config/env.js";

connectDB().then(()=>{
    app.listen(env.port,()=>{
        console.log(`server wa pōto ${env.port} de jikkō-chū desu `);
        
    })
})