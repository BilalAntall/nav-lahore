import { useEffect, useMemo, useState } from 'react'
import { divIcon } from 'leaflet'
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { transportLines } from '../data/transportLines.js'

const lahoreCenter = [31.5204, 74.3587]
const userLocationIcon = divIcon({
  className: 'user-location-marker',
  html: '<span class="user-location-marker__pulse"></span><span class="user-location-marker__dot"></span>',
  iconAnchor: [16, 16],
  iconSize: [32, 32],
})

export default function MapComponent({
  selectedLineId = 'all',
  currentLocation,
  accessStation,
  destinationStation,
  suggestion,
}) {
  const visibleLines = useMemo(() => {
    if (selectedLineId === 'all') return transportLines
    const selected = transportLines.filter((line) => line.line_id === selectedLineId)
    if (!suggestion) return selected

    const suggestedLineVisible = selected.some((line) => line.line_id === suggestion.line.line_id)
    return suggestedLineVisible ? selected : [...selected, suggestion.line]
  }, [selectedLineId, suggestion])

  const visibleStations = useMemo(() => visibleLines.flatMap((line) => line.stations), [visibleLines])
  const focusTarget = destinationStation ?? accessStation ?? currentLocation
  const selectedLine = useMemo(
    () => transportLines.find((line) => line.line_id === selectedLineId),
    [selectedLineId],
  )
  const selectedTripPositions = useMemo(
    () => getStationSegmentPositions(selectedLine, accessStation, destinationStation),
    [accessStation, destinationStation, selectedLine],
  )

  return (
    <div className="relative overflow-hidden rounded-lg">
      <MapContainer center={lahoreCenter} zoom={12} scrollWheelZoom className="z-0">
        <MapFocus target={focusTarget} />
        <TileLayer
          attribution='Tiles &copy; Esri'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
        />

        {visibleLines.map((line) => (
          <Polyline
            key={line.line_id}
            positions={line.stations.map((station) => [station.lat, station.lng])}
            pathOptions={{ color: line.color, weight: line.line_id === selectedLineId ? 5 : 3, opacity: 0.72 }}
          />
        ))}

        {visibleStations.map((station) => (
          <CircleMarker
            center={[station.lat, station.lng]}
            key={station.uid}
            pathOptions={{
              color: station.uid === destinationStation?.uid ? '#ffffff' : station.lineColor,
              fillColor: station.uid === destinationStation?.uid ? '#dc2626' : station.lineColor,
              fillOpacity: station.uid === destinationStation?.uid ? 0.96 : station.is_interchange ? 0.94 : 0.68,
              weight: station.uid === accessStation?.uid || station.uid === destinationStation?.uid ? 4 : 2,
            }}
            radius={station.uid === destinationStation?.uid ? 11 : station.uid === accessStation?.uid ? 9 : station.is_interchange ? 7 : 5}
          >
            <Popup>
              <strong>{station.name}</strong>
              <br />
              {station.lineName}
              <br />
              {station.type} {station.is_interchange ? 'interchange' : 'station'}
            </Popup>
            <Tooltip
              direction="top"
              offset={[0, -8]}
              opacity={0.95}
              permanent={station.uid === accessStation?.uid || station.uid === destinationStation?.uid}
            >
              {station.uid === accessStation?.uid ? 'Nearest: ' : ''}
              {station.uid === destinationStation?.uid ? 'Destination: ' : ''}
              {station.name}
            </Tooltip>
          </CircleMarker>
        ))}

        {currentLocation ? (
          <Marker
            icon={userLocationIcon}
            position={[currentLocation.lat, currentLocation.lng]}
            zIndexOffset={1000}
          >
            <Popup>{currentLocation.label ?? 'Current location'}</Popup>
            <Tooltip className="map-key-tooltip" direction="top" offset={[0, -18]} permanent>
              You are here
            </Tooltip>
          </Marker>
        ) : null}

        {currentLocation && accessStation ? (
          <RoutingPolyline
            waypoints={[
              [currentLocation.lat, currentLocation.lng],
              [accessStation.lat, accessStation.lng],
            ]}
            pathOptions={{ color: '#38bdf8', dashArray: '8 8', weight: 4, opacity: 0.9 }}
          />
        ) : null}

        {selectedTripPositions.length > 1 ? (
          <Polyline
            positions={selectedTripPositions}
            pathOptions={{ color: '#f97316', weight: 5, opacity: 0.82 }}
          />
        ) : null}
      </MapContainer>

      <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-lg border border-white/70 bg-white/92 px-3 py-2 text-xs font-semibold text-slate-600 shadow-md backdrop-blur">
        Orange follows the selected line. Blue guides you to the nearest station.
      </div>
    </div>
  )
}

function getStationSegmentPositions(line, fromStation, toStation) {
  if (!line || !fromStation || !toStation) return []

  const fromIndex = line.stations.findIndex((station) => station.uid === fromStation.uid)
  const toIndex = line.stations.findIndex((station) => station.uid === toStation.uid)
  if (fromIndex === -1 || toIndex === -1) return []

  const [start, end] = fromIndex < toIndex ? [fromIndex, toIndex] : [toIndex, fromIndex]
  const segment = line.stations.slice(start, end + 1).map((station) => [station.lat, station.lng])
  return fromIndex <= toIndex ? segment : segment.reverse()
}

function MapFocus({ target }) {
  const map = useMap()

  useEffect(() => {
    if (!target?.lat || !target?.lng) return
    map.flyTo([target.lat, target.lng], 13, { duration: 0.8 })
  }, [map, target])

  return null
}

function RoutingPolyline({ waypoints, pathOptions }) {
  const routeKey = coordinatesToKey(waypoints)
  const fallbackCoordinates = keyToCoordinates(routeKey)
  const [route, setRoute] = useState({
    coordinates: fallbackCoordinates,
    key: routeKey,
  })

  useEffect(() => {
    let active = true
    const nextWaypoints = keyToCoordinates(routeKey)
    if (nextWaypoints.length < 2) return

    const limitedWaypoints = nextWaypoints.slice(0, 100)
    const coordsStr = limitedWaypoints.map((wp) => `${wp[1]},${wp[0]}`).join(';')
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (!active) return
        if (data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates) {
          const latLngs = data.routes[0].geometry.coordinates.map((c) => [c[1], c[0]])
          setRoute({ coordinates: latLngs, key: routeKey })
        }
      })
      .catch((err) => console.error('OSRM routing failed, falling back to straight lines:', err))

    return () => {
      active = false
    }
  }, [routeKey])

  return <Polyline positions={route.key === routeKey ? route.coordinates : fallbackCoordinates} pathOptions={pathOptions} />
}

function coordinatesToKey(coordinates) {
  return coordinates?.map(([lat, lng]) => `${lat},${lng}`).join('|') ?? ''
}

function keyToCoordinates(key) {
  if (!key) return []

  return key.split('|').map((pair) => pair.split(',').map(Number))
}
