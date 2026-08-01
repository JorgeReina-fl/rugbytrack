"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export function CreateThreadForm({ teamId }: { teamId: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const applyFile = useCallback((file: File) => {
    if (!ALLOWED_MIME.includes(file.type)) {
      setError("Solo se permiten imágenes JPG, PNG o WEBP.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("La imagen supera el límite de 5 MB.");
      return;
    }
    setError(null);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) applyFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) applyFile(file);
  };

  const removeImage = () => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const close = () => {
    setIsOpen(false);
    removeImage();
    setError(null);
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const title = form.get("title") as string;
    const content = form.get("content") as string;

    try {
      let imageUrl: string | null = null;

      if (imageFile) {
        const fd = new FormData();
        fd.append("file", imageFile);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
        if (!uploadRes.ok) {
          const d = await uploadRes.json();
          throw new Error(d.error || "Error al subir la imagen");
        }
        const d = await uploadRes.json();
        imageUrl = d.url;
      }

      const res = await fetch(`/api/teams/${teamId}/forum`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, imageUrl }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al crear el hilo");
      }

      close();
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full sm:w-auto rounded-xl bg-primary px-6 py-3 text-sm font-mono uppercase tracking-widest font-bold text-primary-foreground hover:opacity-90 transition-all shadow-md"
      >
        + NUEVO DEBATE
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm mb-8 animate-in fade-in slide-in-from-top-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-heading font-bold uppercase tracking-tight text-foreground">Crear Nuevo Debate</h3>
        <button onClick={close} className="text-muted-foreground hover:text-foreground font-mono">
          ✕ Cancelar
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive font-mono">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="title" className="mb-1.5 block text-xs font-mono uppercase tracking-widest font-bold text-muted-foreground">
            Título del Debate
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            minLength={5}
            maxLength={100}
            className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none ring-ring transition-all focus:border-ring focus:ring-2 font-mono"
            placeholder="Ej: Análisis Táctico vs. Rival X"
          />
        </div>

        <div>
          <label htmlFor="content" className="mb-1.5 block text-xs font-mono uppercase tracking-widest font-bold text-muted-foreground">
            Contenido
          </label>
          <textarea
            id="content"
            name="content"
            required
            minLength={10}
            rows={4}
            className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none ring-ring transition-all focus:border-ring focus:ring-2 font-sans resize-none"
            placeholder="Escribe aquí tu análisis o comentario..."
          />
        </div>

        {/* Image upload */}
        <div>
          <label className="mb-1.5 block text-xs font-mono uppercase tracking-widest font-bold text-muted-foreground">
            Imagen adjunta <span className="font-normal normal-case">(opcional · JPG/PNG/WEBP · máx. 5 MB)</span>
          </label>

          {imagePreview ? (
            <div className="relative w-full rounded-xl overflow-hidden border border-border">
              <Image
                src={imagePreview}
                alt="Preview"
                width={800}
                height={400}
                className="w-full max-h-64 object-cover"
                unoptimized
              />
              <button
                type="button"
                onClick={removeImage}
                className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm border border-border rounded-full px-3 py-1 text-xs font-mono font-bold text-foreground hover:text-destructive hover:border-destructive transition-all"
              >
                ✕ Quitar
              </button>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 cursor-pointer transition-all ${
                dragOver
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-background text-muted-foreground hover:border-primary hover:text-primary"
              }`}
            >
              <span className="text-2xl">📎</span>
              <span className="text-xs font-mono uppercase tracking-widest font-bold">
                Arrastra una imagen o haz click para seleccionar
              </span>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-primary px-4 py-4 text-sm font-mono uppercase tracking-widest font-bold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "PUBLICANDO..." : "PUBLICAR DEBATE"}
        </button>
      </form>
    </div>
  );
}
