import { auth } from "@/auth";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { detectImageType, extensionFor, MAX_UPLOAD_BYTES } from "@/lib/upload-validate";

// Margen para las cabeceras multipart al comprobar Content-Length antes de leer el cuerpo.
const MULTIPART_OVERHEAD = 64 * 1024;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Límite de tamaño antes de leer el cuerpo entero (cuando el cliente declara Content-Length).
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD) {
    return NextResponse.json({ error: "El archivo supera el límite de 5 MB." }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Campo 'file' requerido" }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "El archivo supera el límite de 5 MB." },
      { status: 422 }
    );
  }

  // El tipo se decide por los bytes; file.type y file.name los controla el cliente y no se usan.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) {
    return NextResponse.json(
      { error: "Formato no permitido. Solo JPG, PNG o WEBP." },
      { status: 415 }
    );
  }

  const filename = `${randomUUID()}.${extensionFor(type)}`;
  const uploadsDir = join(process.cwd(), "public", "uploads");

  await mkdir(uploadsDir, { recursive: true });
  await writeFile(join(uploadsDir, filename), bytes);

  return NextResponse.json({ url: `/uploads/${filename}` }, { status: 201 });
}
