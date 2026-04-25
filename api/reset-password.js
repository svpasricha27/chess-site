import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.REMINDER_FROM_EMAIL || 'CHeSS Leadership <onboarding@resend.dev>'
  const siteUrl = 'https://chess-hypertension.org'

  if (!supabaseUrl || !serviceRoleKey) return res.status(500).json({ error: 'Supabase service role key not configured' })

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'Email required' })

  // Step 1: Check if email exists in members table
  const { data: member } = await supabase.from('members').select('id, name').eq('email', email).maybeSingle()
  if (!member) {
    return res.status(404).json({ error: 'No account found with this email address.' })
  }

  // Step 2: Generate recovery link (same approach as approve.js)
  let resetLink = siteUrl
  try {
    const { data: linkData } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: siteUrl }
    })
    if (linkData?.properties?.action_link) {
      resetLink = linkData.properties.action_link
    }
  } catch (e) { /* fallback to site URL */ }

  // Step 3: Send branded email via Resend (same approach as approve.js)
  if (resendKey) {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F8F6F1;font-family:'Helvetica Neue',Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:32px 16px">
  <div style="background:#0B1D3A;border-radius:12px 12px 0 0;padding:32px 28px;text-align:center">
    <div style="font-size:28px;font-weight:700;color:#fff;letter-spacing:2px;margin-bottom:4px">CHeSS</div>
    <div style="font-size:13px;color:#E8E4DDcc;letter-spacing:1px">Canadian Hypertension Specialists Society</div>
  </div>
  <div style="background:#fff;padding:32px 28px;border:1px solid #E0DCD5;border-top:none">
    <h1 style="font-size:24px;color:#0B1D3A;margin:0 0 16px">Reset Your Password</h1>
    <p style="font-size:14px;color:#4A4A4A;line-height:1.7;margin-bottom:24px">Hi ${member.name || 'Member'}, we received a request to reset your CHeSS account password. Click the button below to set a new password:</p>
    <div style="text-align:center;margin-bottom:24px">
      <a href="${resetLink}" style="display:inline-block;padding:16px 40px;background:#B91C3C;color:#fff;border-radius:8px;font-size:16px;font-weight:700;text-decoration:none;letter-spacing:0.5px">Set New Password</a>
    </div>
    <p style="font-size:13px;color:#7A7A7A;line-height:1.6;margin-bottom:20px">This link expires in 24 hours. If you did not request this, you can safely ignore this email.</p>
    <p style="font-size:14px;color:#4A4A4A;line-height:1.7">Best regards,<br><strong>The CHeSS Leadership Team</strong></p>
  </div>
  <div style="background:#0B1D3A;border-radius:0 0 12px 12px;padding:24px 28px;text-align:center">
    <div style="font-size:13px;color:#E8E4DDbb;line-height:1.7">Canadian Hypertension Specialists Society<br><a href="${siteUrl}" style="color:#E8E4DD">${siteUrl.replace('https://','')}</a></div>
  </div>
</div></body></html>`

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromEmail, to: email, subject: 'CHeSS — Reset Your Password', html }),
    })
  }

  return res.status(200).json({ message: 'Reset email sent.' })
}
