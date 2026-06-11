import { MessageSquareWarning } from 'lucide-react'

const sampleAlerts = [
  { station: 'Kalma Chowk', message: 'Moderate crowding reported near the platform.', time: 'Now' },
  { station: 'Anarkali', message: 'Orange Line service running normally.', time: '8 min' },
  { station: 'Railway Station', message: 'Eco Bus queue moving slowly during peak hour.', time: '14 min' },
]

export default function CommunityAlerts() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <MessageSquareWarning size={19} className="text-rose-600" />
        <h2 className="text-lg font-bold">Community alerts</h2>
      </div>
      <div className="mt-4 space-y-3">
        {sampleAlerts.map((alert) => (
          <article className="rounded-lg border border-slate-200 bg-slate-50 p-3" key={`${alert.station}-${alert.time}`}>
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-slate-950">{alert.station}</p>
              <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-500">{alert.time}</span>
            </div>
            <p className="mt-1 text-sm text-slate-600">{alert.message}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
