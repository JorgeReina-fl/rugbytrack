export function getRequiredSecret(name: string): string {
  const value = process.env[name];
  if (!value || value.length < 32) {
    throw new Error(`${name} missing or too short`);
  }
  return value;
}
