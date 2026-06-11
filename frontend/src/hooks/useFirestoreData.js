import { useCallback, useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { transportLines } from '../data/transportLines.js'
import { XP_REWARDS } from '../lib/gamification.js'

const defaultProfile = {
  displayName: '',
  home: '',
  work: '',
  preferredLineId: transportLines[0].line_id,
  accessibilityNeeds: false,
}

const defaultStats = {
  xp: 0,
  checkIns: 0,
  verifiedAlerts: 0,
  earlyCheckIns: 0,
  co2SavedKg: 0,
  moneySavedPkr: 0,
  checkInKeys: {},
}

export const RAAHI_MESSAGE_LIMIT = 5

export function useCommunityAlerts(initialAlerts, user) {
  const [alerts, setAlerts] = useState(initialAlerts)
  const [status, setStatus] = useState(db ? 'syncing' : 'local')

  useEffect(() => {
    if (!db) return undefined

    const alertsQuery = query(collection(db, 'communityAlerts'), orderBy('createdAt', 'desc'))
    return onSnapshot(
      alertsQuery,
      (snapshot) => {
        setAlerts(snapshot.docs.map((alertDoc) => fromFirestore(alertDoc)))
        setStatus('synced')
      },
      () => setStatus('error'),
    )
  }, [])

  const addAlert = useCallback(async (alert) => {
    if (!db) {
      setAlerts((current) => [{ ...alert, id: `${Date.now()}`, createdAt: new Date().toISOString() }, ...current])
      return
    }

    await addDoc(collection(db, 'communityAlerts'), {
      downvoteCount: 0,
      downvotes: [],
      upvoteCount: 0,
      upvotes: [],
      ...alert,
      createdAt: serverTimestamp(),
    })
  }, [])

  const voteAlert = useCallback(
    async (alertId, vote) => {
      if (!user?.uid) return

      let previousAlerts = []
      setAlerts((current) => {
        previousAlerts = current
        return current.map((alert) => {
          if (alert.id !== alertId) return alert
          return applyLocalVote(alert, user.uid, vote)
        })
      })

      if (!db) {
        return
      }

      try {
        await runTransaction(db, async (transaction) => {
          const alertRef = doc(db, 'communityAlerts', alertId)
          const snapshot = await transaction.get(alertRef)
          if (!snapshot.exists()) return

          const data = snapshot.data()
          const currentUpvotes = data.upvotes ?? []
          const currentDownvotes = data.downvotes ?? []
          const nextVoteState = getNextVoteState({
            downvotes: currentDownvotes,
            upvotes: currentUpvotes,
            userId: user.uid,
            vote,
          })

          transaction.update(alertRef, {
            downvoteCount: nextVoteState.downvotes.length,
            downvotes: nextVoteState.downvotes,
            upvoteCount: nextVoteState.upvotes.length,
            upvotes: nextVoteState.upvotes,
          })
        })
      } catch (error) {
        setAlerts(previousAlerts)
        setStatus('error')
        throw error
      }
    },
    [user],
  )

  const deleteAlert = useCallback(async (alert) => {
    const alertId = typeof alert === 'string' ? alert : alert?.id
    const alertUserId = typeof alert === 'string' ? alerts.find((item) => item.id === alert)?.userId : alert?.userId

    if (!alertId || !alertUserId || alertUserId !== user?.uid) return

    if (!db) {
      setAlerts((current) => current.filter((item) => item.id !== alertId))
      return
    }

    await deleteDoc(doc(db, 'communityAlerts', alertId))
  }, [alerts, user?.uid])

  return { alerts, addAlert, deleteAlert, status, voteAlert }
}

export function useSavedRoutes(user) {
  const [savedRoutes, setSavedRoutes] = useState([])
  const [status, setStatus] = useState(db ? 'syncing' : 'local')

  useEffect(() => {
    if (!db || !user?.uid) return undefined

    const routesQuery = query(collection(db, 'users', user.uid, 'savedRoutes'), orderBy('createdAt', 'desc'))
    return onSnapshot(
      routesQuery,
      (snapshot) => {
        setSavedRoutes(snapshot.docs.map((routeDoc) => fromFirestore(routeDoc)))
        setStatus('synced')
      },
      () => setStatus('error'),
    )
  }, [user?.uid])

  const addSavedRoute = useCallback(
    async (route) => {
      if (!db || !user?.uid) {
        setSavedRoutes((current) => [{ ...route, id: `${Date.now()}`, createdAt: new Date().toISOString() }, ...current])
        return
      }

      const routeData = { ...route }
      delete routeData.id
      await addDoc(collection(db, 'users', user.uid, 'savedRoutes'), {
        ...routeData,
        createdAt: serverTimestamp(),
      })
    },
    [user],
  )

  const deleteSavedRoute = useCallback(
    async (routeId) => {
      if (!db || !user?.uid) {
        setSavedRoutes((current) => current.filter((route) => route.id !== routeId))
        return
      }

      await deleteDoc(doc(db, 'users', user.uid, 'savedRoutes', routeId))
    },
    [user],
  )

  return { savedRoutes, addSavedRoute, deleteSavedRoute, status }
}

export function useUserProfile(user) {
  const [profile, setProfile] = useState(defaultProfile)
  const [status, setStatus] = useState(db ? 'syncing' : 'local')

  useEffect(() => {
    if (!db || !user?.uid) return undefined

    return onSnapshot(
      doc(db, 'users', user.uid),
      (snapshot) => {
        const data = snapshot.data()
        setProfile({
          ...defaultProfile,
          displayName: user.displayName || user.email?.split('@')[0] || '',
          ...(data?.profile ?? {}),
        })
        setStatus('synced')
      },
      () => setStatus('error'),
    )
  }, [user?.displayName, user?.email, user?.uid])

  const saveProfile = useCallback(
    async (nextProfile) => {
      setProfile(nextProfile)

      if (!db || !user?.uid) return

      await setDoc(
        doc(db, 'users', user.uid),
        {
          profile: nextProfile,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
    },
    [user],
  )

  return { profile, saveProfile, status }
}

export function useRiderStats(user) {
  const [stats, setStats] = useState(defaultStats)
  const [status, setStatus] = useState(db ? 'syncing' : 'local')

  useEffect(() => {
    if (!db || !user?.uid) return undefined

    return onSnapshot(
      doc(db, 'users', user.uid),
      (snapshot) => {
        setStats({ ...defaultStats, ...(snapshot.data()?.stats ?? {}) })
        setStatus('synced')
      },
      () => setStatus('error'),
    )
  }, [user?.uid])

  const awardVerifiedAlertXp = useCallback(
    async (stationUid) => {
      if (!user?.uid) return { awarded: false }
      const today = todayKey()

      if (!db) {
        setStats((current) => ({
          ...current,
          verifiedAlerts: current.verifiedAlerts + 1,
          xp: current.xp + XP_REWARDS.verifiedAlert,
        }))
        return { awarded: true, xp: XP_REWARDS.verifiedAlert }
      }

      return runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', user.uid)
        const snapshot = await transaction.get(userRef)
        const currentStats = { ...defaultStats, ...(snapshot.data()?.stats ?? {}) }
        const alertKeys = currentStats.alertKeys ?? {}
        const key = `${stationUid}:${today}`

        if (alertKeys[key]) return { awarded: false }

        const nextStats = {
          ...currentStats,
          alertKeys: { ...alertKeys, [key]: true },
          verifiedAlerts: currentStats.verifiedAlerts + 1,
          xp: currentStats.xp + XP_REWARDS.verifiedAlert,
        }
        transaction.set(userRef, { stats: nextStats, updatedAt: serverTimestamp() }, { merge: true })
        return { awarded: true, xp: XP_REWARDS.verifiedAlert }
      })
    },
    [user],
  )

  const checkInAtStation = useCallback(
    async ({ station, impact }) => {
      if (!user?.uid || !station) return { awarded: false }
      const today = todayKey()
      const key = `${station.uid}:${today}`
      const isEarly = new Date().getHours() < 8

      if (!db) {
        setStats((current) => {
          if (current.checkInKeys?.[key]) return current
          return {
            ...current,
            checkInKeys: { ...(current.checkInKeys ?? {}), [key]: true },
            checkIns: current.checkIns + 1,
            co2SavedKg: current.co2SavedKg + impact.co2SavedKg,
            earlyCheckIns: current.earlyCheckIns + (isEarly ? 1 : 0),
            moneySavedPkr: current.moneySavedPkr + impact.moneySavedPkr,
            xp: current.xp + XP_REWARDS.stationCheckIn,
          }
        })
        return { awarded: true, xp: XP_REWARDS.stationCheckIn }
      }

      return runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', user.uid)
        const snapshot = await transaction.get(userRef)
        const currentStats = { ...defaultStats, ...(snapshot.data()?.stats ?? {}) }

        if (currentStats.checkInKeys?.[key]) return { awarded: false, reason: 'already-checked-in' }

        const nextStats = {
          ...currentStats,
          checkInKeys: { ...(currentStats.checkInKeys ?? {}), [key]: true },
          checkIns: currentStats.checkIns + 1,
          co2SavedKg: Number(currentStats.co2SavedKg ?? 0) + impact.co2SavedKg,
          earlyCheckIns: Number(currentStats.earlyCheckIns ?? 0) + (isEarly ? 1 : 0),
          moneySavedPkr: Number(currentStats.moneySavedPkr ?? 0) + impact.moneySavedPkr,
          xp: Number(currentStats.xp ?? 0) + XP_REWARDS.stationCheckIn,
        }

        transaction.set(userRef, { stats: nextStats, updatedAt: serverTimestamp() }, { merge: true })
        return { awarded: true, xp: XP_REWARDS.stationCheckIn }
      })
    },
    [user],
  )

  return { awardVerifiedAlertXp, checkInAtStation, stats, status }
}

