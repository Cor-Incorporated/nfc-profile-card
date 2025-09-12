# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NFC Profile Card - A Next.js application that integrates physical NFC cards with digital profiles for modern networking. The app allows users to share profiles with a tap, manage contact information, and use OCR to digitize business cards.

**Tech Stack:**
- Frontend: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- Authentication: Clerk (GitHub/Google OAuth)
- Backend: Firebase (Firestore, Cloud Functions, Storage)
- OCR: Google Gemini API
- Payments: Stripe
- Hosting: Vercel

## Essential Commands

```bash
# Development
npm run dev          # Start development server at localhost:3000

# Build & Production
npm run build        # Build for production
npm run start        # Start production server

# Code Quality
npm run lint         # Run ESLint
npm run type-check   # TypeScript type checking
npm run format       # Format code with Prettier
```

## Project Architecture

The project follows Next.js 14 App Router conventions with the following planned structure:

- **app/** - Next.js App Router pages and API routes
  - **(auth)/** - Authenticated routes (dashboard, edit, contacts)
  - **(public)/** - Public routes (profile pages, landing)
  - **api/** - API endpoints for Clerk webhooks, OCR, vCard generation
- **components/** - React components organized by feature
- **lib/** - Utilities for Firebase, Stripe, and general helpers
- **types/** - TypeScript type definitions
- **firebase/** - Firebase configuration and Cloud Functions

## Key Features & Implementation Notes

### Authentication Flow
- Uses Clerk for authentication with GitHub/Google OAuth
- Webhook integration syncs Clerk users with Firestore
- Protected routes use Clerk middleware

### Profile System
- Dynamic routing at `/p/[username]` for public profiles
- Support for up to 10 social/portfolio links with automatic service detection
- VCard download functionality for contact exchange
- One-time URL support for enhanced security

### NFC Integration
- Physical NFC cards link to digital profiles
- Card management in user dashboard
- Analytics tracking for card taps

### OCR Functionality
- Uses Google Gemini API 1.5 Flash for business card scanning
- Converts scanned data to VCard format
- Immediate data deletion after processing for privacy

### Database Schema (Firestore)
Main collections:
- **users** - User profiles, NFC cards, subscription info
- **contacts** (subcollection) - Scanned/saved contacts per user
- **analytics** (subcollection) - Usage analytics per user

## Environment Variables Required

The project requires configuration in `.env.local`:
- Clerk API keys and webhook secrets
- Firebase project configuration
- Google Gemini API key
- Stripe keys (for payment features)

## Development Workflow

1. The project is currently in initial setup phase
2. Follow the setup instructions in README.md for environment configuration
3. Firebase project ID should be: `nfc-profile-card`
4. Use mobile-first responsive design approach
5. Maintain TypeScript strict mode compliance

## Important Considerations

- **Security**: Implement HTTPS-only, rate limiting, and secure token handling
- **Performance**: Target <2s initial load, >90 Lighthouse score
- **Browser Support**: Latest 2 versions of Chrome, Safari, Firefox, Edge
- **Mobile Support**: iPhone 12+, Android 10+