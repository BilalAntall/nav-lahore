import { useEffect, useMemo, useState } from 'react'
import { BadgeCheck, Crosshair, Leaf, LocateFixed, MapPinned, Navigation, Route, Save, Timer, TrainFront, Wallet } from 'lucide-react'
import MapComponent from '../components/MapComponent.jsx'
import { transportLines } from '../data/transportLines.js'
import { distanceInKm } from '../lib/geo.js'
import { estimateImpact, formatKg, formatPkr } from '../lib/impact.js'
import {
  buildAccessSuggestion,
  estimateTrip,
  formatEta,
  formatKm,
  getStation,
  getStationsForLine,
  initialEtaSeconds,
  nearestStationForLine,
} from '../lib/planner.js'
import { isWithinStationXpRange, stationXpRangeText } from '../lib/proximity.js'

export default function DashboardPage({ addSavedRoute, checkInAtStation, plannerState, setPlannerState, stats, statsStatus }) {
  const { currentLocation, destinationUid, etaSeconds, locationStatus, selectedLineId } = plannerState
  const [checkInStatus, setCheckInStatus] = useState('')

  const selectedLine = useMemo(
    () => transportLines.find((line) => line.line_id === selectedLineId) ?? transportLines[0],
    [selectedLineId],
  )
  const lineStations = selectedLine.stations
  const destinationStation = getStation(destinationUid)
  const access = useMemo(
    () => nearestStationForLine(currentLocation, selectedLineId),
    [currentLocation, selectedLineId],
  )
  const accessStation = access.station
  const suggestion = useMemo(
    () =>
      buildAccessSuggestion({
        currentLocation,
        selectedLineId,
        selectedStation: accessStation,
      }),
    [accessStation, currentLocation, selectedLineId],
  )
  const trip = useMemo(
    () => estimateTrip({ fromStation: accessStation, destinationStation }),
    [accessStation, destinationStation],
  )
  const impact = useMemo(() => estimateImpact(trip.distanceKm), [trip.distanceKm])

  useEffect(() => {
    if (!accessStation) {
      return undefined
    }

    const resetTimer = window.setTimeout(() => {
      setPlannerState((current) => ({ ...current, etaSeconds: initialEtaSeconds(accessStation.uid) }))
    }, 0)
    const interval = window.setInterval(() => {
      setPlannerState((current) => {
        if (current.etaSeconds === null) return current
        return {
          ...current,
          etaSeconds:
            current.etaSeconds <= 0 ? initialEtaSeconds(accessStation.uid) : current.etaSeconds - 1,
        }
      })
    }, 1000)

    return () => {
      window.clearTimeout(resetTimer)
      window.clearInterval(interval)
    }
  }, [accessStation, setPlannerState])

  function handleLineChange(lineId) {
    const nextDestination = getStationsForLine(lineId).at(-1)
    setPlannerState((current) => ({
      ...current,
      selectedLineId: lineId,
      destinationUid: nextDestination.uid,
      etaSeconds: null,
    }))
  }

  function handleBrowserLocation() {
    if (!navigator.geolocation) {
      setPlannerState((current) => ({ ...current, locationStatus: 'Geolocation is not available in this browser.' }))
      return
    }

    setPlannerState((current) => ({ ...current, locationStatus: 'Getting your current location...' }))
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPlannerState((current) => ({
          ...current,
          currentLocation: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            label: 'Current location',
          },
          locationStatus: 'Location found! This will stay while you move around the app.',
        }))
      },
      () =>
        setPlannerState((current) => ({
          ...current,
          locationStatus: 'Location permission denied. Please allow location access.',
        })),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }


  function handleSaveRoute() {
    if (!accessStation || !destinationStation) return

    const route = {
      id: `${Date.now()}`,
      lineId: selectedLineId,
      lineName: selectedLine.line_name,
      color: selectedLine.color,
      from: accessStation.name,
      to: destinationStation.name,
      stops: trip.stops,
      distanceKm: trip.distanceKm,
      minutes: trip.minutes,
      createdAt: new Date().toISOString(),
    }

    addSavedRoute(route)
  }

  function handleStationCheckIn() {
    if (!accessStation) {
      setCheckInStatus('Set your current location first so NavLahore can select a station.')
      return
    }

    if (!navigator.geolocation) {
      setCheckInStatus('GPS is not available in this browser.')
      return
    }

    setCheckInStatus('Checking your GPS distance from the station...')
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const gpsLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }
        const stationDistance = distanceInKm(gpsLocation, accessStation)

        if (!isWithinStationXpRange(stationDistance, position.coords.accuracy)) {
          setCheckInStatus(`You are ${formatKm(stationDistance)} from ${accessStation.name}. XP unlocks within ${stationXpRangeText()} of the nearest station.`)
          return
        }

        const result = await checkInAtStation({ station: accessStation, impact })
        setCheckInStatus(
          result.awarded
            ? `Checked in at ${accessStation.name}. +${result.xp} XP awarded.`
            : `You already checked in at ${accessStation.name} today.`,
        )
      },
      () => setCheckInStatus('GPS permission was denied, so XP was not awarded.'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  return (
    <div className="page-stack">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Main dashboard</p>
          <h1 className="page-title">Plan the first mile, the ride, and the transfer.</h1>
          <p className="page-subtitle">
            Set your current point, pick a transport mode, choose a destination, and NavLahore will find your access station with a live arrival countdown.
          </p>
        </div>
        <div className="eta-card">
          <Timer size={22} />
          <span>Next arrival</span>
          <strong>{etaSeconds === null ? 'Select location' : formatEta(etaSeconds)}</strong>
        </div>
      </section>

      <section className="planner-grid">
        <div className="control-panel">
          <PanelHeading icon={Crosshair} title="Current location" />
          <div className="control-actions">
            <button className="primary-action" onClick={handleBrowserLocation} type="button">
              <LocateFixed size={18} />
              Get my location
            </button>
          </div>
          <p className="helper-text">{locationStatus}</p>

          <PanelHeading icon={TrainFront} title="Transport mode" />
          <div className="mode-grid">
            {transportLines.map((line) => (
              <button
                className={line.line_id === selectedLineId ? 'mode-card mode-card-active' : 'mode-card'}
                key={line.line_id}
                onClick={() => handleLineChange(line.line_id)}
                type="button"
              >
                <span style={{ backgroundColor: line.color }} />
                {line.shortName}
              </button>
            ))}
          </div>

          <PanelHeading icon={Navigation} title="Destination" />
          <select
            value={destinationUid}
            onChange={(event) =>
              setPlannerState((current) => ({ ...current, destinationUid: event.target.value }))
            }
          >
            {lineStations.map((station) => (
              <option key={station.uid} value={station.uid}>
                {station.name}
              </option>
            ))}
          </select>

          <div className="route-summary-card">
            <div>
              <span className="summary-label">Selected access station</span>
              <strong>{accessStation?.name ?? 'Waiting for location'}</strong>
              <p>{accessStation ? `${formatKm(access.distance)} from your current point by ${selectedLine.shortName}.` : 'Set a current location to auto-select the nearest station.'}</p>
            </div>
            <button className="secondary-action" onClick={handleSaveRoute} disabled={!accessStation} type="button">
              <Save size={17} />
              Save route
            </button>
            <button className="secondary-action" onClick={handleStationCheckIn} disabled={!accessStation} type="button">
              <BadgeCheck size={17} />
              Check in for XP
            </button>
            {checkInStatus ? <p className="helper-text">{checkInStatus}</p> : null}
          </div>
        </div>

        <div className="map-panel">
          <MapComponent
            accessStation={accessStation}
            currentLocation={currentLocation}
            destinationStation={destinationStation}
            selectedLineId={selectedLineId}
            suggestion={suggestion}
          />
        </div>
      </section>

      <section className="insight-grid">
        <InsightCard
          icon={MapPinned}
          label="Access distance"
          value={accessStation ? formatKm(access.distance) : 'Set location'}
          detail={accessStation ? `Nearest ${selectedLine.shortName} station: ${accessStation.name}` : 'Use the controls above to start.'}
        />
        <InsightCard
          icon={Route}
          label="Trip estimate"
          value={accessStation ? `${trip.minutes} min` : 'Pending'}
          detail={accessStation ? `${trip.stops} stops and ${formatKm(trip.distanceKm)} from ${accessStation.name} to ${destinationStation.name}.` : 'Pick a destination after setting location.'}
        />
        <InsightCard
          icon={Timer}
          label="Station clock"
          value={etaSeconds === null ? '6-8 min' : formatEta(etaSeconds)}
          detail={accessStation ? `Countdown started for ${accessStation.name}.` : 'Clock starts once the nearest station is selected.'}
        />
      </section>

      <section className="impact-panel">
        <div>
          <p className="eyebrow">My impact</p>
          <h2>Public transport savings for this trip</h2>
          <p>
            Based on the selected route distance versus a conservative ride-hailing estimate. These are practical estimates, not lab-grade emissions data.
          </p>
        </div>
        <div className="impact-grid">
          <ImpactMetric icon={Leaf} label="CO2 saved this route" value={formatKg(impact.co2SavedKg)} />
          <ImpactMetric icon={Wallet} label="Money saved this route" value={formatPkr(impact.moneySavedPkr)} />
          <ImpactMetric icon={BadgeCheck} label="Lifetime XP" value={`${stats.xp} XP`} />
          <ImpactMetric icon={Leaf} label="Lifetime CO2 saved" value={formatKg(stats.co2SavedKg)} />
          <ImpactMetric icon={Wallet} label="Lifetime money saved" value={formatPkr(stats.moneySavedPkr)} />
          <ImpactMetric icon={TrainFront} label="Verified check-ins" value={`${stats.checkIns}`} />
        </div>
        <p className="helper-text">Impact totals update when you GPS check in at a station. Status: {statsStatus === 'synced' ? 'saved across devices' : 'syncing'}.</p>
      </section>

      <section className="station-clock-panel">
        <div>
          <p className="eyebrow">Station clocks</p>
          <h2>{selectedLine.shortName} line arrival board</h2>
        </div>
        <div className="station-clock-grid">
          {lineStations.map((station) => {
            const isActiveStation = station.uid === accessStation?.uid && etaSeconds !== null
            return (
              <article className={isActiveStation ? 'station-clock-card station-clock-active' : 'station-clock-card'} key={station.uid}>
                <span>{station.name}</span>
                <strong>{isActiveStation ? formatEta(etaSeconds) : formatEta(initialEtaSeconds(station.uid))}</strong>
                <p>{isActiveStation ? 'Active countdown' : '6-8 min ready'}</p>
              </article>
            )
          })}
        </div>
      </section>

      {suggestion ? (
        <section className="suggestion-band">
          <div>
            <p className="eyebrow">Smarter access suggestion</p>
            <h2>Use {suggestion.line.shortName} first to get closer to {accessStation.name}.</h2>
            <p>
              Board at {suggestion.boardingStation.name}, ride toward {suggestion.exitStation.name}, then continue about {formatKm(suggestion.finalHopKm)} to reach the selected {selectedLine.shortName} station. This can save roughly {formatKm(suggestion.savingsKm)} versus going directly.
            </p>
          </div>
        </section>
      ) : (
        <section className="suggestion-band suggestion-band-muted">
          <div>
            <p className="eyebrow">Access check</p>
            <h2>No better feeder mode found right now.</h2>
            <p>
              The selected mode's nearest station is already competitive from your current point, or the current distance is short enough to keep the route simple.
            </p>
          </div>
        </section>
      )}
    </div>
  )
}

function PanelHeading({ icon: Icon, title }) {
  return (
    <div className="panel-heading">
      <Icon size={18} />
      <h2>{title}</h2>
    </div>
  )
}

function InsightCard({ icon: Icon, label, value, detail }) {
  return (
    <article className="insight-card">
      <Icon size={20} />
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  )
}

function ImpactMetric({ icon: Icon, label, value }) {
  return (
    <article className="impact-metric">
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}
