import type { Money } from "../value-objects/money.js";

/**
 * CTO Enhancement: Pluggable provider interfaces.
 * Domain services depend ONLY on these interfaces, not on vendor implementations.
 * Infrastructure layers implement and inject these at startup.
 */

/** Attestation provider — e.g., on-chain EAS, off-chain W3C VC */
export interface IAttestationProvider {
  attest(targetId: string, schema: string, data: Record<string, unknown>): Promise<string>; // returns attestation UID
  verify(attestationUid: string): Promise<boolean>;
}

/** FX rate provider — e.g., open exchange rates, internal oracle */
export interface IFXRateProvider {
  getRate(fromCurrency: string, toCurrency: string): Promise<number>;
  convert(amount: Money, toCurrency: string): Promise<Money>;
}

/** External compliance provider — e.g., Chainalysis, Elliptic */
export interface IComplianceProvider {
  screen(address: string): Promise<{ risk: "low" | "medium" | "high"; flags: string[] }>;
  checkSanctions(name: string, country: string): Promise<{ hit: boolean; details: string[] }>;
}

/** Notification provider — e.g., email, SMS, push */
export interface INotificationProvider {
  send(
    channel: "email" | "sms" | "push",
    recipient: string,
    payload: Record<string, unknown>
  ): Promise<void>;
}

/** Settlement network adapter — plugs into real settlement rails later */
export interface ISettlementNetworkAdapter {
  submit(
    settlementId: string,
    instructions: Record<string, unknown>
  ): Promise<{ externalRef: string }>;
  queryStatus(externalRef: string): Promise<{ status: string; details: Record<string, unknown> }>;
}
