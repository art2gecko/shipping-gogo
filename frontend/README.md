# ShipGo Frontend - Fulfillment Dashboard

Internal dashboard for the Fulfillment Orchestrator system. Built with React + TypeScript + Vite.

## Tech Stack

- **React 19** + **TypeScript** + **Vite**
- **TailwindCSS v4** for styling
- **React Router v7** for routing
- **TanStack Query v5** for API data fetching/caching
- **Zustand v5** for lightweight UI state
- **Zod** for form validation
- **Radix UI** primitives (shadcn/ui style)
- **lucide-react** for icons

## Getting Started

### Prerequisites

- Node.js 18+
- Backend API running (default: `http://localhost:3000`)

### Install & Run

```bash
cd frontend
npm install
npm run dev
```

The dev server starts at `http://localhost:5173` and proxies API requests to `http://localhost:3000`.

### Environment Variables

Create a `.env` file:

```env
# Leave empty to use Vite proxy (recommended for dev)
VITE_API_URL=

# For production, set to the backend URL
# VITE_API_URL=https://api.yoursite.com
```

### Build for Production

```bash
npm run build
npm run preview  # Preview the build locally
```

Output goes to `dist/`.

## Project Structure

```
src/
├── components/       # Shared UI components
│   └── ui/          # Base UI primitives (button, card, dialog, etc.)
├── pages/           # Page components
├── routes/          # Router configuration
├── hooks/           # React Query hooks, toast hook
├── lib/             # API client, utilities
├── types/           # TypeScript types (mirrors Prisma schema)
└── store/           # Zustand stores (auth, UI)
```

## Pages

| Page | Route | Description |
|------|-------|-------------|
| Login | `/login` | Username/password authentication |
| Dashboard | `/` | KPI cards, daily automation, audit log |
| Orders | `/orders` | Filterable order table with actions |
| Order Detail | `/orders/:id` | Full order view with items, documents, exceptions |
| Batches | `/batches` | Batch management with create wizard |
| Batch Detail | `/batches/:id` | Batch orders, pick list/manifest generation |
| Exceptions | `/exceptions` | Exception queue with resolve actions |
| Serial Capture | `/serial-capture` | Warehouse barcode scanning mode |
| Documents | `/documents` | Document list with download links |
| Settings | `/settings` | System config, user management |

## API Integration

All API calls go through `src/lib/api.ts`. React Query hooks in `src/hooks/use-api.ts` provide caching, loading states, and error handling.

The dev server proxies `/api/*` requests to the backend, so no CORS configuration is needed during development.
