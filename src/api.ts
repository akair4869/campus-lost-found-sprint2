import type { Item } from "./domain";
export type User = {
  id: string;
  name: string;
  email: string;
  role: "student" | "staff";
};
export type Report = Item & { isMine?: boolean };
export type Claim = {
  id: string;
  itemId: string;
  userId: string;
  evidence: string;
  status: string;
  note: string;
  createdAt: string;
  item: Report;
  claimantName: string;
  claimantEmail?: string;
  pickupToken?: string;
  tokenExpired: boolean;
  expires: number;
};
export type Notification = {
  id: string;
  kind: string;
  title: string;
  itemId: string;
  createdAt: string;
  read: number;
};
export type CatalogEntry = { name: string; nameAr: string; active: number };
export type Catalog = { categories: CatalogEntry[]; buildings: CatalogEntry[] };
export type Flag = {
  id: string;
  reason: string;
  details: string;
  status: string;
  createdAt: string;
  reporterName: string;
};
export type FlagEntry = { item: Report; ownerName: string; flags: Flag[] };
export type FlagQueue = { queue: FlagEntry[]; hidden: FlagEntry[] };
export type GroupStat = {
  name: string;
  lost: number;
  found: number;
  returned: number;
};
export type Analytics = {
  generatedAt: string;
  totals: {
    reports: number;
    lost: number;
    found: number;
    stillMissing: number;
    awaiting: number;
    handedOver: number;
    atDesk: number;
    returned: number;
    withdrawn: number;
    hidden: number;
    recoveryRate: number;
    avgDaysToReturn: number | null;
  };
  byCategory: GroupStat[];
  byBuilding: GroupStat[];
  byPoint: {
    id: string;
    name: string;
    awaiting: number;
    atDesk: number;
    returned: number;
  }[];
  monthly: { month: string; lost: number; found: number; returned: number }[];
  claims: Record<string, number>;
  flags: Record<string, number>;
};
export type Dashboard = {
  items: Report[];
  claims: Claim[];
  notifications: Notification[];
};
export async function api<T = any>(
  url: string,
  data?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  if (location.protocol === "file:")
    throw new Error("Start the local server to use this page. See README.md.");
  const r = await fetch(url, {
    method: data === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers:
      data === undefined
        ? {}
        : { "Content-Type": "application/json", "X-Campus-Request": "1" },
    body: data === undefined ? undefined : JSON.stringify(data),
    signal,
  });
  const result = await r.json();
  if (!r.ok)
    throw new Error(
      result.error || "Could not complete the request. Please try again.",
    );
  return result;
}
export const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
export function readPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read this photo."));
    r.readAsDataURL(file);
  });
}
