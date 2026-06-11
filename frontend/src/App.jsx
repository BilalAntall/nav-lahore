import { useCallback, useEffect, useRef, useState } from 'react'
import { onAuthStateChanged, reload, signOut } from 'firebase/auth'
import {
  Bell,
  Bot,
  Bookmark,
  LayoutDashboard,
  LogOut,
  MessageSquareWarning,
  TrainFront,
  UserRound,
} from 'lucide-react'
import AuthPage from './components/AuthPage.jsx'
import { useCommunityAlerts, useRiderStats, useSavedRoutes, useUserProfile } from './hooks/useFirestoreData.js'
import { auth } from './firebase/config.js'
import { getBadgeProgress, getCurrentLevel, getNextLevel, getPrimaryBadge } from './lib/gamification.js'
import { getStationsForLine } from './lib/planner.js'
import CommunityAlertsPage from './pages/CommunityAlertsPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import RaahiBotPage from './pages/RaahiBotPage.jsx'
import SavedRoutesPage from './pages/SavedRoutesPage.jsx'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'alerts', label: 'Alerts', icon: MessageSquareWarning },
  { id: 'routes', label: 'Saved Routes', icon: Bookmark },
  { id: 'raahi', label: 'RAAHI Bot', icon: Bot },
  { id: 'profile', label: 'Profile', icon: UserRound },
]

const starterAlerts = [
  {
    id: 'sample-1',
    station: 'Kalma Chowk',
    lineName: 'Lahore Metro Bus (Green Line)',
    type: 'Crowding',
    message: 'Moderate crowding reported near the platform.',
    upvoteCount: 0,
    upvotes: [],
    downvoteCount: 0,
    downvotes: [],
    verified: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'sample-2',
    station: 'Anarkali',
    lineName: 'Orange Line Metro Train',
    type: 'Service',
    message: 'Orange Line service running normally.',
    upvoteCount: 0,
    upvotes: [],
    downvoteCount: 0,
    downvotes: [],
    verified: false,
    createdAt: new Date().toISOString(),
  },
]

const initialPlannerState = {
  selectedLineId: 'olmt_lahore',
  currentLocation: null,
  locationStatus: 'Click below to get your location.',
  destinationUid: getStationsForLine('olmt_lahore').at(-1).uid,
  etaSeconds: null,
}

const devDemoUser = {
  uid: 'demo-rider-123',
  email: 'demo@navlahore.pk',
  displayName: 'Lahore Demo Rider',
  isAnonymous: false,
}

const allowedPageIds = new Set(navItems.map((item) => item.id))

function getInitialPage() {
  const page = new URLSearchParams(window.location.search).get('page')
  return allowedPageIds.has(page) ? page : 'dashboard'
}

function shouldStartInDevDemo() {
  return import.meta.env.DEV && new URLSearchParams(window.location.search).get('demo') === '1'
}

