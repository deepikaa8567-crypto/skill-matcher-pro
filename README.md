# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

## Deploying to Vercel (via GitHub)

1. Push this project to GitHub (in Lovable: **+ menu → GitHub → Connect project**).
2. In Vercel, **Add New → Project** and import the repository. Framework preset: **Vite** (the build script is `npm run build`).
3. Add these Environment Variables in Vercel (Production + Preview):

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key |
| `VITE_SUPABASE_PROJECT_ID` | Supabase project ref |
| `SUPABASE_URL` | same as above |
| `SUPABASE_PUBLISHABLE_KEY` | same anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (server only) |
| `GROQ_API_KEY` | Groq API key |

4. Deploy. Then in Supabase → Authentication → URL Configuration, add the Vercel URL to **Site URL** and **Redirect URLs**.

Mentor access: open the deployed URL and click **Try the demo (no signup)**.
