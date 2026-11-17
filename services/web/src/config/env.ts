import "server-only";

// Runtime settings of the web server. Konfidence-specific settings
// (VECTOR_CONFIG_URL, KONFIDENCE_*) are read by @konfidence/next-adapter.
export const env = {
  /** IANA time zone the schedule is shown and entered in. */
  timeZone: process.env.APP_TIME_ZONE || "UTC",
};
