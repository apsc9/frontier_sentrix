const KNOWN_PROGRAMS: Record<string, string> = {
  "11111111111111111111111111111111": "System Program",
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA": "Token Program",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb": "Token 2022",
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL": "Associated Token",
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4": "Jupiter v6",
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc": "Orca Whirlpool",
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8": "Raydium AMM",
  "MERLuDFBMmsHnsBPZw2sDQZHvXFMwp8EdjudcU2HKky": "Marinade",
  "ComputeBudget111111111111111111111111111111": "Compute Budget",
  "SysvarRent111111111111111111111111111111111": "Rent Sysvar",
};

export interface ProgramCheckResult {
  isAnomaly: boolean;
  unknownPrograms: string[];
  allPrograms: { id: string; name: string | null }[];
}

export function checkPrograms(
  programIds: string[],
  allowedPrograms: string[]
): ProgramCheckResult {
  const allPrograms = programIds.map((id) => ({
    id,
    name: KNOWN_PROGRAMS[id] ?? null,
  }));

  const effectiveAllowlist =
    allowedPrograms.length > 0
      ? allowedPrograms
      : Object.keys(KNOWN_PROGRAMS);

  const unknownPrograms = programIds.filter(
    (id) => !effectiveAllowlist.includes(id) && !KNOWN_PROGRAMS[id]
  );

  return {
    isAnomaly: unknownPrograms.length > 0,
    unknownPrograms,
    allPrograms,
  };
}

export function getProgramName(programId: string): string {
  return KNOWN_PROGRAMS[programId] ?? "Unknown";
}
