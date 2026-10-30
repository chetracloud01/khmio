/** A bill's day as it was written on it (a date column: no time, no zone): "YYYY-MM-DD". */
export const dayOf = (day: Date) => day.toISOString().slice(0, 10);

/** A "YYYY-MM-DD" day as the date column takes it. */
export const dateOf = (day: string) => new Date(`${day}T00:00:00Z`);
