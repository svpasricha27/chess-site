import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.REMINDER_FROM_EMAIL || 'CHeSS Leadership <onboarding@resend.dev>'
  const siteUrl = 'https://chess-hypertension.org'

  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'Supabase not configured' })
  if (!resendKey) return res.status(500).json({ error: 'RESEND_API_KEY not configured' })

  const { session_id, admin_name } = req.body
  if (!session_id) return res.status(400).json({ error: 'session_id required' })

  const supabase = createClient(supabaseUrl, supabaseKey)
  const { data: session } = await supabase.from('sessions').select('*').eq('id', session_id).single()
  if (!session) return res.status(404).json({ error: 'Session not found' })

  const { data: members } = await supabase.from('members').select('name, email').in('status', ['full', 'trainee']).not('email', 'is', null)
  if (!members || members.length === 0) return res.status(200).json({ message: 'No members', sent: 0 })

  const [h, m] = (session.session_time || '12:00').split(':')
  const sd = new Date(`${session.session_date}T${String(h).padStart(2,'0')}:${String(m || '00').padStart(2,'0')}:00`)
  const fDate = sd.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const signer = admin_name || 'The CHeSS Leadership Team'

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F8F6F1;font-family:'Helvetica Neue',Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:32px 16px">
  <div style="background:#0B1D3A;border-radius:12px 12px 0 0;padding:32px 28px;text-align:center">
    <div style="font-size:28px;font-weight:700;color:#fff;letter-spacing:2px;margin-bottom:4px">CHeSS</div>
    <div style="font-size:13px;color:#E8E4DDcc;letter-spacing:1px">Canadian Hypertension Specialists Society</div>
  </div>
  <div style="background:#fff;padding:32px 28px;border:1px solid #E0DCD5;border-top:none">
    <div style="font-size:14px;color:#B91C3C;font-weight:600;text-transform:uppercase;letter-spacing:2px;margin-bottom:12px">Session Evaluation</div>
    <h1 style="font-size:24px;color:#0B1D3A;margin:0 0 16px;line-height:1.3">Please Complete Your Evaluation</h1>
    <p style="font-size:14px;color:#4A4A4A;line-height:1.7;margin-bottom:20px">Thank you for attending the recent CHeSS session:</p>
    <div style="background:#F8F6F1;border-radius:8px;padding:20px;margin-bottom:24px">
      <div style="font-size:18px;font-weight:700;color:#0B1D3A;margin-bottom:8px">${session.title}</div>
      <div style="font-size:14px;color:#4A4A4A">${fDate}</div>
      <div style="font-size:14px;color:#4A4A4A">Presented by ${session.presenter || 'TBA'} &middot; ${session.cme_hours || 1.25} CME hours</div>
    </div>
    <p style="font-size:14px;color:#4A4A4A;line-height:1.7;margin-bottom:20px">Please log in to the Member Dashboard to complete your session evaluation and <strong>claim your CME credit</strong>. Evaluations are available for <strong>7 days</strong> after the session.</p>
    <div style="text-align:center;margin-bottom:24px">
      <a href="${siteUrl}" style="display:inline-block;padding:14px 36px;background:#B91C3C;color:#fff;border-radius:8px;font-size:16px;font-weight:600;text-decoration:none">Complete Evaluation & Claim CME</a>
    </div>
    <p style="font-size:13px;color:#7A7A7A;line-height:1.6;margin-bottom:20px">Log in &rarr; Member Dashboard &rarr; Evaluations tab</p>
    <p style="font-size:14px;color:#4A4A4A;line-height:1.6">Best regards,<br><strong>${signer}</strong></p>
  </div>
  <div style="background:#0B1D3A;border-radius:0 0 12px 12px;padding:24px 28px;text-align:center">
    <div style="font-size:13px;color:#E8E4DDbb;line-height:1.7">Canadian Hypertension Specialists Society<br><a href="${siteUrl}" style="color:#E8E4DD">${siteUrl.replace('https://','')}</a></div>
  </div>
</div></body></html>`

  let totalSent = 0
  const errors = []
  for (const mem of members.filter(m => m.email)) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: fromEmail, to: mem.email, subject: `CHeSS: Please Evaluate — ${session.title}`, html }),
      })
      if (r.ok) totalSent++
      else errors.push({ email: mem.email, error: await r.text() })
    } catch (e) { errors.push({ email: mem.email, error: e.message }) }
  }

  return res.status(200).json({ message: `Sent ${totalSent} evaluation reminder(s)`, sent: totalSent, total: members.filter(m=>m.email).length, errors: errors.length > 0 ? errors.slice(0, 5) : undefined })
}
