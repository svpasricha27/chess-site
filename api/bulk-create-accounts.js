import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Service role key not configured' })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // Get all members without a user_id
  const { data: members } = await supabase
    .from('members')
    .select('id, name, email')
    .is('user_id', null)
    .not('email', 'is', null)

  if (!members || members.length === 0) {
    return res.status(200).json({ message: 'No members need accounts', created: 0 })
  }

  let created = 0
  let skipped = 0
  let errors = []

  for (const m of members) {
    try {
      const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
        email: m.email,
        password: 'test',
        email_confirm: true,
      })

      if (createError) {
        if (createError.message.includes('already been registered')) {
          // Find existing auth user and link
          const { data: { users } } = await supabase.auth.admin.listUsers()
          const existing = users?.find(u => u.email === m.email)
          if (existing) {
            await supabase.from('members').update({ user_id: existing.id }).eq('id', m.id)
            skipped++
          } else {
            errors.push({ email: m.email, error: 'Already registered but not found' })
          }
        } else {
          errors.push({ email: m.email, error: createError.message })
        }
        continue
      }

      if (authUser?.user?.id) {
        await supabase.from('members').update({ user_id: authUser.user.id }).eq('id', m.id)
        created++
      }
    } catch (e) {
      errors.push({ email: m.email, error: e.message })
    }
  }

  return res.status(200).json({
    message: `Created ${created} accounts, ${skipped} already existed, ${errors.length} errors`,
    created,
    skipped,
    total: members.length,
    errors: errors.slice(0, 20)
  })
}
