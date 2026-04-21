import { Schema, model, Document } from 'mongoose';

export interface IWorkingHoursDocument extends Document {
  // Single shift (legacy)
  checkInTime: string;  // HH:mm (e.g. "09:00")
  checkOutTime: string; // HH:mm (e.g. "17:00")
  lateThresholdMinutes: number; // how many minutes late is considered "late"
  
  // Two-shift configuration
  morningStart: string;    // HH:mm (e.g. "08:00")
  morningEnd: string;      // HH:mm (e.g. "12:00") - morning shift end
  afternoonStart: string;  // HH:mm (e.g. "13:30") - afternoon shift start (after break)
  afternoonEnd: string;    // HH:mm (e.g. "17:30") - afternoon shift end
  breakMinutes: number;    // Break duration between shifts (default 90 mins, not counted as paid hours)
  
  createdAt: Date;
  updatedAt: Date;
}

const workingHoursSchema = new Schema<IWorkingHoursDocument>(
  {
    // Legacy single shift
    checkInTime: { type: String, default: '09:00' },
    checkOutTime: { type: String, default: '17:00' },
    lateThresholdMinutes: { type: Number, default: 0 },
    
    // Two-shift configuration
    morningStart: { type: String, default: '08:00' },
    morningEnd: { type: String, default: '12:00' },
    afternoonStart: { type: String, default: '13:30' },
    afternoonEnd: { type: String, default: '17:30' },
    breakMinutes: { type: Number, default: 90 }, // 90 mins break not counted as paid
  },
  { timestamps: true },
);

// Singleton pattern - only one document
export const WorkingHours = model<IWorkingHoursDocument>('WorkingHours', workingHoursSchema);

export const getWorkingHours = async (): Promise<IWorkingHoursDocument> => {
  let config = await WorkingHours.findOne();
  if (!config) {
    config = await WorkingHours.create({
      checkInTime: '09:00',
      checkOutTime: '17:00',
      lateThresholdMinutes: 0,
      morningStart: '08:00',
      morningEnd: '12:00',
      afternoonStart: '13:30',
      afternoonEnd: '17:30',
      breakMinutes: 90,
    });
  }
  return config;
};
