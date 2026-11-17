import type { InterviewType } from "@/types/api";

export const INTERVIEW_TYPES: InterviewType[] = ["onsite", "phone", "video"];

export const isInterviewType = (value: unknown): value is InterviewType =>
  typeof value === "string" && (INTERVIEW_TYPES as string[]).includes(value);

export const TYPE_LABEL: Record<InterviewType, string> = {
  onsite: "Onsite",
  phone: "Phone",
  video: "Video",
};

/** Short explanation of a type, for the type picker. */
export const TYPE_HINT: Record<InterviewType, string> = {
  onsite: "In the office",
  phone: "We call them",
  video: "Link in the invite",
};

/** What to show where an interview has no location of its own. */
export const TYPE_PLACE: Record<InterviewType, string> = {
  onsite: "In the office",
  phone: "We call the candidate",
  video: "Link sent with the invite",
};

/** The types the current stage offers. */
export const offeredTypes = (videoSlots: boolean): InterviewType[] =>
  INTERVIEW_TYPES.filter((type) => type !== "video" || videoSlots);
