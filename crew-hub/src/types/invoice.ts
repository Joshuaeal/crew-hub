export type InvoiceRecord = {
  id: string;
  submittedAt: string;
  subcontractorEmail: string;
  reference: string;
  /** Legacy rows; new submissions use amountAudIncGst (AUD inc GST only). */
  amount?: string;
  currency?: string;
  /** AUD including GST — canonical for new submissions */
  amountAudIncGst?: number;
  /** ISO date (YYYY-MM-DD) — payment due */
  dueDate?: string;
  notes?: string;
  attachmentFilename?: string;
  /** Path relative to `.data/` */
  attachmentRelativePath?: string;
  /** Payables row created on submit */
  payableId?: string;
};
