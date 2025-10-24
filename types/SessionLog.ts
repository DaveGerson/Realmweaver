// types/SessionLog.ts
export interface SessionLog {
  id: string;
  title: string;
  sessionDate: string; // ISO string format for dates.
  recap: string; // What happened during the session.
  notableEvents: string; // Bullet points of key moments.
  looseEnds: string; // Plot hooks or unresolved threads from the session.
}
