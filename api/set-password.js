import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) return res.status(500).json({ error: 'Not configured' })

  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // Find the auth user by email
  try {
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
    if (listError) return res.status(500).json({ error: 'Could not look up user' })

    const user = users?.find(u => u.email === email)
    if (!user) return res.status(404).json({ error: 'No account found' })

    // Update password via admin API (no session needed)
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, { password })
    if (updateError) return res.status(500).json({ error: updateError.message })

    return res.status(200).json({ message: 'Password updated successfully' })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
