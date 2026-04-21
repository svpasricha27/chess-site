# CHeSS Website — Canadian Hypertension Specialists Society

A complete website for CHeSS built with React + Vite, deployable to Vercel in minutes. Optionally connects to Supabase for persistent data, authentication, and admin capabilities.

## Quick Deploy (5 minutes — no backend needed)

The site works immediately in **demo mode** with sample data. You can deploy it right now and add the database later.

### Step 1: Push to GitHub

1. Create a new repository on [github.com](https://github.com/new) called `chess-site`
2. On your computer, open a terminal and run:
   ```bash
   cd chess-site
   git init
   git add .
   git commit -m "Initial CHeSS website"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/chess-site.git
   git push -u origin main
   ```

### Step 2: Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign up with your GitHub account
2. Click **"Add New Project"**
3. Import your `chess-site` repository
4. Vercel auto-detects it's a Vite project — just click **"Deploy"**
5. In ~60 seconds you'll have a live URL like `chess-site-abc123.vercel.app`

**That's it.** Your site is live. The demo mode shows all pages with sample data, working navigation, member login simulation, admin panel, and all interactive features.

### Step 3: Add a Custom Domain (optional)

1. In Vercel, go to your project → **Settings → Domains**
2. Add your domain (e.g., `chess-hypertension.ca`)
3. Update your domain's DNS to point to Vercel (Vercel shows you the exact records)
4. SSL certificate is automatic

---

## Adding Supabase for Real Data (When Ready)

When you want real member login, persistent data, and admin CRUD, add Supabase (free tier handles everything CHeSS needs).

### Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up (free)
2. Click **"New Project"**
3. Name it `chess-site`, set a database password (save it!), choose a region close to Canada (US East)
4. Wait ~2 minutes for it to provision

### Step 2: Set Up the Database

1. In your Supabase project, go to **SQL Editor** (left sidebar)
2. Click **"New Query"**
3. Open the file `supabase/schema.sql` from this project
4. Copy the entire contents and paste it into the SQL editor
5. Click **"Run"**

This creates all tables (members, sessions, publications, evaluations, CME records, partners) AND seeds them with your real board member data and sample sessions.

### Step 3: Enable Authentication

1. In Supabase, go to **Authentication → Providers**
2. Email provider is enabled by default — that's all you need
3. Go to **Authentication → URL Configuration**
4. Set **Site URL** to your Vercel URL (e.g., `https://chess-site.vercel.app`)

### Step 4: Connect to Your Site

1. In Supabase, go to **Settings → API**
2. Copy the **Project URL** and **anon public** key
3. In Vercel, go to your project → **Settings → Environment Variables**
4. Add two variables:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon key
5. Click **Redeploy** in Vercel (Deployments tab → three dots → Redeploy)

Your site now reads from Supabase. The demo data is replaced by your real database.

### Step 5: Create Your Admin Account

1. In Supabase, go to **Authentication → Users → Add User**
2. Enter your email and a password, click **Create User**
3. Copy the User UID shown
4. Go to **Table Editor → members**
5. Find your board member row (e.g., Dr. Ringrose) and set the `user_id` column to the UID you copied
6. Ensure the `role` column says `admin`

Now you can log in on the site with full admin privileges.

---

## Day-to-Day Admin Tasks (No Code Needed)

Once Supabase is connected, all content management happens through the **Supabase Dashboard** at [supabase.com/dashboard](https://supabase.com/dashboard). It's like a spreadsheet for your database.

### Add a New Session
1. Go to **Table Editor → sessions**
2. Click **Insert Row**
3. Fill in: title, session_date, session_time, session_type (Didactic/Case/Debate), presenter, cme_hours
4. Click **Save** — it appears on the site instantly

### Approve a New Member
1. Go to **Table Editor → members**
2. Find the row with `status = 'pending'`
3. Review their info, then change `status` to `full` (or `trainee`)
4. Set `directory_visible` to `true` if they opted in
5. Click **Save**

### Add a Publication
1. Go to **Table Editor → publications**
2. Click **Insert Row**
3. Fill in: title, authors, journal, year, doi, pub_type (published/ongoing/position_statement), status
4. Click **Save**

### Upload an Executive Summary
1. Go to **Table Editor → summaries**
2. Click **Insert Row**
3. Fill in: title, summary_date, excerpt, tags (as array like `{HTN,CKD}`)
4. For the PDF, upload it to **Storage** first, get the public URL, paste in `pdf_url`

### Export Data
1. Go to **Table Editor**, select any table (members, sessions, cme_records, evaluations)
2. Click the **Export** button (top right) → **Download as CSV**
3. Repeat for each table you need

---

## Project Structure

```
chess-site/
├── public/
│   └── CHeSSlogo.jpg          # Your CHeSS logo
├── src/
│   ├── main.jsx               # React entry point
│   ├── supabase.js            # Supabase client (auto-detects demo mode)
│   └── App.jsx                # Complete application (~900 lines)
├── supabase/
│   └── schema.sql             # Database tables + seed data
├── index.html                 # HTML shell
├── package.json               # Dependencies
├── vite.config.js             # Build config
├── vercel.json                # Vercel routing config
├── .env.example               # Environment variable template
└── README.md                  # This file
```

## Cost

| Service | Cost |
|---------|------|
| Vercel (hosting) | Free (hobby tier) |
| Supabase (database + auth) | Free (up to 500MB, 50K users) |
| Domain (.ca) | ~$15 CAD/year |
| **Total** | **~$15 CAD/year** |

## Local Development

```bash
npm install
cp .env.example .env          # Edit with your Supabase credentials (optional)
npm run dev                   # Opens at http://localhost:5173
```

## Future Enhancements

When you're ready to add more automation:

- **Automated CME emails**: Use Supabase Edge Functions + Resend (free tier: 3,000 emails/month) to auto-send surveys after sessions
- **ICS Calendar feed**: Add a Vercel serverless function at `/api/calendar.ics` that queries sessions and generates the feed
- **PDF certificates**: Use a Vercel serverless function with `@react-pdf/renderer` to generate certificates on demand
- **Photo uploads**: Use Supabase Storage (included in free tier) for member profile photos

All of these can be added incrementally without changing the existing site.
