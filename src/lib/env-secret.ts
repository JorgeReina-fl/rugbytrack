import { assertSecret } from "../../prisma/token-core";

export function getRequiredSecret(name: string): string {
  return assertSecret(process.env[name], name);
}
