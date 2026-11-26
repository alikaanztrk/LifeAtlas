export function demoFile(): File {
  const at = (day: number, time: string) => '2025-05-' + String(day).padStart(2, '0') + 'T' + time + 'Z'
  const records = [3, 4, 8, 9, 15, 20, 22, 26].flatMap((day, index) => {
    const latitude = -42 + index / 100
    const start = { lat: latitude, lon: -137 }
    const end = { lat: latitude, lon: -136.98 }
    return [{
      startTime: at(day, '08:30:00'), endTime: at(day, '09:15:00'),
      visit: { topCandidate: {
        placeId: 'synthetic-' + (index % 3), name: ['Paper Bay', 'Compass Field', 'Quiet Loop'][index % 3],
        placeLocation: start,
      } },
    }, {
      startTime: at(day, '09:15:00'), endTime: at(day, '09:45:00'),
      activity: {
        start, end, topCandidate: { type: index % 2 ? 'CYCLING' : 'WALKING' },
        ...(index % 2 ? { distanceMeters: 2_310 + index * 125 } : {}),
      },
      timelinePath: [
        { point: start, time: at(day, '09:15:00') },
        { point: { lat: latitude + .002, lon: -136.99 }, time: at(day, '09:30:00') },
        { point: end, time: at(day, '09:45:00') },
      ],
    }]
  })
  return new File([JSON.stringify({ semanticSegments: records })], 'synthetic-demo.json', { type: 'application/json' })
}
