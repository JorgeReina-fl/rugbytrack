/**
 * @jest-environment node
 */

// sendEmail (resend.ts) no registra destinatario, asunto ni el error del proveedor.
const EMAIL = "jugador.secreto@example.test";
const NAME = "Nombre Secreto";

const logCalls: unknown[][] = [];
const record = (...a: unknown[]) => void logCalls.push(a);
jest.mock("@/lib/logger", () => ({ logger: { info: record, warn: record, error: record, debug: record } }));
jest.mock("@/lib/email-budget", () => ({ trackEmailBudget: jest.fn().mockResolvedValue(true) }));
jest.mock("@react-email/components", () => ({ render: async () => "<html/>" }));

const send = jest.fn();
jest.mock("resend", () => ({ Resend: jest.fn().mockImplementation(() => ({ emails: { send: (...a: unknown[]) => send(...a) }, batch: { send: jest.fn() } })) }));

const subject = `Tu convocatoria para ${NAME} ha cambiado`;

describe("sendEmail — logs sin datos personales", () => {
  beforeEach(() => {
    logCalls.length = 0;
    jest.resetModules();
  });

  test("envío correcto con clave: registra solo el id del email", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const { sendEmail } = await import("@/lib/resend");
    send.mockResolvedValue({ data: { id: "m1" }, error: null });
    await sendEmail({ to: EMAIL, subject, react: null as never });
    const out = JSON.stringify(logCalls);
    expect(out).toContain("m1");
    expect(out).not.toContain(EMAIL);
    expect(out).not.toContain(NAME);
  });

  test("fallo del proveedor con destinatario en el mensaje", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const { sendEmail } = await import("@/lib/resend");
    send.mockRejectedValue(Object.assign(new Error(`Invalid to ${EMAIL}`), { name: "ResendError", statusCode: 422 }));
    expect(await sendEmail({ to: EMAIL, subject, react: null as never })).toBeNull();
    const out = JSON.stringify(logCalls);
    expect(out).toContain("ResendError");
    expect(out).not.toContain(EMAIL);
    expect(out).not.toContain(NAME);
  });

  test("sin RESEND_API_KEY: el aviso de envío omitido no lleva destinatario ni asunto", async () => {
    delete process.env.RESEND_API_KEY;
    const { sendEmail } = await import("@/lib/resend");
    await sendEmail({ to: EMAIL, subject, react: null as never });
    const out = JSON.stringify(logCalls);
    expect(out).not.toContain(EMAIL);
    expect(out).not.toContain(NAME);
  });

  test("Resend devuelve { error } sin lanzar: no hay «Email sent successfully», el log no lleva datos personales y el llamador ve null", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const { sendEmail, sendCallupNotification } = await import("@/lib/resend");
    send.mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: `The to address ${EMAIL} is invalid (${NAME})`, statusCode: 422 },
    });
    expect(await sendEmail({ to: EMAIL, subject, react: null as never })).toBeNull();
    expect(
      await sendCallupNotification({ to: EMAIL, userName: NAME, eventTitle: "P", eventDate: "d", eventLocation: "l", rsvpLink: "http://x" })
    ).toBeNull();
    const out = JSON.stringify(logCalls);
    expect(out).not.toContain("Email sent successfully");
    expect(out).toContain("Failed to send email via Resend");
    expect(out).toContain("validation_error");
    expect(out).toContain("422");
    expect(out).not.toContain(EMAIL);
    expect(out).not.toContain(NAME);
  });

  test("respuesta correcta: devuelve los datos y registra el éxito", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const { sendEmail } = await import("@/lib/resend");
    send.mockResolvedValue({ data: { id: "m9" }, error: null });
    expect(await sendEmail({ to: EMAIL, subject, react: null as never })).toEqual({ data: { id: "m9" }, error: null });
    expect(JSON.stringify(logCalls)).toContain("Email sent successfully");
  });
});
