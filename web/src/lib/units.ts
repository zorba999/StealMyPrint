/**
 * GEN has 18 decimals. Amounts are parsed from decimal strings without going
 * through Number, so 0.1 GEN does not arrive as 99999999999999998 wei.
 */
export const DECIMALS = 18n;
export const ONE_GEN = 10n ** DECIMALS;

export function toWei(amount: string): bigint {
  const trimmed = (amount ?? "").trim();
  if (trimmed === "") return 0n;
  if (!/^\d*\.?\d*$/.test(trimmed)) throw new Error("Not a number");

  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > Number(DECIMALS)) throw new Error("Too many decimals");

  const padded = frac.padEnd(Number(DECIMALS), "0");
  return BigInt(whole || "0") * ONE_GEN + BigInt(padded || "0");
}

export function fromWei(wei: bigint | string, maxFrac = 6): string {
  const v = typeof wei === "bigint" ? wei : BigInt(wei || "0");
  const whole = v / ONE_GEN;
  const frac = (v % ONE_GEN).toString().padStart(Number(DECIMALS), "0");
  const shown = frac.slice(0, maxFrac).replace(/0+$/, "");
  return shown ? `${whole}.${shown}` : whole.toString();
}
