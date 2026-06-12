import mongoose, { Schema, Document, Model } from "mongoose";

export interface IThread extends Document {
  teamId: string;
  authorId: string;
  authorName: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const ThreadSchema: Schema = new Schema(
  {
    teamId: {
      type: String,
      required: true,
      index: true, // Índice esencial para filtrar los hilos rápidamente por equipo
    },
    authorId: {
      type: String,
      required: true,
    },
    authorName: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true, // Agrega createdAt y updatedAt automáticamente
  }
);

// Evitamos el error de OverwriteModelError durante el HMR de Next.js
export const Thread: Model<IThread> =
  mongoose.models.Thread || mongoose.model<IThread>("Thread", ThreadSchema);
