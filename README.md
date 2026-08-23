# ReachInbox Email Scheduler

A full-stack email scheduling application that allows users to authenticate with Google, upload lead emails through CSV, schedule email campaigns, control sending delays and hourly limits, and track scheduled, sent, and failed emails.

## Features

- Google OAuth authentication
- CSV lead upload
- Email validation and recipient detection
- Email scheduling
- Configurable delay between emails
- Configurable hourly sending limit
- Background email processing with BullMQ
- Redis-backed job queue
- Prisma ORM with PostgreSQL
- Email status tracking
- Scheduled email dashboard
- Sent email dashboard
- Failed email tracking
- Campaign statistics
- Responsive dashboard UI
- Ethereal Email integration for safe email testing

## Tech Stack

### Frontend

- React
- TypeScript
- Vite
- CSS

### Backend

- Node.js
- Express
- TypeScript
- Prisma
- PostgreSQL
- Passport.js
- Google OAuth

### Queue & Background Processing

- Redis
- BullMQ

### Email

- Nodemailer
- Ethereal Email

## Architecture

```text
                    ┌──────────────────────┐
                    │      React UI        │
                    │      Frontend        │
                    └──────────┬───────────┘
                               │
                               │ REST API
                               ▼
                    ┌──────────────────────┐
                    │    Express Backend   │
                    │      TypeScript      │
                    └───────┬───────┬──────┘
                            │       │
                            │       │
                            ▼       ▼
                    ┌──────────┐  ┌──────────┐
                    │ Prisma   │  │  Redis   │
                    │   ORM    │  │          │
                    └────┬─────┘  └────┬─────┘
                         │             │
                         ▼             ▼
                    PostgreSQL     BullMQ Queue
                                       │
                                       ▼
                              ┌─────────────────┐
                              │  Email Worker   │
                              │                 │
                              │ Nodemailer      │
                              └────────┬────────┘
                                       │
                                       ▼
                              Ethereal Email