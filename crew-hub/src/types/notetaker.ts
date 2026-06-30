export type MeetingNote = {
  id: string;
  title: string;
  transcript: string;
  structured_content: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  logseq_saved: boolean;
  logseq_path: string | null;
};

export type MeetingNoteAccess = {
  id: string;
  meeting_note_id: string;
  user_id: string;
  granted_by: string;
  granted_at: string;
};