export default function App() {
  const [user, setUser] = useState(shouldStartInDevDemo() ? devDemoUser : auth ? undefined : null)
  const [pendingUser, setPendingUser] = useState(null)
  const [isPreparingDashboard, setIsPreparingDashboard] = useState(false)
  const [loadingLineIndex, setLoadingLineIndex] = useState(0)
  const [activePage, setActivePage] = useState(getInitialPage)
  const [showBadges, setShowBadges] = useState(false)
  const [plannerState, setPlannerState] = useState(initialPlannerState)
  const { alerts, addAlert, deleteAlert, status: alertsStatus, voteAlert } = useCommunityAlerts(starterAlerts, user)
  const { savedRoutes, addSavedRoute, deleteSavedRoute, status: routesStatus } = useSavedRoutes(user)
  const { profile, saveProfile, status: profileStatus } = useUserProfile(user)
  const { awardVerifiedAlertXp, checkInAtStation, stats, status: statsStatus } = useRiderStats(user)
  const dashboardTimerRef = useRef(null)

  const resetAuthState = useCallback(() => {
    window.clearTimeout(dashboardTimerRef.current)
    setPendingUser(null)
    setIsPreparingDashboard(false)
    setUser(null)
  }, [])

  useEffect(() => {
    if (shouldStartInDevDemo()) return
    if (!auth) return

    const prepareDashboard = (nextUser) => {
      window.clearTimeout(dashboardTimerRef.current)
      setPendingUser(nextUser)
      setIsPreparingDashboard(true)
      setLoadingLineIndex(0)

      dashboardTimerRef.current = window.setTimeout(() => {
        setUser(nextUser)
        setPendingUser(null)
        setIsPreparingDashboard(false)
      }, 8000)
    }

    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      if (nextUser && !nextUser.emailVerified) {
        const isGoogleUser = nextUser.providerData?.some((provider) => provider.providerId === 'google.com')
        if (!isGoogleUser) {
          await reload(nextUser)
          if (nextUser.emailVerified) {
            prepareDashboard(nextUser)
            return
          }
          await signOut(auth)
          resetAuthState()
          return
        }
      }

      if (nextUser) {
        prepareDashboard(nextUser)
        return
      }

      resetAuthState()
    })

    return () => {
      window.clearTimeout(dashboardTimerRef.current)
      unsub()
    }
  }, [resetAuthState])

  useEffect(() => {
    if (user !== undefined && !isPreparingDashboard) return

    const interval = window.setInterval(() => {
      setLoadingLineIndex((index) => (index + 1) % loadingLines.length)
    }, 2000)

    return () => window.clearInterval(interval)
  }, [isPreparingDashboard, user])

  async function handleSignOut() {
    try {
      await signOut(auth)
      setActivePage('dashboard')
    } catch (error) {
      console.error(error)
    }
  }

  if (user === undefined || isPreparingDashboard) {
    return <DashboardLoading lineIndex={loadingLineIndex} user={pendingUser} />
  }

  if (!user) {
    return (
      <AuthPage
        onAuthSuccess={() => {}}
        onDemoLogin={() =>
          setUser(devDemoUser)
        }
      />
    )
  }

  const displayName = user.isAnonymous
    ? 'Guest'
    : profile.displayName || user.displayName || user.email?.split('@')[0] || 'Rider'
  const currentLevel = getCurrentLevel(stats.xp)
  const nextLevel = getNextLevel(stats.xp)
  const primaryBadge = getPrimaryBadge(stats)
  const badgeList = getBadgeProgress(stats)

  return (
    <main className="app-root">
      <header className="app-header">
        <div className="brand-lockup">
          <div className="brand-mark">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 17l2-9h14l2 9" /><path d="M3 17h18" /><path d="M8 17v2" /><path d="M16 17v2" /><circle cx="8" cy="13" r="1" /><circle cx="16" cy="13" r="1" />
            </svg>
          </div>
          <div>
            <p>NavLahore</p>
            <h1>Unified Transport</h1>
          </div>
        </div>

        <nav className="app-nav" aria-label="Primary navigation">
          {navItems.map((item) => (
            <button
              className={activePage === item.id ? 'nav-button nav-button-active' : 'nav-button'}
              key={item.id}
              onClick={() => setActivePage(item.id)}
              type="button"
            >
              <item.icon size={17} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="user-menu">
          <button className="badge-trigger" onClick={() => setShowBadges(true)} type="button">
            <span>{primaryBadge.title}</span>
            <strong>{stats.xp} XP</strong>
          </button>
          <span>Hi, {displayName}</span>
          <button id="btn-sign-out" onClick={handleSignOut} title="Sign out" type="button">
            <LogOut size={17} />
          </button>
        </div>
      </header>

      <section className="app-content">
        {activePage === 'dashboard' && (
          <DashboardPage
            addSavedRoute={addSavedRoute}
            checkInAtStation={checkInAtStation}
            plannerState={plannerState}
            setPlannerState={setPlannerState}
            stats={stats}
            statsStatus={statsStatus}
          />
        )}
        {activePage === 'alerts' && (
          <CommunityAlertsPage
            addAlert={addAlert}
            awardVerifiedAlertXp={awardVerifiedAlertXp}
            alerts={alerts}
            deleteAlert={deleteAlert}
            syncStatus={alertsStatus}
            user={user}
            voteAlert={voteAlert}
          />
        )}
        {activePage === 'routes' && (
          <SavedRoutesPage
            deleteSavedRoute={deleteSavedRoute}
            savedRoutes={savedRoutes}
            syncStatus={routesStatus}
          />
        )}
        {activePage === 'raahi' && <RaahiBotPage user={user} />}
        {activePage === 'profile' && (
          <ProfilePage profile={profile} profileStatus={profileStatus} saveProfile={saveProfile} user={user} />
        )}
      </section>

      {showBadges ? (
        <BadgeModal
          badges={badgeList}
          currentLevel={currentLevel}
          nextLevel={nextLevel}
          onClose={() => setShowBadges(false)}
          stats={stats}
        />
      ) : null}
    </main>
  )
}

function BadgeModal({ badges, currentLevel, nextLevel, onClose, stats }) {
  const nextXp = nextLevel ? nextLevel.minXp - stats.xp : 0

  return (
    <div className="badge-modal-backdrop" role="presentation" onClick={onClose}>
      <section className="badge-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="badge-modal-header">
          <div>
            <p className="eyebrow">Lahore rider levels</p>
            <h2>{currentLevel.title}</h2>
            <span>{stats.xp} XP {nextLevel ? `| ${nextXp} XP to ${nextLevel.title}` : '| Max level reached'}</span>
          </div>
          <button onClick={onClose} type="button">Close</button>
        </div>

        <div className="badge-list">
          {badges.map((badge) => (
            <article className={badge.unlocked ? 'badge-card badge-card-unlocked' : 'badge-card'} key={badge.id}>
              <strong>{badge.name}</strong>
              <p>{badge.description}</p>
              <span>{badge.unlocked ? 'Unlocked' : 'Locked'}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

const loadingLines = [
  'Verifying your account',
  'Syncing your rider profile',
  'Loading Lahore transport data',
  'Preparing your dashboard',
]

function DashboardLoading({ lineIndex, user }) {
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Rider'

  return (
    <main className="loading-root">
      <section className="loading-panel" aria-live="polite" aria-busy="true">
        <div className="loading-brand">
          <div className="loading-logo">
            <TrainFront size={24} />
          </div>
          <span>NavLahore</span>
        </div>

        <p className="loading-kicker">Welcome, {displayName}</p>
        <h1 className="loading-title">{loadingLines[lineIndex]}</h1>
        <p className="loading-comment">Almost there. Setting up your routes, alerts, and map view.</p>

        <div className="loading-bar-shell" aria-label="Dashboard loading progress">
          <div className="loading-bar-fill" />
        </div>

        <p className="loading-note">
          <Bell size={14} />
          One city. One app. All transport.
        </p>
      </section>
    </main>
  )
}
