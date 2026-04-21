import { Schema, model, Document } from 'mongoose';

export interface IDepartmentDocument extends Document {
  name: string;
  code: string;        // short unique code e.g. "ENG", "HR"
  locationCode: string; // e.g. "VN-HCM", "SG"
  country: string;
  currency: string;    // default currency for this location
}

const departmentSchema = new Schema<IDepartmentDocument>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    locationCode: { type: String, default: '' },
    country: { type: String, default: '' },
    currency: { type: String, default: 'VND' },
  },
  { timestamps: true },
);

export const Department = model<IDepartmentDocument>('Department', departmentSchema);
