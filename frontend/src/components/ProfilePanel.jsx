import { Home, UserRound, Workflow } from 'lucide-react'
import { isFirebaseConfigured } from '../firebase/config.js'

export default function ProfilePanel() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <UserRound size={19} className="text-emerald-700" />
        <h2 className="text-lg font-bold">User profile</h2>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-sm font-semibold text-slate-950">
          Firebase status: {isFirebaseConfigured ? 'configured' : 'waiting for env keys'}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Auth, saved home/work stations, preferences, and favorite route CRUD will attach here.
        </p>
      </div>

      <div className="mt-4 grid gap-3">
        <Preference icon={Home} label="Home station" value="Not set" />
        <Preference icon={Workflow} label="Preferred mode" value="Any available line" />
      </div>
    </section>
  )
}

function Preference({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
      <div className="flex items-center gap-2">
        <Icon size={17} className="text-slate-500" />
        <span className="text-sm font-medium text-slate-600">{label}</span>
      </div>
      <span className="text-right text-sm font-semibold text-slate-950">{value}</span>
    </div>
  )
}
