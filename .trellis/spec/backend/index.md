# Backend Development Guidelines

> Best practices for backend development in this project.

---

## Overview

This directory contains guidelines for backend development. This is a **NestJS monorepo** with three apps (`gateway`, `order-service`, `user-service`) and two shared libs (`database`, `common`).

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Module organization and file layout | ✅ Filled |
| [Database Guidelines](./database-guidelines.md) | ORM patterns, queries, migrations | ✅ Filled |
| [Error Handling](./error-handling.md) | Error types, handling strategies | ✅ Filled |
| [Quality Guidelines](./quality-guidelines.md) | Code standards, forbidden patterns | ✅ Filled |
| [Logging Guidelines](./logging-guidelines.md) | Structured logging, log levels | ✅ Filled |

---

## Project Architecture

```
apps/
├── gateway/          # API Gateway — auth, proxy, rate limiting
├── order-service/    # Order management
└── user-service/     # User management

libs/
├── database/         # TypeORM setup
└── common/           # Shared filters, interceptors
```

---

## Language

All code and comments use **Chinese** for business logic summaries and API documentation (Swagger decorators use Chinese summaries).

---

**Language**: All documentation is written in **English** for AI assistant compatibility; code comments may be Chinese.
