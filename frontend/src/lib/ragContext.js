import { transportLines } from '../data/transportLines.js'

export function buildTransportContext() {
  return transportLines
    .map((line) => {
      const stations = line.stations
        .map((station) => {
          const interchange = station.is_interchange ? 'interchange' : 'regular stop'
          const notes = station.notes ? `, notes: ${station.notes}` : ''
          return `${station.name} (${station.lat}, ${station.lng}, ${interchange}${notes})`
        })
        .join('; ')

      return `${line.line_name}: ${stations}`
    })
    .join('\n')
}
