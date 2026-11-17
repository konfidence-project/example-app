export const DEVTOOLS_SCHEMA: "cloud.konfidence.devtools/v1";

/** Devtools data endpoint. Answers 404 unless KONFIDENCE_DEVTOOLS is 1 or true. */
export function GET(request: Request): Promise<Response>;
