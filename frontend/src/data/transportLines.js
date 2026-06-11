import ecoBus from './eco_bus.json'
import metroBus from './metro_bus.json'
import orangeLine from './orange_line.json'

const names = {
  olmt_lahore: 'Orange',
  metro_bus_lahore: 'Metro',
  electro_route_1: 'Eco',
}

export const transportLines = [orangeLine, metroBus, ecoBus].map((line) => ({
  ...line,
  shortName: names[line.line_id] ?? line.line_name,
  stations: line.stations.map((station) => ({
    ...station,
    uid: `${line.line_id}-${station.id}`,
    lineId: line.line_id,
    lineName: line.line_name,
    lineColor: line.color,
  })),
}))

export const allStations = transportLines.flatMap((line) => line.stations)
