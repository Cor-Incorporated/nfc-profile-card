# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TapForge - A Next.js application that integrates physical NFC cards with digital profiles for modern networking. The app allows users to share profiles with a tap, manage contact information, and use OCR to digitize business cards.

**Tech Stack:**

- Frontend: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- Authentication: Firebase Auth (Google OAuth)
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
  - **api/** - API endpoints for Firebase webhooks, OCR, vCard generation
- **components/** - React components organized by feature
- **lib/** - Utilities for Firebase, Stripe, and general helpers
- **types/** - TypeScript type definitions
- **firebase/** - Firebase configuration and Cloud Functions

## Key Features & Implementation Notes

### Authentication Flow

- Uses **Firebase Auth** for authentication with Google OAuth
- AuthContext (`/src/contexts/AuthContext.tsx`) manages authentication state
- Protected routes use Firebase Auth hooks (`useAuth`)
- User data syncs automatically with Firestore on authentication

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

- Uses Google Gemini API Flash Latest for business card scanning
- Converts scanned data to VCard format
- Immediate data deletion after processing for privacy

### Database Schema (Firestore)

Main collections:

- **users** - User profiles, NFC cards, subscription info
- **contacts** (subcollection) - Scanned/saved contacts per user
- **analytics** (subcollection) - Usage analytics per user

## Environment Variables Required

The project requires configuration in `.env.local`:

- Firebase project configuration (API keys, auth domain, etc.)
- Google Gemini API key for OCR functionality
- Stripe keys (for payment features - if implemented)

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

## Recent Implementation Notes (Sep 2025)

### 🚀 SimpleEditor v2.0 完全実装 (Phase 5 完了)

**Major Architecture Change**: Complete migration from CraftJS to @dnd-kit-based SimpleEditor

#### New Editor System (SimpleEditor v2.0)

- **Implementation**: `/src/components/simple-editor/SimplePageEditor.tsx`
- **Drag & Drop**: @dnd-kit library for component reordering
- **Auto-save**: 3-second debounced saving to Firestore
- **Mobile-First**: Responsive design optimized for mobile editing
- **Components**: Text, Image, Link, Profile components with modal editing

#### Image Upload System

- **Firebase Storage**: Direct integration with user-specific paths
- **Path Structure**: `profiles/{userId}/images/{timestamp}-{filename}`
- **Validation**: 5MB file size limit, image type validation
- **UI**: Mobile-optimized upload interface with error handling
- **Authentication**: User ownership verification before upload

#### Social Link Auto-Recognition

- **Services**: GitHub, Twitter, Facebook, Instagram, LinkedIn, YouTube, TikTok等
- **Auto-Detection**: URL入力時の自動サービス認識
- **Visual**: Service-specific icons and colors
- **Implementation**: `/src/utils/socialLinks.ts`

#### Data Migration & Cleanup

- **Migration Tool**: `/src/utils/cleanupProfileData.ts`
- **Data Structure**: Simplified ProfileComponent interface
- **Backward Compatibility**: Automatic migration from CraftJS format
- **Database**: Firestore subcollection structure (`users/{userId}/profile/data`)

#### Technical Improvements

- **Code Reduction**: -2487 lines (4393 deletions, 1906 insertions)
- **TypeScript**: Complete error resolution
- **Performance**: Lighter bundle without CraftJS dependencies
- **Mobile UX**: Touch-optimized interface

### 🗑️ Deprecated/Removed (Breaking Changes)

- **CraftJS**: Completely removed all CraftJS components and dependencies
- **Old PageEditor**: `/src/components/editor/` directory deleted
- **Craft Components**: All editableComponents removed
- **Legacy APIs**: Old editor APIs no longer supported

### Architecture Patterns (Updated)

- **@dnd-kit Integration**: Use `useSortable()` hook for drag-and-drop
- **Component Structure**: Modal-based editing with ComponentEditor
- **State Management**: Local state with Firestore sync
- **Error Handling**: Comprehensive error boundaries and user feedback

## Patent Risk Information (Updated: Sep 21, 2025)

### 🚨 Features to AVOID (High Patent Infringement Risk)

1. **Dynamic NFC Cards** - Cloud-synced cards that update profile data dynamically (Lifes. Patent #7356776)
2. **Camera Roll Auto-Detection** - Background monitoring for business card images (Yusoner Patent #7393248)
3. **Email Signature Parsing** - Auto-extraction from forwarded emails (Yusoner Patent #5538512)
4. **Enterprise B2B Features** - Avoid direct competition with Sansan's enterprise market

### ✅ Safe Implementation Guidelines

- **NFC**: Use static URL linking only - no dynamic data fetching
- **OCR**: Implement in-app camera scanning with explicit user action
- **Target Market**: Focus on individuals and small teams, not enterprise B2B
- **Innovation Areas**: Visual customization, AI-powered features, community/social functions

### 📝 Before Implementing New Features

Always check the "特許リスク回避開発ガイドライン.md" document and consult with legal counsel when planning:

- NFC card management features
- Business card scanning/OCR
- Automated data collection
- Enterprise-level features

Detailed risk assessment available in "特許リスク評価レポート\_TapForge_20250921.md"

## Recent Updates (October 2025)

### 🎯 Promo Code System & Plan Management

**Implementation Date**: October 6, 2025

#### Overview
Implemented a comprehensive promo code system with Free/Pro plan differentiation to control business card scanning quotas and prepare for future monetization.

#### Key Features

1. **Plan System**
   - **Free Plan**: 10 business card scans per month
   - **Pro Plan**: Unlimited business card scans
   - Plan data stored in Firestore `users` collection
   - Server-side plan validation for security

2. **Promo Code Redemption**
   - API endpoint: `/api/promo-code`
   - Initial code: `TapForgeβTestUser` (for beta testers)
   - Instant upgrade to Pro plan upon valid code entry
   - Code validation with Firebase Admin SDK

3. **Server-side Quota Enforcement**
   - Quota check before OCR processing in `/api/business-card/scan`
   - Returns 429 error when monthly limit reached
   - Prevents client-side bypass attempts

4. **UI Enhancements**
   - Dashboard: Plan display with promo code input (Free users only)
   - Business card scan page: Enhanced quota display with plan badge
   - Visual differentiation: Free (blue) vs Pro (gold gradient)
   - Crown icon for Pro plan users

5. **Multi-language Support**
   - Added 12 new translation keys for promo code features
   - Full Japanese/English support for all new UI elements

#### Technical Implementation

**New Files:**
- `src/lib/constants/plans.ts` - Plan constants and limits
- `src/app/api/promo-code/route.ts` - Promo code validation API

**Modified Files:**
- `src/services/business-card/scanQuotaService.ts` - Plan-based quota logic
- `src/app/api/business-card/scan/route.ts` - Server-side quota check
- `src/app/dashboard/page.tsx` - Promo code input UI
- `src/app/dashboard/business-cards/scan/page.tsx` - Enhanced quota display
- `src/contexts/LanguageContext.tsx` - New translations

**Key Functions:**
```typescript
// Plan limits configuration
export const PLAN_LIMITS = {
  free: { scansPerMonth: 10 },
  pro: { scansPerMonth: 999999 },
};

// Quota checking
export async function canScan(userId: string): Promise<boolean>
export async function getScanQuota(userId: string): Promise<ScanQuota>
```

#### Database Schema Updates

**users/{userId}:**
```typescript
{
  plan: "free" | "pro",
  planUpgradedAt?: Timestamp,
  promoCode?: string
}
```

#### Security Considerations
- All plan checks performed server-side
- Firebase Admin SDK for token verification
- Rate limiting on promo code endpoint
- Promo codes stored as constants (easy to rotate)

#### Future Enhancements
- Stripe integration for paid Pro upgrades
- Multiple promo code tiers
- Usage analytics per plan
- Plan downgrade functionality
- Expiration dates for promo codes

### 🎨 UI/UX Improvements

**Preview Modal Responsiveness**
- Fixed component width overflow in preview modal
- Changed from fixed widths to `max-w-[600px]` for better mobile support
- Ensures consistent display across all device preview sizes

**Files Updated:**
- `src/components/profile/SimpleRenderer.tsx`
- `src/components/profile/ReadOnlyProfileInfo.tsx`
