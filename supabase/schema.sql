-- ═══════════════════════════════════════════════════════════════
-- CHeSS Website Database Schema for Supabase
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════

-- ─── Members / User Profiles ───────────────────────────────────
create table public.members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  degrees text,
  email text,
  specialty text,
  province text,
  institution text,
  positions text,
  bio text,
  referral_info text,
  research text,
  photo_url text,
  directory_visible boolean default false,
  status text default 'pending' check (status in ('pending', 'full', 'trainee', 'rejected')),
  role text default 'member',
  member_since date,
  created_at timestamptz default now()
);

-- ─── Sessions (Case Conferences) ──────────────────────────────
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  session_date date not null,
  session_time time default '12:00',
  session_type text default 'Didactic' check (session_type in ('Didactic', 'Case', 'Debate')),
  presenter text,
  description text,
  cme_hours numeric(4,2) default 1.25,
  created_at timestamptz default now()
);

-- ─── Publications / Academic Work ──────────────────────────────
create table public.publications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  authors text,
  journal text,
  year text,
  doi text,
  url text,
  pub_type text default 'published' check (pub_type in ('published', 'position_statement', 'abstract', 'ongoing')),
  status text,
  description text,
  created_at timestamptz default now()
);

-- ─── Executive Summaries ───────────────────────────────────────
create table public.summaries (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary_date text,
  excerpt text,
  tags text[],
  pdf_url text,
  created_at timestamptz default now()
);

-- ─── CME Records ───────────────────────────────────────────────
create table public.cme_records (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete cascade,
  attended boolean default false,
  survey_token text unique,
  survey_sent_at timestamptz,
  survey_completed_at timestamptz,
  survey_expires_at timestamptz,
  certificate_generated boolean default false,
  created_at timestamptz default now(),
  unique(member_id, session_id)
);

-- ─── Session Evaluations (CPD Form) ───────────────────────────
create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete cascade,
  eval_token text unique,
  eval_sent_at timestamptz,
  eval_completed_at timestamptz,
  eval_expires_at timestamptz,
  -- Activity ratings (1-5, strongly disagree to strongly agree)
  rating_objectives int,
  rating_knowledge int,
  rating_expectations int,
  rating_practice int,
  rating_interaction int,
  rating_bias int,
  -- Presenter ratings (1-5, poor to excellent)
  rating_pres_effectiveness int,
  rating_pres_content int,
  rating_pres_methods int,
  -- Text fields
  practice_impact text,
  canmeds_roles text,
  comments text,
  suggestions text,
  created_at timestamptz default now(),
  unique(member_id, session_id)
);

-- ─── Industry Partners ────────────────────────────────────────
create table public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  focus_areas text,
  tier text default 'silver' check (tier in ('platinum', 'gold', 'silver')),
  academic_year text default '2026-27',
  logo_url text,
  created_at timestamptz default now()
);

-- ─── Row Level Security ───────────────────────────────────────
-- Public read access for published content
alter table public.members enable row level security;
alter table public.sessions enable row level security;
alter table public.publications enable row level security;
alter table public.summaries enable row level security;
alter table public.partners enable row level security;
alter table public.cme_records enable row level security;
alter table public.evaluations enable row level security;

-- Anyone can read public data
create policy "Public read sessions" on public.sessions for select using (true);
create policy "Public read publications" on public.publications for select using (true);
create policy "Public read summaries" on public.summaries for select using (true);
create policy "Public read partners" on public.partners for select using (true);
create policy "Public read visible members" on public.members for select using (directory_visible = true or status = 'pending');

-- Authenticated users can read all members and their own CME/eval data
create policy "Auth read all members" on public.members for select to authenticated using (true);
create policy "Auth read own cme" on public.cme_records for select to authenticated using (member_id in (select id from public.members where user_id = auth.uid()));
create policy "Auth read own evals" on public.evaluations for select to authenticated using (member_id in (select id from public.members where user_id = auth.uid()));

-- Members can update their own CME and eval records (submit surveys)
create policy "Auth update own cme" on public.cme_records for update to authenticated using (member_id in (select id from public.members where user_id = auth.uid()));
create policy "Auth update own evals" on public.evaluations for update to authenticated using (member_id in (select id from public.members where user_id = auth.uid()));

-- Anyone can insert a pending member application
create policy "Public insert member application" on public.members for insert with check (status = 'pending');

