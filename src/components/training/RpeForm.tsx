"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { rpeEntrySchema, RpeEntryInput } from "@/lib/validations/rpe";
import { useRouter } from "next/navigation";

interface RpeFormProps {
  eventId: string;
}

export function RpeForm({ eventId }: RpeFormProps) {
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RpeEntryInput>({
    resolver: zodResolver(rpeEntrySchema),
    defaultValues: {
      notes: "",
    } as Partial<RpeEntryInput>,
  });

  const selectedRpe = watch("rpe");
  const notesValue = watch("notes") || "";

  const onSubmit = async (data: RpeEntryInput) => {
    setApiError(null);
    try {
      const response = await fetch("/api/rpe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...data, eventId }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          throw new Error("Ya has registrado el RPE para este evento");
        }
        throw new Error(result.error || "Ocurrió un error al enviar el RPE");
      }

      router.refresh();
    } catch (error: any) {
      setApiError(error.message);
    }
  };

  const getRpeColorClasses = (num: number, isSelected: boolean) => {
    if (!isSelected) {
      return "border-border bg-background text-muted-foreground hover:border-primary hover:text-foreground hover:bg-secondary font-mono text-lg";
    }

    // Usamos el token primary con un efecto "pop" (microanimación)
    return "ring-2 ring-ring bg-primary text-primary-foreground font-bold border-transparent shadow-md scale-105 font-mono text-xl z-10";
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {apiError && (
        <div className="rounded-none border border-destructive bg-destructive/10 p-4 text-sm font-semibold text-destructive">
          ⚠️ {apiError}
        </div>
      )}

      <div className="space-y-4">
        <label className="block text-sm font-heading uppercase tracking-tight font-bold text-foreground">
          Intensidad Percibida (RPE)
        </label>
        <div className="grid grid-cols-5 gap-2 sm:gap-4 relative">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => setValue("rpe", num, { shouldValidate: true })}
              className={`rounded-none border py-4 text-center transition-all duration-200 ease-out ${getRpeColorClasses(
                num,
                selectedRpe === num
              )}`}
            >
              {num}
            </button>
          ))}
        </div>
        {errors.rpe && (
          <p className="text-xs text-destructive mt-1 font-mono">{errors.rpe.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="duration" className="block text-sm font-heading uppercase tracking-tight font-bold text-foreground">
          Duración efectiva (minutos)
        </label>
        <input
          id="duration"
          type="number"
          min={1}
          max={300}
          className="w-full rounded-none border border-input bg-background p-4 text-sm text-foreground placeholder-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring transition-colors font-mono"
          placeholder="Ej: 90"
          {...register("duration", { valueAsNumber: true })}
        />
        {errors.duration && (
          <p className="text-xs text-destructive font-mono">{errors.duration.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-end">
          <label htmlFor="notes" className="block text-sm font-heading uppercase tracking-tight font-bold text-foreground">
            Notas adicionales (opcional)
          </label>
          <span className="text-xs text-muted-foreground font-mono">
            {notesValue.length}/500
          </span>
        </div>
        <textarea
          id="notes"
          maxLength={500}
          className="w-full min-h-[120px] rounded-none border border-input bg-background p-4 text-sm text-foreground placeholder-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring transition-colors resize-none font-sans"
          placeholder="¿Cómo te sentiste? ¿Alguna molestia?"
          {...register("notes")}
        />
        {errors.notes && (
          <p className="text-xs text-destructive font-mono">{errors.notes.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full flex items-center justify-center rounded-none bg-primary px-4 py-4 text-sm font-mono uppercase tracking-widest font-bold text-primary-foreground hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
      >
        {isSubmitting ? (
          <>
            <svg
              className="mr-2 h-4 w-4 animate-spin text-primary-foreground"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Enviando...
          </>
        ) : (
          "Guardar RPE"
        )}
      </button>
    </form>
  );
}
