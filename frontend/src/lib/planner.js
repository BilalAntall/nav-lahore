import { allStations, transportLines } from '../data/transportLines.js'
import { distanceInKm, findNearestStation } from './geo.js'

export function getLine(lineId) {
  return transportLines.find((line) => line.line_id === lineId) ?? transportLines[0]
}

export function getStation(uid) {
  return allStations.find((station) => station.uid === uid) ?? allStations[0]
}

export function getStationsForLine(lineId) {
  return getLine(lineId).stations
}

export function nearestStationForLine(location, lineId) {
  if (!location) return { station: null, distance: Number.POSITIVE_INFINITY }
  return findNearestStation(location, getStationsForLine(lineId))
}

export function buildAccessSuggestion({ currentLocation, selectedLineId, selectedStation }) {
  if (!currentLocation || !selectedStation) return null

  const directDistance = distanceInKm(currentLocation, selectedStation)
  const candidates = transportLines
    .filter((line) => line.line_id !== selectedLineId)
    .map((line) => {
      const boarding = findNearestStation(currentLocation, line.stations)
      const exit = findNearestStation(selectedStation, line.stations)
      const finalHopKm = exit.station ? distanceInKm(exit.station, selectedStation) : Number.POSITIVE_INFINITY
      const accessKm = boarding.distance + finalHopKm

      return {
        line,
        boardingStation: boarding.station,
        exitStation: exit.station,
        accessKm,
        directDistance,
        finalHopKm,
        savingsKm: directDistance - accessKm,
      }
    })
    .filter((candidate) => candidate.boardingStation && candidate.exitStation)
    .sort((a, b) => b.savingsKm - a.savingsKm)

  const best = candidates[0]
  if (!best || directDistance < 1.2 || best.savingsKm < 0.35) return null
  return best
}

export function estimateTrip({ fromStation, destinationStation }) {
  if (!fromStation || !destinationStation) {
    return { stops: 0, distanceKm: 0, minutes: 0 }
  }

  const stops = Math.abs(destinationStation.id - fromStation.id)
  const distanceKm = distanceInKm(fromStation, destinationStation)
  const minutes = Math.max(4, stops * 3 + Math.round(distanceKm * 1.5))

  return { stops, distanceKm, minutes }
}

export function initialEtaSeconds(stationUid) {
  const hash = [...stationUid].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return 360 + (hash % 121)
}

export function formatEta(seconds) {
  const safeSeconds = Math.max(0, seconds)
  const minutes = Math.floor(safeSeconds / 60)
  const remainder = safeSeconds % 60
  return `${minutes}:${String(remainder).padStart(2, '0')}`
}

export function formatKm(value) {
  if (!Number.isFinite(value)) return 'N/A'
  if (value < 1) return `${Math.round(value * 1000)} m`
  return `${value.toFixed(2)} km`
}