-- Admin policies (users with role = 'admin' in members table)
-- For simplicity, admins are identified by having role = 'admin' in the members table
create policy "Admin full access sessions" on public.sessions for all to authenticated using (exists (select 1 from public.members where user_id = auth.uid() and role = 'admin'));
create policy "Admin full access publications" on public.publications for all to authenticated using (exists (select 1 from public.members where user_id = auth.uid() and role = 'admin'));
create policy "Admin full access summaries" on public.summaries for all to authenticated using (exists (select 1 from public.members where user_id = auth.uid() and role = 'admin'));
create policy "Admin full access partners" on public.partners for all to authenticated using (exists (select 1 from public.members where user_id = auth.uid() and role = 'admin'));
create policy "Admin full access members" on public.members for all to authenticated using (exists (select 1 from public.members where user_id = auth.uid() and role = 'admin'));
create policy "Admin full access cme" on public.cme_records for all to authenticated using (exists (select 1 from public.members where user_id = auth.uid() and role = 'admin'));
create policy "Admin full access evals" on public.evaluations for all to authenticated using (exists (select 1 from public.members where user_id = auth.uid() and role = 'admin'));

-- ─── Seed Data: Board Members ──────────────────────────────────
insert into public.members (name, degrees, specialty, province, institution, bio, role, status, directory_visible, member_since) values
('Dr. Jennifer Ringrose', 'MD, MSc, FRCPC', 'General Internal Medicine', 'Alberta', 'University of Alberta', 'Associate Professor of Medicine and General Internist at the University of Alberta. She directs the GIM Residency Program and co-founded mmHg Inc. Her research focuses on improving the accuracy of blood pressure measurement.', 'admin', 'full', true, '2022-01-01'),
('Dr. Lisa Dubrofsky', 'MDCM, FRCPC', 'Nephrology', 'Ontario', 'Women''s College Hospital / Sunnybrook HSC', 'Assistant Professor in the Division of Nephrology at the University of Toronto. Certified Hypertension Specialist (ASH) with advanced training in Cardiology-Renal-Endocrine care. Research focuses on improving quality of care for complex hypertension.', 'admin', 'full', true, '2022-01-01'),
('Dr. Karen Tran', 'MD, MHSc, FRCPC', 'General Internal Medicine', 'British Columbia', 'Vancouver General Hospital / UBC', 'Clinical Assistant Professor at UBC and co-director of the VGH Hypertension Clinic. Completed hypertension fellowship at McGill. Serves on Hypertension Canada guideline committee for resistant hypertension and BP measurement.', 'admin', 'full', true, '2022-01-01'),
('Dr. Apoorva Bollu', 'MD, FRCPC', 'General Internal Medicine', 'British Columbia', 'University of British Columbia', 'General Internist at UBC involved in hypertension specialist care. Contributed to the national survey characterizing hypertension specialist practice patterns across Canada.', 'admin', 'full', true, '2022-01-01'),
('Dr. Iulia Iatan', 'MD, PhD, FRCPC', 'General Internal Medicine', 'Quebec', 'McGill University', 'Physician Scientist at McGill University. MD from Laval, PhD from McGill studying cholesterol metabolism. Interests span cardiometabolic health, inherited lipid disorders, and cardiovascular genetics.', 'admin', 'full', true, '2022-01-01'),
('Dr. Jesse Bittman', 'MD, FRCPC', 'General Internal Medicine', 'British Columbia', 'University of British Columbia', 'General Internist in Community Internal Medicine at UBC. Active in hypertension education and co-director of communications for CHeSS.', 'admin', 'full', true, '2022-01-01'),
('Dr. Sachin Pasricha', 'MD, FRCPC', 'Nephrology', 'Ontario', 'Sunnybrook Health Sciences Centre', 'Eastern Representative and mentor for physicians transitioning to hypertension practice. Research includes hypertension treatment and control in Canadians with diabetes.', 'admin', 'full', true, '2022-01-01'),
('Dr. Nadia Khan', 'MD, MSc, FRCPC', 'General Internal Medicine', 'British Columbia', 'University of British Columbia', 'Professor of Medicine at UBC and a leading figure in Canadian hypertension research. Has served on Hypertension Canada guideline committees for over two decades.', 'member', 'full', true, '2022-01-01'),
('Dr. Sheldon Tobe', 'MD, FRCPC', 'Nephrology', 'Ontario', 'Sunnybrook Health Sciences Centre / U of T', 'Professor of Medicine at U of T and NOSM. Associate scientist at Sunnybrook Research Institute. Research focuses on improving lives of people with or at risk of kidney disease through hypertension control.', 'member', 'full', true, '2022-01-01'),
('Dr. Raj Padwal', 'MD, MSc, FRCPC', 'General Internal Medicine', 'Alberta', 'University of Alberta', 'Director of the University of Alberta Hypertension Clinic specializing in resistant and secondary hypertension. Research focuses on BP measurement technology. Received Hypertension Canada Senior Investigator Award 2014.', 'member', 'full', true, '2022-01-01'),
('Dr. Ross Feldman', 'MD, FRCPC', 'Cardiology', 'Manitoba', 'St. Boniface Hospital / University of Manitoba', 'Affiliated with Cardiac Sciences at St. Boniface Hospital. Longstanding contributor to Canadian hypertension guidelines and research on national hypertension control strategies.', 'member', 'full', true, '2022-01-01');

