# Setting up the portal

Every step below that needs you is marked **You:**. Nothing here needs a secret or service-role key. The only key the site uses is the public "publishable" one.

Use a **new, separate Supabase project** for this portal. It holds a client's private answers, and it should not share a database with anything else.

## Accounts you need

**You:** Make these, in this order, using the same new email address for all of them:

1. A Gmail address for the project.
2. A GitHub account (free; private repositories are free).
3. A Supabase account (the free plan works). Sign up with the GitHub account.
4. A Vercel account (the free plan works). Choose **Continue with GitHub**.

Nothing else is needed: no email service, no domain, no payment provider. The client does not make an account. You create her login in step 4 and give it to her.

Two things to know:

- A free Supabase project pauses after about a week with no activity. If that happens, open the dashboard and click **Restore project**. The paid plan avoids it.
- Vercel's free plan is meant for personal, non-commercial use. Check their terms for a client project, or use a paid plan.

Keep your login for the old Supabase project if you want to do steps 15 and 16 below.

## 1. Try it first, with no setup

**You:** In a terminal in this folder, run:

1. `npm install`
2. `npm run dev:demo`
3. Open the address it prints, and sign in as `owner@example.com` with the password `demo`.

This uses sample data and a stand-in database. Nothing is saved anywhere except your browser tab.

## 2. Create the Supabase project

**You:**

1. Go to supabase.com and sign in.
2. Click **New project**.
3. Give it a name, for example `celestial-companions-portal`.
4. Choose a database password. Save it in your password manager. You will not need it again for this setup.
5. Pick the region closest to you and to the client, then click **Create new project**.
6. Wait until the dashboard finishes setting up (a minute or two).

## 3. Switch sign-ups off

**You:**

1. In the project, open **Authentication**, then **Sign In / Providers**.
2. Find **Allow new users to sign up** and turn it **off**.
3. Click **Save** if the page asks you to.

This matters: with sign-ups off, only people you create yourself can ever sign in.

## 4. Create the two accounts

**You:**

1. Open **Authentication**, then **Users**, then **Add user**, then **Create new user**.
2. Enter your own email and a strong password. Tick **Auto Confirm User**. Click **Create user**.
3. Do the same for the client: her email, a strong password, **Auto Confirm User** ticked.
4. Keep both passwords somewhere safe. She can change hers later on the Account page.

## 5. Create the tables and access rules

**You:**

1. Open **SQL Editor**, then **New query**.
2. Open `supabase/schema.sql` from this folder in your editor. Select all, copy.
3. Paste it into the SQL Editor and click **Run**.
4. It should say **Success. No rows returned**. It is safe to run again.

If it says the project already has tables from an older version of the portal, you are in the wrong project. Use the new one from step 2.

## 6. Add the starting content

**You:**

1. In the SQL Editor, click **New query**.
2. Open `supabase/seed.sql`, copy all of it, paste it in, and click **Run**.

It only adds what is missing, so running it again never overwrites anything you have edited in the portal. If you change the text in `content/`, run `npm run seed` first to regenerate the file.

## 7. Add the two people to the portal

**You:**

1. In the SQL Editor, click **New query**, and paste in the contents of `supabase/members.sql`.
2. In the editor (not in the saved file), replace the four `REPLACE-WITH-...` values: your name and email, and the client's name and email. The emails must be the ones you used in step 4. The name is what is shown on the site, for example `Ms Surname`.
3. Click **Run**. The last query in the file lists both people with their roles. You should see one `owner` and one `client`.

## 8. Copy the two settings the site needs

**You:**

1. Open **Project Settings**, then **API** (in newer dashboards, the **Connect** button at the top).
2. Copy the **Project URL**.
3. Copy the **publishable** key (older projects call it the **anon public** key).

Do **not** copy the `service_role` or **secret** key. The site must never have it.

## 9. Run it against the real database on your computer

**You:**

1. Copy the file `.env.example` to a new file called `.env.local`.
2. Paste the Project URL after `VITE_SUPABASE_URL=` and the publishable key after `VITE_SUPABASE_ANON_KEY=`.
3. Run `npm run dev`, open the address it prints, and sign in with your own account.
4. Open **Manage**, then **Demo**, and fill in the live demo's link, version, date and a note. Click **Save**.

## 10. Put it on GitHub

I do not run any git commands, so this part is yours.

**You:**

1. On github.com, click **New repository**. Name it. Choose **Private**, because this is a client project. Do not add a README. Click **Create repository**.
2. In a terminal in this folder, run these one at a time, replacing the address with the one GitHub shows you:
   1. `git init`
   2. `git add .`
   3. `git commit -m "Celestial Companions portal"`
   4. `git branch -M main`
   5. `git remote add origin https://github.com/YOUR-NAME/YOUR-REPO.git`
   6. `git push -u origin main`
3. Check on GitHub that there is no `.env.local` file in the repository. It is listed in `.gitignore`, so there should not be.

## 11. Put it online with Vercel

**You:**

1. Go to vercel.com and sign in.
2. Click **Add New**, then **Project**, and import the repository from step 10.
3. Leave the framework as **Vite**. The build settings are already right.
4. Under **Environment Variables**, add two:
   1. `VITE_SUPABASE_URL`, with the Project URL.
   2. `VITE_SUPABASE_ANON_KEY`, with the publishable key.
5. For each one, set the type to **Config**. Do not choose **Secret**: a secret variable is hidden from the build, and the site would then load with no database connection.
6. Click **Deploy**.
7. Open the address Vercel gives you. You should see the sign-in page.

## 12. Tell Supabase the site's address

**You:**

1. In Supabase, open **Authentication**, then **URL Configuration**.
2. Set **Site URL** to the address from Vercel.
3. Click **Save**.

## 13. Check each role before you hand it over

**You:**

1. Sign in as yourself. You should see **Manage** in the menu.
2. Open a private window and sign in as the client. She should see no **Manage** menu, an answer box on each open question, and no weekly report until you publish one.
3. In **Manage**, then **Documents**, click **Draft this week's report**, read it, and save it. It stays a draft, and the client cannot see it, until you change **Status** to **Published**.

## 14. Send her the details

**You:**

1. Send the site address, and the client's email and password, in a message to her. Do not put the password in the same message as the link if you can avoid it.
2. Use the email thread for this project only. Keep any other project's messages separate.
3. When you publish a weekly report, open it in **Manage** and click **Copy as email** for a first-person email you can paste and send.

## 15. Bring over the answers she already gave (optional)

Only needed if the client already answered questions on the old public report page. Those answers are in a table that another site also uses, so this file only ever reads it.

**You:**

1. Open the old project's **SQL Editor**.
2. From `supabase/copy-old-answers.sql`, run **STEP A** only. It produces one cell of text.
3. Copy that cell. Open the new project's **SQL Editor**, paste it and click **Run**.
4. In the portal, check her answers appear under the right questions.

## 16. Later: tidy up the old comments (optional)

Do this only after the client is using the new portal, and you have checked her answers came across.

**You:**

1. Open the old project's **SQL Editor**.
2. Run the first query in `supabase/cleanup-old-comments.sql`. It only counts the rows.
3. If the numbers look right, run the last query in that file.

That file only touches rows whose report starts with `ccom-`. It never drops or changes the table or its functions, because another site depends on them.

## Checks that have been run

- `npm run test:db`: the access rules and the seed, on a local Postgres.
- `npm run test:e2e`: the browser tests, in Microsoft Edge.
- `npm run check:build`: the production build has no demo code and no page content.
