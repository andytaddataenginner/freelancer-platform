# Deploy the QFA React preview from the feature branch

This frontend is isolated in `frontend/`. Deploy it as a **new Render Static Site**. Do not merge the branch and do not change the existing Render Node.js API service.

## Render dashboard settings

Create a new **Static Site** and connect the existing GitHub repository:

| Setting | Value |
|---|---|
| Repository | `andytaddataenginner/freelancer-platform` |
| Branch | `feature/react-migration` |
| Root Directory | `frontend` |
| Build Command | `npm install && npm run build` |
| Publish Directory | `dist` |

Add this environment variable:

| Key | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://freelancer-platform-9jut.onrender.com/api` |

Keep the existing Node API service running as-is. The React app sends API requests to that service and uses its existing login tokens and business endpoints.

## SPA route fallback

In the new Static Site's **Redirects/Rewrites** settings, add:

| Source | Destination | Action |
|---|---|---|
| `/*` | `/index.html` | Rewrite |

This is required so direct visits and browser refreshes on routes such as `/dashboard`, `/clients` and `/client-portal` load the React app.

## Optional Blueprint deployment

A root `render.yaml` is included on this branch. You can use Render's Blueprint flow to create the separate static site from this branch. Review the proposed resource before applying it; it defines a new static site named `qfa-react-preview` and does not replace the existing API service.

## Before testing

1. Confirm the Static Site build succeeds.
2. Open the public homepage and verify logo, founder photo and resume preview/download load.
3. Sign in with a test QFA freelancer account; confirm dashboard and every workspace route.
4. Test a client account separately; confirm it is redirected to the client portal.
5. Test a contact submission, portfolio listing and all CRUD/payment workflows using test records.
6. Check browser console and network requests for failed API calls.

Do not merge to `main` or switch the production domain until you are satisfied with testing.
