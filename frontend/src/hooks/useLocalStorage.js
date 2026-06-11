import { useEffect, useState } from 'react'

export function useLocalStorage(key, fallbackValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = window.localStorage.getItem(key)
      return stored ? JSON.parse(stored) : fallbackValue
    } catch {
      return fallbackValue
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      return undefined
    }
  }, [key, value])

  return [value, setValue]
}
