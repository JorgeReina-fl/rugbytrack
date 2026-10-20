// nginx fija X-Real-IP desde $remote_addr (CF-Connecting-IP vía real_ip_header);
// X-Forwarded-For lleva primero lo que envíe el cliente, así que solo es el último recurso.
export function getClientIp(headers: Headers): string {
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",").at(-1)!.trim();
  return "unknown";
}
