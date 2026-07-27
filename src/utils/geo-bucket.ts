/** ~1.1 km cells at equator when using 2 decimal places. */
export const GEO_BUCKET_DECIMALS = 2;

const GEO_BUCKET_SCALE = 10 ** GEO_BUCKET_DECIMALS;

/**
 * Floor lat/lng into a stable privacy grid (not string toFixed rounding).
 * Same nearby users land in the same cell; unsuitable for precise navigation.
 */
export function bucketCoord(value: number, scale = GEO_BUCKET_SCALE): number {
  return Math.floor(value * scale) / scale;
}

export function bucketLatLng(
  latitude: number,
  longitude: number,
): { latitude: number; longitude: number } {
  return {
    latitude: bucketCoord(latitude),
    longitude: bucketCoord(longitude),
  };
}
