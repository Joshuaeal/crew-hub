export type CrewCalendarEvent = {
  id: string;
  title: string;
  description?: string;
  location?: string;
  /** ISO 8601 start instant */
  startAt: string;
  /** ISO 8601 end instant */
  endAt: string;
  /** When true, iCal uses DATE values (whole days). */
  allDay: boolean;
  createdAt: string;
  updatedAt: string;
  createdByEmail: string;
};