-- ─── Seed Data: Sample Sessions ────────────────────────────────
insert into public.sessions (title, session_date, session_time, session_type, presenter, cme_hours) values
('Renal Denervation: Where Do We Stand in 2026?', '2026-05-14', '12:00', 'Didactic', 'Dr. Connor Walsh', 1.25),
('The Young Patient with Severe Hypertension', '2026-06-11', '12:00', 'Case', 'Dr. Meera Kapoor & Dr. Jennifer Ringrose', 1.25),
('To Screen or Not to Screen: Universal PA Testing', '2026-07-09', '12:00', 'Debate', 'Dr. Alexander Leung vs. Dr. Fady Hannah-Shmouni', 1.25),
('Resistant HTN: Triple Therapy Failure — Now What?', '2026-04-09', '12:00', 'Case', 'Dr. Nadia Khan', 1.25),
('2025 Hypertension Canada Guidelines Update', '2026-03-12', '12:00', 'Didactic', 'Dr. Karen Tran', 1.25),
('Pheochromocytoma Masquerading as Panic Disorder', '2026-02-12', '12:00', 'Case', 'Dr. Alexander Leung', 1.25);

-- ─── Seed Data: Publications ───────────────────────────────────
insert into public.publications (title, authors, journal, year, doi, pub_type, status) values
('Characterizing Hypertension Specialist Care in Canada: A National Survey', 'Lui S, Dubrofsky L, Khan NA, Tobe SW, ... Ringrose J, et al.', 'CJC Open', '2023', '10.1016/j.cjco.2023.08.014', 'published', 'Published'),
('The Role of Renal Denervation in the Treatment of Hypertension in Canada', 'Padwal RS, Dorsch M, Tobe S, Ringrose J, Schiffrin EL, Feldman RD, ... Khan N', 'American Journal of Hypertension', '2025', '10.1093/ajh/hpaf236', 'position_statement', 'Published'),
('Hypertension Canada Statement on Cuffless BP Monitoring Devices', 'Landry C, Dubrofsky L, Pasricha SV, ... Ringrose J, et al.', 'Canadian Journal of Cardiology', '2024', '', 'position_statement', 'Published'),
('National Registry of Renal Denervation Outcomes', 'CHeSS Collaborative', '', '', '', 'ongoing', 'Data collection'),
('Canadian Consensus on Secondary HTN Evaluation', 'Ringrose J, Dubrofsky L, Tran K, et al.', '', '', '', 'ongoing', 'Drafting');

-- ─── Seed Data: Partners ───────────────────────────────────────
insert into public.partners (name, description, focus_areas, tier, academic_year) values
('Servier Canada', 'Global pharmaceutical company with a longstanding commitment to cardiovascular medicine and hypertension research.', 'Antihypertensive therapeutics, cardiovascular outcomes research', 'platinum', '2026-27'),
('Medtronic Canada', 'Global leader in medical technology supporting innovation in renal denervation and catheter-based hypertension interventions.', 'Renal denervation devices, cardiovascular device innovation', 'platinum', '2026-27'),
('Bayer Canada', 'Supports CHeSS through educational grants focused on mineralocorticoid receptor antagonists and primary aldosteronism screening.', 'MRA therapeutics, aldosterone-mediated hypertension', 'gold', '2026-27'),
('AstraZeneca Canada', 'Collaborates on educational initiatives related to cardiorenal protection and SGLT2 inhibitors in hypertensive patients.', 'SGLT2 inhibitors, cardiorenal medicine', 'gold', '2026-27'),
('OMRON Healthcare Canada', 'Supports initiatives in ambulatory and home blood pressure monitoring education.', 'BP monitoring devices, home BP validation studies', 'silver', '2026-27'),
('Novartis Canada', 'Partners on educational programming related to emerging combination therapies and fixed-dose antihypertensive regimens.', 'Combination antihypertensive therapy, adherence research', 'silver', '2026-27');
