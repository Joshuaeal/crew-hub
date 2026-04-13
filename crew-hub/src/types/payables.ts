/** Supplier bills and other outflows to approve and pay (AUD inc GST). */
export type PayableStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "paid"
  | "void";

export type Payable = {
  id: string;
  title: string;
  vendor?: string;
  /** Amount in AUD including GST — always ≥ 0 (cash out). */
  amountAudIncGst: number;
  category?: string;
  status: PayableStatus;
  /** ISO date (calendar day) when payment is due or was expected */
  dueDate?: string;
  /** Set when status becomes paid */
  paidAt?: string;
  /** Optional link to a billing document (e.g. copied invoice #) */
  linkedBillingDocumentId?: string;
  /** Subcontractor workspace submission that created this payable */
  linkedSubcontractorInvoiceId?: string;
  /** Original filename for the attached supplier invoice PDF/image */
  attachmentFilename?: string;
  /** Path under `.data/` for the stored file (server-only) */
  attachmentRelativePath?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdByEmail: string;
};
