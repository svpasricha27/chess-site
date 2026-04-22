import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.REMINDER_FROM_EMAIL || 'CHeSS Leadership <onboarding@resend.dev>'
  const siteUrl = 'https://chess-hypertension.org'

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Supabase service role key not configured' })
  }

  // Use service role key for admin operations (creating auth users)
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const { member_id, email, name } = req.body

  if (!member_id || !email) {
    return res.status(400).json({ error: 'member_id and email required' })
  }

  // Create the auth user with a random temp password
  const tempPassword = 'CHeSS_' + Math.random().toString(36).slice(2, 10) + '!'
  const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
    email: email,
    password: tempPassword,
    email_confirm: true,
  })

  if (createError) {
    // User might already exist
    if (createError.message.includes('already been registered')) {
      return res.status(200).json({ message: 'User already has an account', existing: true })
    }
    return res.status(500).json({ error: createError.message })
  }

  // Link the auth user to the member record
  if (authUser?.user?.id) {
    await supabase.from('members').update({ 
      user_id: authUser.user.id,
      status: 'full',
      member_since: new Date().toISOString().split('T')[0]
    }).eq('id', member_id)
  }

  // Send password reset email so member can set their own password
  await supabase.auth.admin.generateLink({
    type: 'recovery',
    email: email,
    options: { redirectTo: siteUrl }
  })

  // Also send a welcome email via Resend with instructions
  if (resendKey) {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F8F6F1;font-family:'Helvetica Neue',Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:32px 16px">
  <div style="background:#0B1D3A;border-radius:12px 12px 0 0;padding:32px 28px;text-align:center">
    <div style="font-size:28px;font-weight:700;color:#fff;letter-spacing:2px;margin-bottom:4px">CHeSS</div>
    <div style="font-size:13px;color:#E8E4DDcc;letter-spacing:1px">Canadian Hypertension Specialists Society</div>
  </div>
  <div style="background:#fff;padding:32px 28px;border:1px solid #E0DCD5;border-top:none">
    <h1 style="font-size:24px;color:#0B1D3A;margin:0 0 16px">Welcome to CHeSS, ${name || 'Member'}!</h1>
    <p style="font-size:14px;color:#4A4A4A;line-height:1.7;margin-bottom:20px">Your membership application has been approved. You now have access to the CHeSS Member Dashboard, session evaluations, CME credits, and the member directory.</p>
    <p style="font-size:14px;color:#4A4A4A;line-height:1.7;margin-bottom:20px">To get started, please set up your password:</p>
    <div style="text-align:center;margin-bottom:24px">
      <a href="${siteUrl}" style="display:inline-block;padding:14px 36px;background:#B91C3C;color:#fff;border-radius:8px;font-size:16px;font-weight:600;text-decoration:none">Visit CHeSS</a>
    </div>
    <p style="font-size:14px;color:#4A4A4A;line-height:1.7;margin-bottom:20px">Click <strong>Member Login</strong>, then click <strong>"Forgot or reset password?"</strong> to set your password using your email: <strong>${email}</strong></p>
    <p style="font-size:14px;color:#4A4A4A;line-height:1.7">Best regards,<br><strong>The CHeSS Leadership Team</strong></p>
  </div>
  <div style="background:#0B1D3A;border-radius:0 0 12px 12px;padding:24px 28px;text-align:center">
    <div style="font-size:13px;color:#E8E4DDbb;line-height:1.7">Canadian Hypertension Specialists Society<br><a href="${siteUrl}" style="color:#E8E4DD">${siteUrl.replace('https://','')}</a></div>
  </div>
</div></body></html>`

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromEmail,
        to: email,
        subject: 'Welcome to CHeSS — Your Membership is Approved',
        html,
      }),
    })
  }

  return res.status(200).json({ 
    message: `Account created for ${name || email}. Welcome email sent.`,
    user_id: authUser?.user?.id
  })
}
