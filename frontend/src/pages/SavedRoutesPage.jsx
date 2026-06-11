import { Trash2, Route } from 'lucide-react'
import { formatKm } from '../lib/planner.js'

export default function SavedRoutesPage({ deleteSavedRoute, savedRoutes, syncStatus }) {
  return (
    <div className="page-stack">
      <section className="page-hero routes-hero">
        <p className="eyebrow">Saved routes</p>
        <h1 className="page-title">Keep frequent journeys one tap away.</h1>
        <p className="page-subtitle">Routes saved from the dashboard stay attached to your account. {syncStatus === 'synced' ? 'Your list is live.' : 'Your list is syncing.'}</p>
      </section>

      <section className="route-list">
        {savedRoutes.length ? (
          savedRoutes.map((route) => (
            <article className="route-list-card" key={route.id}>
              <div className="route-color" style={{ backgroundColor: route.color }} />
              <div>
                <p>{route.lineName}</p>
                <h2>{route.from} to {route.to}</h2>
                <span>{route.stops} stops | {formatKm(route.distanceKm)} | about {route.minutes} min</span>
              </div>
              <button onClick={() => deleteSavedRoute(route.id)} type="button" aria-label="Delete saved route">
                <Trash2 size={18} />
              </button>
            </article>
          ))
        ) : (
          <div className="empty-state">
            <Route size={26} />
            <h2>No saved routes yet</h2>
            <p>Build a route on the dashboard, then use Save route.</p>
          </div>
        )}
      </section>
    </div>
  )
}