export function useRaahiUsage(user) {
  const userId = user?.uid
  const [count, setCount] = useState(0)
  const [resetAt, setResetAt] = useState(null)
  const [status, setStatus] = useState(db ? 'syncing' : 'local')

  useEffect(() => {
    let active = true

    if (!userId) {
      Promise.resolve().then(() => {
        if (!active) return
        setCount(0)
        setResetAt(null)
        setStatus(db ? 'syncing' : 'local')
      })
      return () => {
        active = false
      }
    }

    if (!db) {
      Promise.resolve().then(() => {
        if (!active) return
        const localUsage = readLocalRaahiUsage(userId)
        setCount(localUsage.count)
        setResetAt(localUsage.resetAt)
        setStatus('local')
      })
      return () => {
        active = false
      }
    }

    return onSnapshot(
      doc(db, 'raahiUsage', userId),
      (snapshot) => {
        const usage = normalizeRaahiUsage(snapshot.data()?.usage)
        setCount(usage.count)
        setResetAt(usage.resetAt)
        setStatus('synced')
      },
      () => setStatus('error'),
    )
  }, [userId])

  useEffect(() => {
    const resetAtMs = resetAt ? Date.parse(resetAt) : 0
    if (!resetAtMs) return undefined

    const delay = resetAtMs - Date.now()
    if (delay <= 0) {
      Promise.resolve().then(() => {
        setCount(0)
        setResetAt(null)
      })
      return undefined
    }

    const timer = window.setTimeout(() => {
      setCount(0)
      setResetAt(null)
    }, delay)

    return () => window.clearTimeout(timer)
  }, [resetAt])

  const applyUsage = useCallback(
    (usage) => {
      if (!usage) return

      const nextUsage = {
        count: Number(usage.count ?? 0),
        resetAt: usage.resetAt ?? null,
      }

      setCount(nextUsage.count)
      setResetAt(nextUsage.resetAt)

      if (!db && userId) {
        writeLocalRaahiUsage(userId, nextUsage)
      }
    },
    [userId],
  )

  return {
    applyUsage,
    count,
    limit: RAAHI_MESSAGE_LIMIT,
    remaining: Math.max(0, RAAHI_MESSAGE_LIMIT - count),
    resetAt,
    status,
  }
}

