# Directory Structure

> How frontend code is organized in this project.

---

## Overview

**This project is backend-only** (NestJS monorepo). No frontend application exists in this repository.

If a frontend is added in the future, it would typically live in `apps/web` or `apps/frontend` and follow these conventions:

---

## Future Frontend Directory Layout (Reference)

```
apps/
└── web/                  # (future) React/Next.js frontend
    └── src/
        ├── components/     # Shared UI components
        ├── features/       # Feature-based modules
        ├── hooks/          # Custom React hooks
        ├── lib/            # Utilities and helpers
        ├── pages/          # Next.js pages (if using Pages Router)
        ├── app/            # Next.js app directory (if using App Router)
        └── styles/         # Global styles
```

---

## Current State

All application code in this repository is backend (NestJS). Frontend guidelines are documented here for reference only.
