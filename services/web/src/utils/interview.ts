import { INTERVIEW_TYPES, type InterviewType } from "@/types/api";

export { INTERVIEW_TYPES };

export const isInterviewType = (value: unknown): value is InterviewType =>
  typeof value === "string" && (INTERVIEW_TYPES as readonly string[]).includes(value);

export const TYPE_LABEL: Record<InterviewType, string> = {
  onsite: "Onsite",
  phone: "Phone",
  video: "Video",
};

/** Short explanation of a type, for the type picker. */
export const TYPE_HINT: Record<InterviewType, string> = {
  onsite: "In the office",
  phone: "We call them",
  video: "Video call",
};

/** What to show where an interview has no location of its own. */
export const TYPE_PLACE: Record<InterviewType, string> = {
  onsite: "In the office",
  phone: "We call the candidate",
  video: "Video call",
};

/** The types the current stage offers. */
export const offeredTypes = (videoSlots: boolean): InterviewType[] =>
  INTERVIEW_TYPES.filter((type) => type !== "video" || videoSlots);
