# ReachInbox - Email Scheduler

A full-stack email scheduling system built with React, Node.js, PostgreSQL, Redis, and BullMQ.

## Features

- Google OAuth authentication
- Email scheduling
- CSV lead upload
- Email validation
- Duplicate email removal
- Configurable delay between emails
- Hourly sending limit
- Background email processing using BullMQ
- Redis-backed job queue
- PostgreSQL persistence using Prisma
- Email retry mechanism
- Failed email tracking
- Scheduled email dashboard
- Sent email dashboard
- Ethereal email integration for testing

## Tech Stack

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS

### Backend

- Node.js
- Express
- TypeScript
- Prisma ORM
- PostgreSQL

### Queue and Background Processing

- Redis
- BullMQ

### Authentication

- Google OAuth

### Email

- Nodemailer
- Ethereal Email

## Architecture

```text
                    ┌──────────────────┐
                    │   React Frontend │
                    │   TypeScript     │
                    └────────┬─────────┘
                             │
                             │ HTTP
                             ▼
                    ┌──────────────────┐
                    │ Express Backend  │
                    │   REST APIs      │
                    └───────┬──────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
                ▼                       ▼
       ┌────────────────┐      ┌────────────────┐
       │   PostgreSQL   │      │ Redis / BullMQ │
       │    Prisma      │      │   Job Queue    │
       └────────────────┘      └───────┬────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │  Email Worker   │
                              │   Nodemailer    │
                              └────────┬────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │ Ethereal SMTP   │
                              └─────────────────┘