function fromFirestore(snapshot) {
  const data = snapshot.data()
  return {
    ...data,
    id: snapshot.id,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
  }
}

function applyLocalVote(alert, userId, vote) {
  const nextVoteState = getNextVoteState({
    downvotes: alert.downvotes ?? [],
    upvotes: alert.upvotes ?? [],
    userId,
    vote,
  })

  return {
    ...alert,
    downvoteCount: nextVoteState.downvotes.length,
    downvotes: nextVoteState.downvotes,
    upvoteCount: nextVoteState.upvotes.length,
    upvotes: nextVoteState.upvotes,
  }
}

function getNextVoteState({ downvotes, upvotes, userId, vote }) {
  const hasUpvote = upvotes.includes(userId)
  const hasDownvote = downvotes.includes(userId)
  let nextUpvotes = upvotes.filter((id) => id !== userId)
  let nextDownvotes = downvotes.filter((id) => id !== userId)

  if (vote === 'up' && !hasUpvote) nextUpvotes = [...nextUpvotes, userId]
  if (vote === 'down' && !hasDownvote) nextDownvotes = [...nextDownvotes, userId]

  return {
    downvotes: nextDownvotes,
    upvotes: nextUpvotes,
  }
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function normalizeRaahiUsage(usage = {}) {
  const resetAtMs = timestampToMillis(usage.raahiBotWindowResetAt)
  const hasExpired = resetAtMs > 0 && Date.now() >= resetAtMs

  return {
    count: hasExpired ? 0 : Number(usage.raahiBotMessages ?? 0),
    resetAt: hasExpired || !resetAtMs ? null : new Date(resetAtMs).toISOString(),
  }
}

function timestampToMillis(value) {
  if (!value) return 0
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value.seconds === 'number') return value.seconds * 1000
  if (typeof value === 'string') return Date.parse(value) || 0
  if (typeof value === 'number') return value
  return 0
}

function readLocalRaahiUsage(userId) {
  try {
    return normalizeRaahiUsage(JSON.parse(window.localStorage.getItem(localRaahiKey(userId)) ?? '{}'))
  } catch {
    return { count: 0, resetAt: null }
  }
}

function writeLocalRaahiUsage(userId, usage) {
  window.localStorage.setItem(
    localRaahiKey(userId),
    JSON.stringify({
      raahiBotMessages: usage.count,
      raahiBotWindowResetAt: usage.resetAt,
    }),
  )
}

function localRaahiKey(userId) {
  return `raahi-bot-message-count:${userId}`
}
