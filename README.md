<<<<<<< HEAD
# MarketMuse AI (Vite + Supabase Google Auth)

A minimal React (Vite) app wired to Supabase Auth (Google OAuth) with a `profiles` table storing per-user data like `tokens_remaining`.

## Features
- Google sign-in via Supabase Auth (client-side OAuth)
- A `profiles` table keyed by `user_id` (auth user id)
- Automatic profile creation via DB trigger (recommended) or fallback client upsert
- Simple UI showing email, display name, and tokens remaining

---

## Prerequisites
- Node.js 18+ and npm
- Git (optional, for cloning)
- A Supabase project
- A Google Cloud project with OAuth client (Web application)

---

## 1) Environment variables
Create a `.env` file in the project root (do NOT commit secrets):

```
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

Where to find these:
- Supabase Dashboard → Project Settings → API → Project URL and anon public key

Optional: add a public `.env.example` with placeholder values.

---

## 2) Supabase database setup
Open Supabase Dashboard → SQL → New query, and run the SQL below. This creates a robust `profiles` table, a trigger to auto-create a profile on new user signup, and safe RLS policies.

Create table:
```sql
create extension if not exists pgcrypto;

create table if not exists public.profiles (
	user_id uuid primary key,          -- matches auth.users.id
	email text unique,
	full_name text,
	avatar_url text,
	tokens_remaining int default 0,
	created_at timestamptz default now()
);
```

Trigger function + trigger (auto-create profile on signup):
```sql
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql as $$
begin
	declare name_text text;
	begin
		name_text := null;
		if new.raw_user_meta_data is not null then
			name_text := coalesce(
				new.raw_user_meta_data->>'full_name',
				new.raw_user_meta_data->>'name',
				new.raw_user_meta_data->>'display_name',
				new.raw_user_meta_data->>'given_name',
				null
			);
		end if;
		if name_text is null then
			name_text := new.email;
		end if;

		insert into public.profiles (user_id, email, full_name, created_at)
		values (new.id, new.email, name_text, now())
		on conflict (user_id) do nothing;

		return new;
	end;
end;
$$;

drop trigger if exists auth_user_created on auth.users;
create trigger auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();
```

Enable RLS and add policies:
```sql
alter table public.profiles enable row level security;

create policy "Allow logged-in select" on public.profiles
	for select
	using ( auth.role() = 'authenticated' and auth.uid() = user_id );

create policy "Allow logged-in insert" on public.profiles
	for insert
	with check ( auth.role() = 'authenticated' and auth.uid() = user_id );

create policy "Allow logged-in update" on public.profiles
	for update
	using ( auth.role() = 'authenticated' and auth.uid() = user_id )
	with check ( auth.role() = 'authenticated' and auth.uid() = user_id );
```

If you see errors mentioning missing columns (e.g., `full_name`) ensure the table schema matches the trigger and client code. Add columns with:
```sql
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists tokens_remaining int default 0;
```

---

## 3) Google OAuth setup
In Google Cloud Console → Credentials → Create OAuth Client ID (Web application):
1. Authorized redirect URI:
	 - `https://<your-project-ref>.supabase.co/auth/v1/callback`
2. Copy the Client ID and Client Secret.
3. Supabase Dashboard → Authentication → Settings → External OAuth Providers → Google:
	 - Paste Client ID and Secret, Save.

Notes:
- If you use additional redirectTo or custom domains, configure them accordingly. For client-only flows, the Supabase callback above is sufficient.

---

## 4) Install and run locally
```powershell
npm install
npm run dev
```
- Vite will start on http://localhost:5173 (or the next free port).
- Click “Sign in with Google”.

---

## 5) Project structure (key files)
```
.
├─ index.html
├─ package.json
├─ supabaseClient.js          # creates Supabase browser client using VITE_* env
├─ src/
│  ├─ main.jsx                # React/Vite entry
│  ├─ App.jsx                 # UI + auth/session + profile fetch/upsert
│  ├─ App.css, index.css
│  └─ assets/
└─ public/
```

`src/App.jsx` does:
- Reads session from `supabase.auth.getSession()` and via `onAuthStateChange`.
- Fetches `profiles` by `user_id` (must match the DB schema).
- Shows email/display name and tokens_remaining.
- Has a fallback upsert to create a profile if none exists (default tokens 10).

---

## 6) Troubleshooting

“Database error saving new user” in Supabase logs
- Cause: a trigger/insert failed (often due to missing column like `full_name`).
- Fix: ensure `profiles` schema matches your trigger; add missing columns (see SQL above), or adjust trigger to use the correct column names.

Tokens Remaining stuck at “Loading…”
- Ensure `profiles` has a row for the user. Confirm in Table Editor.
- Verify the app queries by `user_id` (matches `auth.users.id`).
- If needed, keep the fallback upsert in `App.jsx` to create a row client-side.

Sign out not updating UI immediately
- The app now clears local state right after `supabase.auth.signOut()` for a snappy UI.
- Check browser console for `signOut error` if it doesn’t update.

Wrong Supabase project or keys
- Confirm `.env` `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` match the project where you ran the SQL and enabled Google.

Port already in use
- Vite will choose the next free port automatically (e.g., 5174). Use the printed URL.

---

## 7) Build for production
```powershell
npm run build
npm run preview
```

---

## 8) Deploy (optional)
You can deploy via any static host (Netlify, Vercel, GitHub Pages). Ensure environment variables are set in your host and point to the same Supabase project.

---

## 9) Security notes
- Do not commit `.env` or secrets. Use `.gitignore` to exclude them.
- Rotate keys in Supabase if a secret was exposed.

---

## License
MIT (or your preferred license)

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh
>>>>>>> 9d7a74c (Initial Commit)
