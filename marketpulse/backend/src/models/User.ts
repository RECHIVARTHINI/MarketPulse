import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  displayName: string;
  attentionBudget: number; // configurable per-user "how many things to surface per visit"
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    attentionBudget: { type: Number, default: 5, min: 1, max: 50 },
  },
  { timestamps: true }
);

export const User = model<IUser>('User', UserSchema);
