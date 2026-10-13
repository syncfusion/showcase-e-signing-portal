// Domain types (contracts/data-contract.md). No React or Syncfusion imports in this folder.

export interface Profile {
  id: string;
  fullName: string;
  firstName: string;
  email: string;
  role: string;
  company: string;
}

/** Field position in PDF points from the page's top-left corner (capitalised, as the PDF Viewer expects). */
export interface FieldBounds { X: number; Y: number; Width: number; Height: number }

export interface FieldDefinition {
  name: string;
  label: string;
  type: 'signature' | 'text';
  /** 1-based page number. */
  page: number;
  bounds: FieldBounds;
  required: boolean;
}

export interface SigningDocument {
  id: string;
  title: string;
  sender: { name: string; organisation: string };
  receivedDaysAgo: number;
  dueInDays: number | null;
  pageCount: number;
  file: string;
  baselineStatus: 'ready' | 'completed';
  signedDaysAgo: number | null;
  fields: FieldDefinition[];
}

export interface Catalogue {
  schemaVersion: 1;
  fixtureVersion: number;
  profile: Profile;
  documents: SigningDocument[];
}

/** One signed document held for this tab only. */
export interface SessionEntry { signedAt: string; signedUrl: string; fileName: string }
export type SigningSession = Readonly<Record<string, SessionEntry>>;

/** Current values of a document's fields, by field name. Empty or missing means not filled. */
export type FieldValues = Readonly<Record<string, string | undefined>>;

export type DocumentStatus = 'ready' | 'completed';
export type Badge = 'ready' | 'due-soon' | 'completed';
