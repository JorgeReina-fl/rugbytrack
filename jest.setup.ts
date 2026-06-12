import "@testing-library/jest-dom";

// JSDOM environment overrides/shadows Request, Response and Headers.
// We restore them from Node's native globalThis context for Next.js App Router tests.
const nodeGlobal = globalThis as any;

global.Request = global.Request || nodeGlobal.Request;
global.Response = global.Response || nodeGlobal.Response;
global.Headers = global.Headers || nodeGlobal.Headers;

