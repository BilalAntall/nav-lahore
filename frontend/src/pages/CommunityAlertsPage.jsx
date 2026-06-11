import { useState } from 'react'
import { BadgeCheck, MessageSquareWarning, Send, ThumbsDown, ThumbsUp } from 'lucide-react'
import { allStations } from '../data/transportLines.js'
import { distanceInKm } from '../lib/geo.js'
import { formatKm } from '../lib/planner.js'
import { isWithinStationXpRange, stationXpRangeText } from '../lib/proximity.js'

export default function CommunityAlertsPage({
  addAlert,
  alerts,
  awardVerifiedAlertXp,
  deleteAlert,
  syncStatus,
  user,
  voteAlert,
}) {
  const [stationUid, setStationUid] = useState(allStations[0].uid)
  const [type, setType] = useState('Crowding')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    if (!message.trim()) return

    const station = allStations.find((item) => item.uid === stationUid)
    const verification = await verifyReporterAtStation(station)

    await addAlert({
      station: station.name,
      stationUid: station.uid,
      lineName: station.lineName,
      type,
      message: message.trim(),
      userId: user?.uid ?? null,
      userName: user?.displayName || user?.email?.split('@')[0] || 'Rider',
      verified: verification.verified,
    })

    if (verification.verified) {
      const reward = await awardVerifiedAlertXp(station.uid)
      setStatus(reward.awarded ? `Alert posted and verified. +${reward.xp} XP awarded.` : 'Alert posted and verified.')
    } else {
      setStatus(`Alert posted without XP. ${verification.reason}`)
    }

    setMessage('')
  }

  async function verifyReporterAtStation(station) {
    if (!navigator.geolocation) {
      return { verified: false, reason: 'GPS is not available in this browser.' }
    }

    setStatus('Checking your GPS location for alert XP...')

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const reporterLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          }
          const distance = distanceInKm(reporterLocation, station)

          if (isWithinStationXpRange(distance, position.coords.accuracy)) {
            resolve({ verified: true })
            return
          }

          resolve({
            verified: false,
            reason: `You are ${formatKm(distance)} from ${station.name}. XP unlocks within ${stationXpRangeText()} of the station.`,
          })
        },
        () => resolve({ verified: false, reason: 'GPS permission was denied.' }),
        { enableHighAccuracy: true, timeout: 10000 },
      )
    })
  }

  return (
    <div className="page-stack">
      <section className="page-hero alerts-hero">
        <p className="eyebrow">Community alerts</p>
        <h1 className="page-title">Report delays, crowding, and route notes.</h1>
        <p className="page-subtitle">Shared alerts stay live for every rider, so the community feed reflects what people are seeing across the network.</p>
      </section>

      <section className="two-column-page">
        <form className="feature-panel" onSubmit={handleSubmit}>
          <div className="panel-heading">
            <MessageSquareWarning size={18} />
            <h2>Post an alert</h2>
          </div>
          <label className="form-label">
            Station
            <select value={stationUid} onChange={(event) => setStationUid(event.target.value)}>
              {allStations.map((station) => (
                <option key={station.uid} value={station.uid}>
                  {station.name} - {station.lineName}
                </option>
              ))}
            </select>
          </label>
          <label className="form-label">
            Alert type
            <select value={type} onChange={(event) => setType(event.target.value)}>
              <option>Crowding</option>
              <option>Delay</option>
              <option>Diversion</option>
              <option>Accessibility</option>
              <option>General note</option>
            </select>
          </label>
          <label className="form-label">
            Message
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Example: Platform is crowded but trains are moving."
              rows={5}
            />
          </label>
          <button className="primary-action" type="submit">
            <Send size={18} />
            Publish alert
          </button>
          {status ? <p className="form-status">{status}</p> : null}
        </form>

        <div className="feature-panel">
          <div className="panel-heading">
            <MessageSquareWarning size={18} />
            <h2>Live feed</h2>
            <span className="sync-pill">{syncStatus === 'synced' ? 'Live sync' : 'Syncing'}</span>
          </div>
          <div className="feed-list">
            {alerts.map((alert) => {
              const isOwnAlert = alert.userId && alert.userId === user?.uid
              const userUpvoted = alert.upvotes?.includes(user?.uid)
              const userDownvoted = alert.downvotes?.includes(user?.uid)

              return (
                <article className="feed-item" key={alert.id}>
                  <div className="feed-topline">
                    <strong>{alert.station}</strong>
                    <span>{alert.type}</span>
                  </div>
                  {alert.verified ? (
                    <div className="verified-row">
                      <BadgeCheck size={15} />
                      GPS verified at station
                    </div>
                  ) : null}
                  <p>{alert.message}</p>
                  <div className="vote-row">
                    <button
                      className={userUpvoted ? 'vote-button vote-button-active' : 'vote-button'}
                      onClick={() => voteAlert(alert.id, 'up')}
                      type="button"
                    >
                      <ThumbsUp size={16} />
                      {alert.upvoteCount ?? alert.upvotes?.length ?? 0}
                    </button>
                    <button
                      className={userDownvoted ? 'vote-button vote-button-active vote-button-down' : 'vote-button'}
                      onClick={() => voteAlert(alert.id, 'down')}
                      type="button"
                    >
                      <ThumbsDown size={16} />
                      {alert.downvoteCount ?? alert.downvotes?.length ?? 0}
                    </button>
                  </div>
                  <div className="feed-meta">
                    <span>{alert.lineName}{alert.userName ? ` - ${isOwnAlert ? 'You' : alert.userName}` : ''}</span>
                    {isOwnAlert ? (
                      <button onClick={() => deleteAlert(alert)} type="button">Remove</button>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
