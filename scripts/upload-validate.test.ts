/** @jest-environment node */
import { detectImageType, extensionFor, MAX_UPLOAD_BYTES, UPLOAD_URL_RE, uploadUrl } from "../src/lib/upload-validate";

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

const UUID = "123e4567-e89b-12d3-a456-426614174000";
const urlOk = (u: string) => uploadUrl.safeParse(u).success;

describe("upload validation", () => {
  describe("detectImageType (por bytes)", () => {
    test.each<[string, Uint8Array, string | null]>([
      ["JPEG válido", JPEG, "jpeg"],
      ["PNG válido", PNG, "png"],
      ["WEBP válido", WEBP, "webp"],
      ["AVIF (ftypavif)", AVIF, null],
      ["HEIC (ftypheic)", HEIC, null],
      ["MIF1 (ftypmif1)", ftyp("mif1"), null],
      ["SVG (con onload)", SVG, null],
      ["GIF89a", GIF, null],
      ["RIFF que no es WEBP (WAVE)", RIFF_NO_WEBP, null],
      ["texto plano", enc.encode("hola, esto no es una imagen"), null],
      ["buffer vacío", new Uint8Array(0), null],
      ["buffer de 3 bytes (FF D8 FF)", bytes(0xff, 0xd8, 0xff), null],
      ["buffer de 3 bytes (1,2,3)", bytes(1, 2, 3), null],
    ])("%s", (_name, input, want) => {
      expect(detectImageType(input)).toBe(want);
    });

    test("AVIF 'x.jpg' declarado image/jpeg: el MIME y el nombre del cliente no cuentan", async () => {
      const spoof = new File([AVIF], "x.jpg", { type: "image/jpeg" });
      expect(detectImageType(new Uint8Array(await spoof.arrayBuffer()))).toBeNull();
    });

    test("JPEG real 'foto.png' declarado text/plain: se acepta por sus bytes", async () => {
      const real = new File([JPEG], "foto.png", { type: "text/plain" });
      expect(detectImageType(new Uint8Array(await real.arrayBuffer()))).toBe("jpeg");
    });
  });

  describe("uploadUrl (solo rutas que genera /api/upload)", () => {
    test.each(["jpg", "png", "webp"])("URL válida /uploads/<uuid>.%s", (ext) => {
      expect(urlOk(`/uploads/${UUID}.${ext}`)).toBe(true);
    });

    test.each<[string, string]>([
      ["javascript:alert(1)", "javascript:alert(1)"],
      ["https://evil.tld/x.jpg", "https://evil.tld/x.jpg"],
      ["//evil.tld/x.jpg", "//evil.tld/x.jpg"],
      ["/uploads/../x.jpg", "/uploads/../x.jpg"],
      ["/uploads/<uuid>.svg", `/uploads/${UUID}.svg`],
      ["/uploads/<uuid>.gif", `/uploads/${UUID}.gif`],
      ["/uploads/<uuid>.jpg?x=1", `/uploads/${UUID}.jpg?x=1`],
      ["/uploads/<uuid>.jpg#a", `/uploads/${UUID}.jpg#a`],
      ["/uploads/<uuid>.jpg con salto de línea", `/uploads/${UUID}.jpg\n`],
      ["/uploads/x/<uuid>.jpg (subcarpeta)", `/uploads/x/${UUID}.jpg`],
      ["data:image/png;base64,iVBORw0KGgo=", "data:image/png;base64,iVBORw0KGgo="],
      ["cadena vacía", ""],
    ])("URL rechazada: %s", (_name, url) => {
      expect(urlOk(url)).toBe(false);
    });

    test("UPLOAD_URL_RE anclada (prefijo)", () => {
      expect(UPLOAD_URL_RE.test(`x/uploads/${UUID}.jpg`)).toBe(false);
    });

    test("opcional y nullable como en los esquemas", () => {
      const schema = uploadUrl.optional().nullable();
      expect(schema.safeParse(null).success && schema.safeParse(undefined).success).toBe(true);
    });
  });

  describe("extensionFor y límite", () => {
    test.each([
      ["jpeg", "jpg"],
      ["png", "png"],
      ["webp", "webp"],
    ] as const)("extensión de %s", (type, ext) => {
      expect(extensionFor(type)).toBe(ext);
    });

    test("límite = 5 MB", () => {
      expect(MAX_UPLOAD_BYTES).toBe(5 * 1024 * 1024);
    });
  });
});
