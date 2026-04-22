import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
  const resendKey = process.env.RESEND_API_KEY
  const fromDomain = process.env.REMINDER_FROM_EMAIL || 'CHeSS Leadership <onboarding@resend.dev>'

  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'Supabase not configured' })
  if (!resendKey) return res.status(500).json({ error: 'RESEND_API_KEY not configured' })

  const { session_id, admin_email, admin_name } = req.body
  if (!session_id) return res.status(400).json({ error: 'session_id required' })

  const supabase = createClient(supabaseUrl, supabaseKey)
  const { data: session } = await supabase.from('sessions').select('*').eq('id', session_id).single()
  if (!session) return res.status(404).json({ error: 'Session not found' })

  const { data: members } = await supabase.from('members').select('name, email').in('status', ['full', 'trainee']).not('email', 'is', null)
  if (!members || members.length === 0) return res.status(200).json({ message: 'No members with emails', sent: 0 })

  const sd = new Date(`${session.session_date}T${session.session_time || '12:00'}:00`)
  const fDate = sd.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const fTime = sd.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const te = session.session_type === 'Didactic' ? '📚' : session.session_type === 'Case' ? '🏥' : '⚖️'
  const signer = admin_name ? `${admin_name} on behalf of the CHeSS Leadership Team` : 'The CHeSS Leadership Team'

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#F8F6F1;font-family:'Helvetica Neue',Arial,sans-serif"><div style="max-width:600px;margin:0 auto;padding:32px 16px"><div style="background:#0B1D3A;border-radius:12px 12px 0 0;padding:32px 28px;text-align:center"><div style="font-size:28px;font-weight:700;color:#fff;letter-spacing:2px;margin-bottom:4px">CHeSS</div><div style="font-size:13px;color:#E8E4DDcc;letter-spacing:1px">Canadian Hypertension Specialists Society</div></div><div style="background:#fff;padding:32px 28px;border:1px solid #E0DCD5;border-top:none"><div style="font-size:14px;color:#B91C3C;font-weight:600;text-transform:uppercase;letter-spacing:2px;margin-bottom:12px">Session Reminder</div><h1 style="font-size:24px;color:#0B1D3A;margin:0 0 16px;line-height:1.3">${te} ${session.title}</h1><div style="background:#F8F6F1;border-radius:8px;padding:20px;margin-bottom:24px"><table style="width:100%;border-collapse:collapse"><tr><td style="padding:6px 0;color:#7A7A7A;font-size:14px;width:100px">Date</td><td style="padding:6px 0;color:#1A1A1A;font-size:14px;font-weight:600">${fDate}</td></tr><tr><td style="padding:6px 0;color:#7A7A7A;font-size:14px">Time</td><td style="padding:6px 0;color:#1A1A1A;font-size:14px;font-weight:600">${fTime} ET</td></tr><tr><td style="padding:6px 0;color:#7A7A7A;font-size:14px">Format</td><td style="padding:6px 0;color:#1A1A1A;font-size:14px;font-weight:600">${session.session_type}</td></tr><tr><td style="padding:6px 0;color:#7A7A7A;font-size:14px">Presenter</td><td style="padding:6px 0;color:#1A1A1A;font-size:14px;font-weight:600">${session.presenter || 'TBA'}</td></tr><tr><td style="padding:6px 0;color:#7A7A7A;font-size:14px">CME</td><td style="padding:6px 0;color:#1A1A1A;font-size:14px;font-weight:600">${session.cme_hours || 1.25} hours (Section 1)</td></tr></table></div>${session.zoom_link ? `<div style="text-align:center;margin-bottom:24px"><a href="${session.zoom_link}" style="display:inline-block;padding:14px 36px;background:#B91C3C;color:#fff;border-radius:8px;font-size:16px;font-weight:600;text-decoration:none">Join Zoom Session</a></div>` : `<p style="font-size:14px;color:#4A4A4A;line-height:1.6;margin-bottom:24px">The Zoom link will be shared separately before the session.</p>`}${session.description ? `<p style="font-size:14px;color:#4A4A4A;line-height:1.6;margin-bottom:24px">${session.description}</p>` : ''}<p style="font-size:14px;color:#4A4A4A;line-height:1.6">After the session, please log in to the <a href="https://chess-hypertension.vercel.app" style="color:#B91C3C;font-weight:600">CHeSS Member Dashboard</a> to complete your evaluation and claim CME credit.</p><p style="font-size:14px;color:#4A4A4A;line-height:1.6;margin-top:24px">Best regards,<br><strong>${signer}</strong></p></div><div style="background:#0B1D3A;border-radius:0 0 12px 12px;padding:24px 28px;text-align:center"><div style="font-size:13px;color:#E8E4DDbb;line-height:1.7">Canadian Hypertension Specialists Society<br><a href="https://chess-hypertension.vercel.app" style="color:#E8E4DD">chess-hypertension.vercel.app</a></div></div></div></body></html>`

  let totalSent = 0
  const errors = []

  for (const m of members.filter(m => m.email)) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: fromDomain, reply_to: admin_email || undefined, to: m.email, subject: `CHeSS ${session.session_type} Reminder: ${session.title}`, html }),
      })
      if (r.ok) totalSent++
      else errors.push({ email: m.email, error: await r.text() })
    } catch (e) { errors.push({ email: m.email, error: e.message }) }
  }

  return res.status(200).json({ message: `Sent ${totalSent} reminder(s)`, sent: totalSent, total: members.filter(m=>m.email).length, errors: errors.length > 0 ? errors.slice(0, 5) : undefined })
}
