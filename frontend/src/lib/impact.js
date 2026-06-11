const CAR_CO2_KG_PER_KM = 0.12
const PUBLIC_TRANSPORT_CO2_KG_PER_KM = 0.075
const RIDE_HAILING_BASE_PKR = 110
const RIDE_HAILING_PER_KM_PKR = 38
const PUBLIC_TRANSPORT_AVG_PKR = 60

export function estimateImpact(distanceKm = 0) {
  const safeDistance = Math.max(0, distanceKm)
  const co2SavedKg = Math.max(0, (CAR_CO2_KG_PER_KM - PUBLIC_TRANSPORT_CO2_KG_PER_KM) * safeDistance)
  const rideHailingCost = RIDE_HAILING_BASE_PKR + safeDistance * RIDE_HAILING_PER_KM_PKR
  const moneySavedPkr = Math.max(0, rideHailingCost - PUBLIC_TRANSPORT_AVG_PKR)

  return {
    co2SavedKg,
    moneySavedPkr,
    rideHailingCost,
    publicTransportCost: PUBLIC_TRANSPORT_AVG_PKR,
  }
}

export function formatKg(value = 0) {
  return `${value.toFixed(value >= 10 ? 0 : 1)} kg`
}

export function formatPkr(value = 0) {
  return `Rs ${Math.round(value).toLocaleString()}`
}
