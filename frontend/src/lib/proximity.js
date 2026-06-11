export const STATION_XP_RADIUS_KM = 0.05
export const GPS_ACCURACY_BUFFER_KM = 0.025

export function isWithinStationXpRange(distanceKm, accuracyMeters = 0) {
  const accuracyKm = Math.max(0, accuracyMeters) / 1000
  const allowedDistanceKm = STATION_XP_RADIUS_KM + Math.min(accuracyKm, GPS_ACCURACY_BUFFER_KM)

  return distanceKm <= allowedDistanceKm
}

export function stationXpRangeText() {
  return '50 m'
}
