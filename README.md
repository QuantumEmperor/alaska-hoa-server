# HOA Next Door — server

This is the small program that saves sign-ups to your MongoDB database
and checks passwords when someone logs in. It's meant to run online
(not on your own computer) so the app page can reach it at all times.

## What's inside

- `server.js` — starts the server
- `routes/auth.js` — sign up, log in, and the admin-only list of everyone registered
- `models/Registration.js` — what each sign-up record looks like
- `middleware/auth.js` — checks who's logged in, and that only you can see everyone's data

## Setting it up on Render (free)

1. Go to [render.com](https://render.com) and sign up (you can use your GitHub account or email).
2. Put this `hoa-server` folder in its own GitHub repository. (If you're not
   already using GitHub, say so and I'll walk you through that part.)
3. In Render, choose **New > Web Service**, and connect that repository.
4. Build command: `npm install`. Start command: `npm start`.
5. Under **Environment**, add these variables (copy the names exactly):
   - `MONGODB_URI` — your real connection string, with your real password in it
   - `JWT_SECRET` — a long random string (Render can generate one for you)
   - `ADMIN_EMAIL` — surrealblues@gmail.com
   - `ALLOWED_ORIGIN` — `*` for now; change once your app has a permanent address
6. Click **Create Web Service**. Render will show a live log while it builds and starts.
7. Once it says something like "HOA Next Door server running," copy the address
   Render gives your service (it'll look like `https://hoa-next-door.onrender.com`)
   and send it to me — I'll connect the app to it.

## One more step back in MongoDB Atlas

Render's servers don't have one fixed IP address, so in Atlas, under
**Network Access**, add `0.0.0.0/0` ("allow access from anywhere"). This
is safe here because the database still requires the correct username
and password — this setting only controls which computers are allowed
to *try* to connect.

## Never do this

- Never commit the real `.env` file to GitHub — `.gitignore` already excludes it.
- Never send me your database password, `JWT_SECRET`, or the "service_role"-style keys.
- Only `MONGODB_URI` (with the password filled in) needs to live in Render's
  environment settings, not in any file you upload elsewhere.
