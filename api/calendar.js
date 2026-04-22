import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    res.status(500).send('Supabase not configured')
    return
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const { data: sessions } = await supabase
    .from('sessions')
    .select('*')
    .order('session_date', { ascending: true })

  if (!sessions) {
    res.status(500).send('Failed to fetch sessions')
    return
  }

  const pad = (n) => String(n).padStart(2, '0')

  const toICSDate = (dateStr, time) => {
    const [h, m] = (time || '12:00').split(':')
    return `${dateStr.replace(/-/g, '')}T${pad(h)}${pad(m)}00`
  }

  const toICSEndDate = (dateStr, time, hours) => {
    const d = new Date(`${dateStr}T${time || '12:00'}:00`)
    d.setMinutes(d.getMinutes() + Math.round((hours || 1.25) * 60))
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`
  }

  const escapeICS = (str) => (str || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')

  const events = sessions.map(s => {
    const start = toICSDate(s.session_date, s.session_time)
    const end = toICSEndDate(s.session_date, s.session_time, s.cme_hours)
    const uid = `${s.id || s.session_date}@chess-hypertension.vercel.app`

    let description = `Presenter: ${s.presenter || 'TBA'}`
    description += `\\nType: ${s.session_type}`
    description += `\\nCME: ${s.cme_hours || 1.25} hours`
    if (s.zoom_link) description += `\\nZoom: ${s.zoom_link}`
    description += `\\n\\nCanadian Hypertension Specialists Society`

    return [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:CHeSS: ${escapeICS(s.title)}`,
      `DESCRIPTION:${description}`,
      s.zoom_link ? `LOCATION:${escapeICS(s.zoom_link)}` : 'LOCATION:Zoom (link sent to members)',
      'STATUS:CONFIRMED',
      `ORGANIZER;CN=CHeSS Leadership:mailto:info@chess-hypertension.ca`,
      'END:VEVENT',
    ].join('\r\n')
  }).join('\r\n')

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CHeSS//Case Conferences//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:CHeSS Sessions',
    'X-WR-CALDESC:Canadian Hypertension Specialists Society - Monthly Case Conferences',
    'X-WR-TIMEZONE:America/Toronto',
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    events,
    'END:VCALENDAR',
  ].join('\r\n')

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
  res.setHeader('Content-Disposition', 'inline; filename="chess-sessions.ics"')
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate')
  res.status(200).send(ics)
}
