/** HR employee self-service profile (stored in .data, not in cloud). */

export type EmergencyContact = {
  name: string;
  relationship: string;
  phone: string;
};

export type HrDocumentMeta = {
  id: string;
  /** Original filename from upload (for display). */
  originalName: string;
  /** Path relative to the HR documents root: `{userId}/{storedFileName}` */
  storedRelative: string;
  uploadedAt: string;
  mimeType: string;
  sizeBytes: number;
};

export type HrQualificationDoc = HrDocumentMeta & {
  /** e.g. First Aid, Working at Heights */
  label: string;
};

export type HrEmployeeProfile = {
  legalName: string;
  dateOfBirth: string;
  abn: string;
  phone: string;
  addressLine1: string;
  addressSuburb: string;
  addressState: string;
  addressPostcode: string;
  emergencyContacts: EmergencyContact[];
  wwcc: HrDocumentMeta | null;
  policeCheck: HrDocumentMeta | null;
  qualifications: HrQualificationDoc[];
  updatedAt: string;
};

export function emptyHrProfile(): HrEmployeeProfile {
  const t = new Date().toISOString();
  return {
    legalName: "",
    dateOfBirth: "",
    abn: "",
    phone: "",
    addressLine1: "",
    addressSuburb: "",
    addressState: "",
    addressPostcode: "",
    emergencyContacts: [
      { name: "", relationship: "", phone: "" },
      { name: "", relationship: "", phone: "" },
    ],
    wwcc: null,
    policeCheck: null,
    qualifications: [],
    updatedAt: t,
  };
}
