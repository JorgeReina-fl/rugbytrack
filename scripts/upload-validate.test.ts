// Ejecutar: npx --yes tsx scripts/upload-validate.test.ts   (sin dependencias nuevas; fixtures en memoria)
import { detectImageType, extensionFor, MAX_UPLOAD_BYTES } from "../src/lib/upload-validate";

const enc = new TextEncoder();
const bytes = (...n: number[]) => Uint8Array.from(n);
const concat = (...p: Uint8Array[]) => { const o = new Uint8Array(p.reduce((a, x) => a + x.length, 0)); let i = 0; for (const x of p) { o.set(x, i); i += x.length; } return o; };
const pad = (n: number) => new Uint8Array(n);

const JPEG = concat(bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10), enc.encode("JFIF"), pad(8));
const PNG = concat(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), pad(8));
const WEBP = concat(enc.encode("RIFF"), bytes(0x24, 0, 0, 0), enc.encode("WEBP"), enc.encode("VP8 "), pad(8));
const ftyp = (brand: string) => concat(bytes(0, 0, 0, 0x1c), enc.encode("ftyp" + brand), pad(16));
const AVIF = ftyp("avif");
const HEIC = ftyp("heic");
const SVG = enc.encode('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>');
const GIF = concat(enc.encode("GIF89a"), pad(16));
const RIFF_NO_WEBP = concat(enc.encode("RIFF"), bytes(0x24, 0, 0, 0), enc.encode("WAVE"), pad(8));

let fail = 0;
function t(name: string, got: unknown, want: unknown) {
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "OK  " : "FAIL"} | ${name.padEnd(54)} | esperado=${String(want).padEnd(5)} | obtenido=${String(got)}`);
}

t("JPEG válido", detectImageType(JPEG), "jpeg");
t("PNG válido", detectImageType(PNG), "png");
t("WEBP válido", detectImageType(WEBP), "webp");
t("AVIF (ftypavif)", detectImageType(AVIF), null);
t("HEIC (ftypheic)", detectImageType(HEIC), null);
t("MIF1 (ftypmif1)", detectImageType(ftyp("mif1")), null);
t("SVG (con onload)", detectImageType(SVG), null);
t("GIF89a", detectImageType(GIF), null);
t("RIFF que no es WEBP (WAVE)", detectImageType(RIFF_NO_WEBP), null);
t("texto plano", detectImageType(enc.encode("hola, esto no es una imagen")), null);
t("buffer vacío", detectImageType(new Uint8Array(0)), null);
t("buffer de 3 bytes (FF D8 FF)", detectImageType(bytes(0xff, 0xd8, 0xff)), null);
t("buffer de 3 bytes (1,2,3)", detectImageType(bytes(1, 2, 3)), null);

async function main() {
  // AVIF con nombre x.jpg declarado como image/jpeg: el MIME y el nombre del cliente no cuentan.
  const spoof = new File([AVIF], "x.jpg", { type: "image/jpeg" });
  t("AVIF 'x.jpg' declarado image/jpeg", detectImageType(new Uint8Array(await spoof.arrayBuffer())), null);
  // Al revés: un JPEG real con nombre .png y MIME text/plain se acepta por sus bytes.
  const real = new File([JPEG], "foto.png", { type: "text/plain" });
  t("JPEG real 'foto.png' declarado text/plain", detectImageType(new Uint8Array(await real.arrayBuffer())), "jpeg");

  t("extensión de jpeg", extensionFor("jpeg"), "jpg");
  t("extensión de png", extensionFor("png"), "png");
  t("extensión de webp", extensionFor("webp"), "webp");
  t("límite = 5 MB", MAX_UPLOAD_BYTES, 5 * 1024 * 1024);

  console.log(fail === 0 ? "\nTODOS OK" : `\n${fail} FALLOS`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
