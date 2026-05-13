// Cosmetic expansion for staff roles. The DB stores the short label
// ("CEO"); UI components call expandRole() to get a display string with
// the full meaning appended. Add new mappings here when a role's
// acronym deserves the spelled-out version next to it.

const EXPANSIONS: Record<string, string> = {
  CEO: "Chief Executive Officer",
  CTO: "Chief Technology Officer",
  COO: "Chief Operating Officer",
  CFO: "Chief Financial Officer",
  CMO: "Chief Marketing Officer",
};

export function expandRole(role: string | null | undefined): {
  /** Original short label as stored in the DB. */
  primary: string;
  /** Spelled-out form, or null when no mapping exists. */
  expansion: string | null;
  /** Combined "CEO — Chief Executive Officer". */
  display: string;
} {
  const primary = (role ?? "").trim();
  const expansion = EXPANSIONS[primary.toUpperCase()] ?? null;
  return {
    primary,
    expansion,
    display: expansion ? `${primary} — ${expansion}` : primary,
  };
}
