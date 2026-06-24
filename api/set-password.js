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

  try {
    // Look up user_id from members table first
    const { data: member } = await supabase.from('members').select('user_id').eq('email', email.toLowerCase().trim()).maybeSingle()

    if (member?.user_id) {
      // Update password directly by user ID
      const { error } = await supabase.auth.admin.updateUserById(member.user_id, { password })
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ message: 'Password updated successfully' })
    }

    // Fallback: search auth users with pagination
    let page = 1
    let found = null
    while (!found && page <= 10) {
      const { data: { users } } = await supabase.auth.admin.listUsers({ page, perPage: 50 })
      if (!users || users.length === 0) break
      found = users.find(u => u.email === email.toLowerCase().trim())
      page++
    }

    if (!found) return res.status(404).json({ error: 'No account found with this email address.' })

    // Update password and link user_id to member
    const { error } = await supabase.auth.admin.updateUserById(found.id, { password })
    if (error) return res.status(500).json({ error: error.message })

    if (member) {
      await supabase.from('members').update({ user_id: found.id }).eq('email', email.toLowerCase().trim())
    }

    return res.status(200).json({ message: 'Password updated successfully' })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
