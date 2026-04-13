export type InventoryItem = {
  id: string;
  name: string;
  sku?: string;
  quantity: number;
  location?: string;
  category?: string;
  /** From equipment register (e.g. Josh Alegre) */
  owner?: string;
  /** Typical asset value (AUD) */
  midValueAud?: number;
  /** Per-day hire rates (AUD, ex GST) — used for quotes/invoices tier pricing */
  hireLowAud?: number;
  hireMidAud?: number;
  hireHighAud?: number;
  notes?: string;
  /** Alert when quantity at or below this level */
  minQuantity?: number;
  createdAt: string;
  updatedAt: string;
};

/** Work / job context for stock checkout (e.g. site install, gig). */
export type InventoryJob = {
  id: string;
  name: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdByEmail: string;
};

export type InventoryCheckoutStatus = "pending" | "approved" | "rejected" | "cancelled";

/** Request to take stock for a job; admin must approve before quantity decreases. */
export type InventoryCheckoutRequest = {
  id: string;
  itemId: string;
  jobId: string;
  quantity: number;
  status: InventoryCheckoutStatus;
  note?: string;
  requestedByUserId: string;
  requestedByEmail: string;
  createdAt: string;
  updatedAt: string;
  reviewedByEmail?: string;
  reviewedAt?: string;
  rejectReason?: string;
};
