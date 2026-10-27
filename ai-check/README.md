# AI Visibility Check

Free tool at https://aiyun.com.au/ai-check/ that checks whether AI search engines and assistants can find, read and recommend a business website.

## How it fits together

| Part | Where it runs | Files |
| --- | --- | --- |
| The page | GitHub Pages (this repo, as today) | `ai-check/index.html`, `ai-check/config.js` |
| Website scan | Vercel function | `api/scan.js`, `api/_lib/scan.js` |
| "Does AI recommend you?" step | Vercel function, calls the Claude API | `api/visibility.js`, `api/_lib/visibility.js` |

A browser can't read another site's robots.txt or sitemap directly, so the scan runs on Vercel. The page calls it at the address in `ai-check/config.js`.

## Switch it on (about 10 minutes)

1. **Deploy the API to Vercel.** On vercel.com: Add New → Project → import `Superevh/aiyun`. Name the project `aiyun-check`, leave Framework as "Other", no build command, Deploy.
2. **Check the address.** Open `https://aiyun-check.vercel.app/api/visibility`. You should see `{"enabled":false}`. If Vercel gave the project a different address, put that address in `ai-check/config.js`.
3. **Try it.** Open https://aiyun.com.au/ai-check/ and check a site. The website scan works now. Step 2 shows "switching on soon" until you add a key.
4. **Optional: switch on step 2.** Create a key at console.anthropic.com and set a monthly spend limit there first. Then in Vercel: Project → Settings → Environment Variables → add `ANTHROPIC_API_KEY`, and redeploy.

## Settings (Vercel environment variables, all optional)

| Name | Default | What it does |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | none | Turns on step 2 |
| `ANTHROPIC_MODEL` | `claude-haiku-5-5` | Model used for step 2 |
| `VIS_PER_IP_PER_DAY` | 3 | Step 2 runs per visitor per day (best effort) |
| `VIS_PER_DAY` | 150 | Step 2 runs per day per server instance (best effort) |
| `ALLOWED_ORIGINS` | aiyun.com.au + localhost | Sites allowed to call the API |

The rate limits live in memory, so they are a speed bump, not a guarantee. The spend limit in the Anthropic console is the real cost guard.

## Notes

- The scanner identifies itself as `AIYunCheck/1.0` and never disguises itself. If a site's firewall turns it away, the report says so.
- Nothing is stored: no database, no logs of results beyond Vercel's standard request logs.
- Vercel's free Hobby plan is meant for non-commercial use. If this becomes part of paid work, move to Vercel Pro or Cloudflare Workers; the code in `api/_lib/` only uses web-standard APIs, so it ports as is.
