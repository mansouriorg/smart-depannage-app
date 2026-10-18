/**
 * Going to the job, by its coordinates (P1-15).
 *
 * A street name sends a map to the wrong "Rue de la Liberté" of another town; the point the customer
 * placed does not. The app opens the artisan's map application on that point. A job without a usable
 * point has no navigation, and the app says so instead of guessing from the address text.
 */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

function validNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * The point of a job, or null when it has none that can be used: missing, not numbers, outside the globe,
 * or exactly 0,0 (the "nothing was filled in" point in the Gulf of Guinea, never a job in Tunisia).
 */
export function coordinatesOf(job: { latitude?: unknown; longitude?: unknown } | null | undefined): Coordinates | null {
  if (!job) return null;

  const { latitude, longitude } = job;

  if (!validNumber(latitude) || !validNumber(longitude)) return null;

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  if (latitude === 0 && longitude === 0) return null;

  return { latitude, longitude };
}

export interface NavigationLinks {
  /** Opens in the browser or in the Google Maps application, on every phone. */
  google: string;
  /** Apple Maps (iPhone). */
  apple: string;
  /** The Android "geo:" address: the map application the person chose. */
  geo: string;
}

const six = (value: number) => value.toFixed(6);

/** The addresses that open a map, driving to the point. `label` is the name the point carries on the map. */
export function navigationLinks(point: Coordinates, label?: string): NavigationLinks {
  const here = `${six(point.latitude)},${six(point.longitude)}`;
  const name = label?.trim() ? `(${encodeURIComponent(label.trim())})` : '';

  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${here}&travelmode=driving`,
    apple: `http://maps.apple.com/?daddr=${here}&dirflg=d`,
    geo: `geo:${here}?q=${here}${name}`,
  };
}
