import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
    email: {
      type: String,
      required: true,
      unique: true, // no two accounts with the same email
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    passwordHash: { type: String, required: true }, // never the real password
  },
  { timestamps: true } // adds createdAt and updatedAt automatically
);

export default mongoose.model("User", userSchema);