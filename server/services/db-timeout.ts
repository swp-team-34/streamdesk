export async function withDbTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs = 3000,
  defaultValue: T,
): Promise<T> {
  const startTime = Date.now();
  let timeoutId: NodeJS.Timeout | null = null;

  try {
    const safeTimeout = Math.max(1, Math.floor(timeoutMs));
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("Database operation timeout")), safeTimeout);
    });
    const result = await Promise.race([operation(), timeoutPromise]);
    if (timeoutId) clearTimeout(timeoutId);

    const duration = Math.max(0, Date.now() - startTime);
    if (duration > 1000) console.warn(`[DB] Slow query: ${duration}ms`);
    return result;
  } catch (error: any) {
    if (timeoutId) clearTimeout(timeoutId);
    const errorMessage = error?.message?.toLowerCase() || "";
    if (
      errorMessage.includes("timeout") ||
      errorMessage.includes("econnrefused") ||
      errorMessage.includes("connect")
    ) {
      return defaultValue;
    }
    return defaultValue;
  }
}
