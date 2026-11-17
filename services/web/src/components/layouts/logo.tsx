// The KONFIDENCE wordmark. The O is drawn, the other letters are text.
export function Logo() {
  return (
    <span
      aria-label="Konfidence"
      role="img"
      style={{
        display: "inline-flex",
        alignItems: "center",
        letterSpacing: "0.16em",
        fontSize: 19,
        fontWeight: 400,
      }}
    >
      <span aria-hidden="true">K</span>
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        aria-hidden="true"
        style={{ margin: "0 0.16em 0 0.02em" }}
      >
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.2" />
        <path d="M2.5 12h19" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <span aria-hidden="true">NFIDENCE</span>
    </span>
  );
}
