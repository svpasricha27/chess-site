import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) return res.status(500).json({ error: 'Not configured' })

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const { member_id, user_id, email } = req.body
  if (!member_id) return res.status(400).json({ error: 'member_id required' })

  // Step 1: Delete from members table (also cascades to cme_records, evaluations, leadership)
  const { error: memberError } = await supabase.from('members').delete().eq('id', member_id)
  if (memberError) {
    return res.status(500).json({ error: 'Failed to delete member: ' + memberError.message })
  }

  // Step 2: Delete auth user
  let authDeleted = false
  try {
    // Try by user_id first
    if (user_id) {
      const { error } = await supabase.auth.admin.deleteUser(user_id)
      if (!error) authDeleted = true
    }

    // If no user_id or that failed, find by email
    if (!authDeleted && email) {
      const { data: { users } } = await supabase.auth.admin.listUsers()
      const authUser = users?.find(u => u.email === email)
      if (authUser) {
        const { error } = await supabase.auth.admin.deleteUser(authUser.id)
        if (!error) authDeleted = true
      }
    }
  } catch (e) {
    // Auth deletion failed but member record is already gone
    console.log('Auth deletion error:', e.message)
  }

  return res.status(200).json({
    message: 'Account deleted.',
    member_deleted: true,
    auth_deleted: authDeleted
  })
}
