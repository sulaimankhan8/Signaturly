import mongoose from "mongoose";

const PdfSchema = new mongoose.Schema(
    {
        userId:{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        originalFileName:{
            type: String,
            required: true
        },

        storagePath:{
            type:String,
            required: true
        },

        originalHash:{
            type: String,
            required: true,
        },

        pageCount:{
            type: Number,
            required: true,
        },

        status:{
            type: String,
            enum: ["uploaded", "signed", "failed"],
            default: "uploaded"
        },
    }, { timestamps: true }
);

export const Pdf = mongoose.model("Pdf",PdfSchema);