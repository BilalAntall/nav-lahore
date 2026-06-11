import { useEffect, useState } from 'react'
import { updateProfile } from 'firebase/auth'
import { Save, UserRound } from 'lucide-react'
import { transportLines } from '../data/transportLines.js'

export default function ProfilePage({ user, profile, profileStatus, saveProfile }) {
  const [form, setForm] = useState(profile)
  const [status, setStatus] = useState('')

  useEffect(() => {
    const syncForm = window.setTimeout(() => setForm(profile), 0)
    return () => window.clearTimeout(syncForm)
  }, [profile])

  async function handleSubmit(event) {
    event.preventDefault()
    setStatus('Saving profile...')
    try {
      await saveProfile(form)
      if (user && form.displayName && form.displayName !== user.displayName) {
        await updateProfile(user, { displayName: form.displayName })
      }
      setStatus('Profile saved.')
    } catch {
      setStatus('Preferences saved locally, but Firebase display name could not be updated.')
    }
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setStatus('')
  }

  return (
    <div className="page-stack">
      <section className="page-hero profile-hero">
        <p className="eyebrow">Rider profile</p>
        <h1 className="page-title">Edit your transport preferences.</h1>
        <p className="page-subtitle">Keep your name, home/work notes, preferred line, and accessibility needs ready for personalization. {profileStatus === 'synced' ? 'Your changes are saved across devices.' : 'Your profile is syncing.'}</p>
      </section>

      <form className="profile-form feature-panel" onSubmit={handleSubmit}>
        <div className="panel-heading">
          <UserRound size={18} />
          <h2>Profile details</h2>
        </div>

        <label className="form-label">
          Display name
          <input value={form.displayName} onChange={(event) => updateField('displayName', event.target.value)} />
        </label>
        <label className="form-label">
          Home location
          <input value={form.home} onChange={(event) => updateField('home', event.target.value)} placeholder="Example: Johar Town" />
        </label>
        <label className="form-label">
          Work or campus
          <input value={form.work} onChange={(event) => updateField('work', event.target.value)} placeholder="Example: Anarkali" />
        </label>
        <label className="form-label">
          Preferred transport mode
          <select value={form.preferredLineId} onChange={(event) => updateField('preferredLineId', event.target.value)}>
            {transportLines.map((line) => (
              <option key={line.line_id} value={line.line_id}>{line.line_name}</option>
            ))}
          </select>
        </label>
        <label className="checkbox-row">
          <input
            checked={form.accessibilityNeeds}
            onChange={(event) => updateField('accessibilityNeeds', event.target.checked)}
            type="checkbox"
          />
          Prioritize accessibility-friendly stations and routes.
        </label>

        {status ? <p className="form-status">{status}</p> : null}

        <button className="primary-action" type="submit">
          <Save size={18} />
          Save profile
        </button>
      </form>
    </div>
  )
}
