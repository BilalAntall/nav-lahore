export function distanceInKm(origin, destination) {
  const earthRadiusKm = 6371
  const dLat = toRadians(destination.lat - origin.lat)
  const dLng = toRadians(destination.lng - origin.lng)
  const originLat = toRadians(origin.lat)
  const destinationLat = toRadians(destination.lat)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(originLat) * Math.cos(destinationLat) * Math.sin(dLng / 2) * Math.sin(dLng / 2)

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function findNearestStation(origin, stations) {
  return stations.reduce(
    (nearest, station) => {
      const distance = distanceInKm(origin, station)
      return distance < nearest.distance ? { station, distance } : nearest
    },
    { station: null, distance: Number.POSITIVE_INFINITY },
  )
}

function toRadians(value) {
  return (value * Math.PI) / 180
}
