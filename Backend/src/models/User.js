import mongoose, { mongo } from "mongoose";
import bcrypt from 'bcryptjs'

const userSchema = new mongoose.Schema(
    {
      name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [255, "Name cannot exceed 255 characters"],
    },
        email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [255, "Email cannot exceed 255 characters"],
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email",
      ],
    },
    phone: {
      type: String,
      maxlength: [15, "Contact number cannot exceed 15 characters"],
      match: [/^\d+$/, "Contact number must contain only digits"],
      required:true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters long"],
      select: false,
    },
})

//hashing password

userSchema.pre("save" , async function(next){
  if (!this.isModified("password")) return next();
    try {
        const salt = await bcrypt.genSalt(10); 
        this.password = await bcrypt.hash(this.password, salt); 
        next();
    } catch (error) {
        next(error);
    }
})

userSchema.methods.comparePassword = async function(candidatePassword){
    if (typeof this.password !== 'string') {
      // password not selected; require caller to select it
      throw new Error('Password not selected on user document. Use .select("+password") when querying.');
    }
    return bcrypt.compare(candidatePassword, this.password);
}

// Ensure password is not returned in JSON responses
userSchema.set('toJSON', {
  transform: function(doc, ret) {
    delete ret.password;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model("User", userSchema);