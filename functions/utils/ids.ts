// functions/utils/ids.ts

export function newContentId(): number {
  // 53-bit safe positive integer
  const hi = Math.floor(Math.random() * 0x200000);       // 21 bits
  const lo = Math.floor(Math.random() * 0x100000000);    // 32 bits
  return hi * 0x100000000 + lo;
}

export async function withNewContentId<T>(
  run: (id: number) => Promise<T>,
  maxAttempts = 5,
): Promise<{ id: number; result: T }> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const id = newContentId();
    try {
      const result = await run(id);
      return { id, result };
    } catch (e: any) {
      const msg = String(e?.message || "");
      const isConflict =
        msg.includes("UNIQUE constraint failed") ||
        msg.includes("PRIMARY KEY") ||
        msg.includes("constraint failed");
      if (!isConflict) throw e;
    }
  }
  throw new Error("Failed to allocate unique content id after max attempts");
}
