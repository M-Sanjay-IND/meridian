# System Observations & Verified Baseline Claims

This document compiles all verified empirical facts established about the original `cal.diy` codebase. Every claim listed below has been verified against the physical files and exact line numbers within the repository. Only claims classified as **Confirmed** (supported directly by exact lines) or **Likely** (supported by strong architectural evidence across multiple lines) are included. No speculative guesses are included.

---

## 1. Tech Stack, Build Tools & Runtimes

- **Package Manager Specification**: Yarn Berry is configured as the active package manager at version `4.12.0`.  
  Evidence: [package.json:229](file:///home/ace/cal.diy/package.json#L229) [Confirmed]

- **Engine Requirements**: Package engine constraints require Yarn version `>=4.12.0` and npm version `>=7.0.0`.  
  Evidence: [package.json:221-224](file:///home/ace/cal.diy/package.json#L221-L224) [Confirmed]

- **Monorepo Build Orchestration**: Turborepo manages the workspace build and execution pipeline at version `2.7.1`.  
  Evidence: [package.json:115](file:///home/ace/cal.diy/package.json#L115) [Confirmed]

- **Workspace Boundaries**: Monorepo packages are segregated across `apps/*`, `apps/api/*`, `packages/*`, `packages/embeds/*`, `packages/features/*`, `packages/app-store/*`, `packages/platform/*`, and `example-apps/*`.  
  Evidence: [package.json:5-16](file:///home/ace/cal.diy/package.json#L5-L16) [Confirmed]

- **Linter & Formatter**: Biome manages static code analysis and code formatting at version `2.3.10`.  
  Evidence: [package.json:88](file:///home/ace/cal.diy/package.json#L88) [Confirmed]

- **Release Management**: Changesets CLI orchestrates semantic package versioning and changelogs at version `2.29.4`.  
  Evidence: [package.json:90](file:///home/ace/cal.diy/package.json#L90) [Confirmed]

- **TypeScript Compiler**: The TypeScript compiler version is pinned across all workspace packages at `5.9.3`.  
  Evidence: [package.json:116](file:///home/ace/cal.diy/package.json#L116) [Confirmed]

- **Node.js Type Definitions**: Ambient Node.js typings are pinned to `@types/node` at version `^20.17.23`.  
  Evidence: [package.json:131](file:///home/ace/cal.diy/package.json#L131) [Confirmed]

- **Relational Database Provider**: The primary database engine configured in Prisma is PostgreSQL.  
  Evidence: [packages/prisma/schema.prisma:5](file:///home/ace/cal.diy/packages/prisma/schema.prisma#L5) [Confirmed]

- **Web Application Framework**: The primary frontend and API web application is built on Next.js version `16.2.3`.  
  Evidence: [apps/web/package.json:110](file:///home/ace/cal.diy/apps/web/package.json#L110) [Confirmed]

- **Frontend UI Framework**: The user-facing UI runtime is powered by React and React DOM at version `18.2.0`.  
  Evidence: [apps/web/package.json:123, 125](file:///home/ace/cal.diy/apps/web/package.json#L123-L125) [Confirmed]

- **React Dependency Resolution**: Root package resolutions enforce version `19.2.4` across React 19 experimental and canary variations.  
  Evidence: [package.json:138-140](file:///home/ace/cal.diy/package.json#L138-L140) [Confirmed]

- **Platform API Backend**: The standalone Platform API v2 service is constructed using NestJS (`@nestjs/common` and `@nestjs/core`) at version `10.4.20`.  
  Evidence: [apps/api/v2/package.json:53, 55](file:///home/ace/cal.diy/apps/api/v2/package.json#L53-L55) [Confirmed]

---

## 2. Deployment Artifacts & Miscellaneous Files

- **API Discrepancy Suppressions**: An OpenAPI specification difference ignore file records 2,558 lines of suppressed endpoint discrepancies.  
  Evidence: [.github/oasdiff-err-ignore.txt:1-2558](file:///home/ace/cal.diy/.github/oasdiff-err-ignore.txt#L1-L2558) [Confirmed]

- **Legacy Heroku Procfile**: A Heroku deployment process file declares the web start process as a Turborepo execution command.  
  Evidence: [Procfile:1](file:///home/ace/cal.diy/Procfile#L1) [Confirmed]

- **Legacy Heroku Manifest**: A Heroku container manifest file remains present in the root directory.  
  Evidence: [app.json:1](file:///home/ace/cal.diy/app.json#L1) [Confirmed]

- **Development Database Container**: A Docker Compose specification configures a local PostgreSQL instance.  
  Evidence: [docker-compose.yml:1](file:///home/ace/cal.diy/docker-compose.yml#L1) [Confirmed]

- **Vercel Deployment Descriptor**: A Vercel configuration manifest exists within the Next.js web application package.  
  Evidence: [apps/web/vercel.json:1](file:///home/ace/cal.diy/apps/web/vercel.json#L1) [Confirmed]

- **Internationalization Lockfile**: An internationalization tracking file documents 4,651 lines of locale keys and strings.  
  Evidence: [i18n.lock:1-4651](file:///home/ace/cal.diy/i18n.lock#L1-L4651) [Confirmed]

- **Third-Party AI Skill Configuration**: An out-of-tree OpenCode skill file for Vercel React best practices exists in the workspace.  
  Evidence: [.opencode/skill/vercel-react-best-practices/SKILL.md:1](file:///home/ace/cal.diy/.opencode/skill/vercel-react-best-practices/SKILL.md#L1) [Confirmed]

---

## 3. User Roles & Access Control

- **Standard User Role**: The Prisma schema defines a base user permission role enumerated as `USER`.  
  Evidence: [packages/prisma/schema.prisma:376](file:///home/ace/cal.diy/packages/prisma/schema.prisma#L376) [Confirmed]

- **Administrator Role**: The Prisma schema defines a system administrator permission role enumerated as `ADMIN`.  
  Evidence: [packages/prisma/schema.prisma:377](file:///home/ace/cal.diy/packages/prisma/schema.prisma#L377) [Confirmed]

- **Team Member Role**: The Prisma schema defines a team membership role enumerated as `MEMBER`.  
  Evidence: [packages/prisma/schema.prisma:739](file:///home/ace/cal.diy/packages/prisma/schema.prisma#L739) [Confirmed]

---

## 4. Architecture & State Management

- **Runtime Organization Configuration**: The Next.js configuration mutates `ORGANIZATIONS_ENABLED` dynamically during server startup if a single organization slug is detected.  
  Evidence: [apps/web/next.config.ts:41-44](file:///home/ace/cal.diy/apps/web/next.config.ts#L41-L44) [Confirmed]

- **Organization Feature Activation Check**: Organization support is evaluated conditionally by checking if `ORGANIZATIONS_ENABLED` equals `"1"` or `"true"`.  
  Evidence: [apps/web/next.config.ts:53-54](file:///home/ace/cal.diy/apps/web/next.config.ts#L53-L54) [Confirmed]

- **Authentication Session Management**: User login sessions and token signing are orchestrated through `next-auth` at version `4.24.13`.  
  Evidence: [apps/web/package.json:111](file:///home/ace/cal.diy/apps/web/package.json#L111) [Confirmed]

- **Client Preference Persistence**: Theme settings in browser local storage are managed using `next-themes` at version `0.2.0`.  
  Evidence: [apps/web/package.json:115](file:///home/ace/cal.diy/apps/web/package.json#L115) [Confirmed]

- **Client Reactive State**: Atomic client-side UI state is managed via Jotai primitives at version `2.12.2`.  
  Evidence: [apps/web/package.json:101](file:///home/ace/cal.diy/apps/web/package.json#L101) [Confirmed]

- **Asynchronous Server State**: Remote query caching and synchronization on the frontend are handled by `@tanstack/react-query` at version `5.17.19`.  
  Evidence: [apps/web/package.json:81](file:///home/ace/cal.diy/apps/web/package.json#L81) [Confirmed]

- **URL Query State Synchronization**: Dynamic routing and booking filter state encoded in URL parameters are parsed using `nuqs` at version `2.8.2`.  
  Evidence: [apps/web/package.json:117](file:///home/ace/cal.diy/apps/web/package.json#L117) [Confirmed]

- **Filesystem Build Caching**: The Next.js clean command deletes `.turbo` and `.next` build caches from disk.  
  Evidence: [apps/web/package.json:9](file:///home/ace/cal.diy/apps/web/package.json#L9) [Confirmed]

- **Precompiled Icon Sprites**: Lucide icon SVG sprite assets are pre-built by executing a custom script during package compilation.  
  Evidence: [packages/ui/package.json:71-75](file:///home/ace/cal.diy/packages/ui/package.json#L71-L75) [Confirmed]

---

## 5. API Entry Points & Routing

- **Single Event Booking Endpoint**: The POST handler for standard appointments delegates booking creation to `regularBookingService.createBooking`.  
  Evidence: [apps/web/pages/api/book/event.ts:17-58](file:///home/ace/cal.diy/apps/web/pages/api/book/event.ts#L17-L58) [Confirmed]

- **Recurring Event Booking Endpoint**: The POST handler for recurring appointments delegates creation to `recurringBookingService.createBooking`.  
  Evidence: [apps/web/pages/api/book/recurring-event.ts:29-60](file:///home/ace/cal.diy/apps/web/pages/api/book/recurring-event.ts#L29-L60) [Confirmed]

- **Cancellation Endpoint Verification**: The booking cancellation route verifies the presence of the booking UID and validates CSRF tokens prior to processing.  
  Evidence: [apps/web/app/api/cancel/route.ts:26-38](file:///home/ace/cal.diy/apps/web/app/api/cancel/route.ts#L26-L38) [Confirmed]

- **User Profile Endpoint Authentication**: The profile route verifies an active user session before returning account details.  
  Evidence: [apps/web/app/api/me/route.ts:19](file:///home/ace/cal.diy/apps/web/app/api/me/route.ts#L19) [Confirmed]

---

## 6. Data Model & Flagged Unused Entities

- **Denormalized Booking Model**: The Prisma schema defines a denormalized booking table with eleven composite and single-column indexes.  
  Evidence: [packages/prisma/schema.prisma:1527-1564](file:///home/ace/cal.diy/packages/prisma/schema.prisma#L1527-L1564) [Confirmed]

- **Calendar Cache Model**: A generic key-value calendar cache table is defined with an explicit developer comment noting incomplete followup work.  
  Evidence: [packages/prisma/schema.prisma:1594-1611](file:///home/ace/cal.diy/packages/prisma/schema.prisma#L1594-L1611) [Confirmed]

- **Directory Synchronization Models**: Models for enterprise directory sync (`DSyncData` and `DSyncTeamGroupMapping`) remain in the database schema.  
  Evidence: [packages/prisma/schema.prisma:1785-1807](file:///home/ace/cal.diy/packages/prisma/schema.prisma#L1785-L1807) [Confirmed]

- **Telephony and AI Agent Models**: Models for AI phone agents (`Agent` and `CalAiPhoneNumber`) are declared in the schema.  
  Evidence: [packages/prisma/schema.prisma:2541-2605](file:///home/ace/cal.diy/packages/prisma/schema.prisma#L2541-L2605) [Confirmed]

- **Enterprise License Key Column**: The deployment table maintains a `licenseKey` attribute for commercial license management.  
  Evidence: [packages/prisma/schema.prisma:1301](file:///home/ace/cal.diy/packages/prisma/schema.prisma#L1301) [Confirmed]

- **Orphaned Status of Cache and Denormalized Models**: The `BookingDenormalized` and `CalendarCache` models are unreferenced by active service layers and represent dead schema artifacts left from incomplete migrations.  
  Evidence: [packages/prisma/schema.prisma:1527-1611](file:///home/ace/cal.diy/packages/prisma/schema.prisma#L1527-L1611) [Likely]

---

## 7. Documentation Claims vs. Code Drift

- **README Prerequisites Documentation**: The project README recommends Node.js `>=18.x`, PostgreSQL `>=13.x`, and Yarn.  
  Evidence: [README.md:73-75](file:///home/ace/cal.diy/README.md#L73-L75) [Confirmed]

- **README Claims Regarding Enterprise Features**: The README asserts that enterprise features including Teams, Organizations, and SSO/SAML have been removed, and that no license key is required.  
  Evidence: [README.md:47-48](file:///home/ace/cal.diy/README.md#L47-L48) [Confirmed]

- **Retained SAML Dependencies**: The enterprise SAML package `@boxyhq/saml-jackson` remains declared in dependencies despite README removal claims.  
  Evidence: [apps/web/package.json:34](file:///home/ace/cal.diy/apps/web/package.json#L34) [Confirmed]

- **Developer Guide Workflow Reference**: The agent developer documentation references workflow constants at an enterprise file path.  
  Evidence: [AGENTS.md:130](file:///home/ace/cal.diy/AGENTS.md#L130) [Confirmed]

- **Environment Example Documentation Link**: The sample environment file references setup documentation located under enterprise directories.  
  Evidence: [.env.example:34](file:///home/ace/cal.diy/.env.example#L34) [Confirmed]

- **Permissions Guide Team Reference**: The permissions mapping references a non-existent team creation handler.  
  Evidence: [PERMISSIONS.md:11](file:///home/ace/cal.diy/PERMISSIONS.md#L11) [Confirmed]

- **Permissions Guide Organization Reference**: The permissions mapping references a non-existent organization handler.  
  Evidence: [PERMISSIONS.md:37](file:///home/ace/cal.diy/PERMISSIONS.md#L37) [Confirmed]

- **Missing Documentation Directories**: The directories referenced in the permissions guide (`viewer/teams` and `viewer/organizations`) do not exist in the filesystem.  
  Evidence: [PERMISSIONS.md:11-37](file:///home/ace/cal.diy/PERMISSIONS.md#L11-L37) [Confirmed]

---

## 8. Security, Concurrency & Correctness Gaps

- **Unauthenticated Cancellation Delegation**: The cancellation API route passes a fallback user ID of `-1` when unauthenticated, delegating authorization to the cancellation service.  
  Evidence: [apps/web/app/api/cancel/route.ts:52-55](file:///home/ace/cal.diy/apps/web/app/api/cancel/route.ts#L52-L55) [Confirmed]

- **Missing Authorization on Standard Booking Cancellation**: The cancellation service only verifies host status for seated events without seat reference UIDs, omitting ownership or attendee validation on standard one-on-one bookings.  
  Evidence: [packages/features/bookings/lib/handleCancelBooking.ts:153-189](file:///home/ace/cal.diy/packages/features/bookings/lib/handleCancelBooking.ts#L153-L189) [Confirmed]

- **Decoupled Slot Availability Check**: User availability is evaluated early in `RegularBookingService` via `ensureAvailableUsers`.  
  Evidence: [packages/features/bookings/lib/service/RegularBookingService.ts:902](file:///home/ace/cal.diy/packages/features/bookings/lib/service/RegularBookingService.ts#L902) [Confirmed]

- **Non-Transactional Booking Persistence**: Booking persistence executes hundreds of lines after the availability check without database-level transaction locks.  
  Evidence: [packages/features/bookings/lib/service/RegularBookingService.ts:1707-1710](file:///home/ace/cal.diy/packages/features/bookings/lib/service/RegularBookingService.ts#L1707-L1710) [Confirmed]

- **Absence of Overlap Constraints in Schema**: While indexes exist on status and time columns, the database schema lacks unique or exclusion constraints preventing overlapping active bookings for the same host.  
  Evidence: [packages/prisma/schema.prisma:924-927](file:///home/ace/cal.diy/packages/prisma/schema.prisma#L924-L927) [Confirmed]

- **Double Booking Race Condition Under Concurrency**: Concurrent requests for the same host slot can both pass the initial availability check and insert overlapping booking records.  
  Evidence: [packages/features/bookings/lib/service/RegularBookingService.ts:902, 1707](file:///home/ace/cal.diy/packages/features/bookings/lib/service/RegularBookingService.ts#L902) [Likely]

- **Optional Bot Verification**: Cloudflare Turnstile bot verification is only executed when an explicit environment flag equals `"1"`.  
  Evidence: [apps/web/pages/api/book/event.ts:20-25](file:///home/ace/cal.diy/apps/web/pages/api/book/event.ts#L20-L25) [Confirmed]

- **IP-Only Rate Limiting on Booking Creation**: The booking endpoint rate limiter relies solely on the hashed client IP address.  
  Evidence: [apps/web/pages/api/book/event.ts:37-40](file:///home/ace/cal.diy/apps/web/pages/api/book/event.ts#L37-L40) [Confirmed]

- **Active Multi-Tenant Seeding**: The development database seed script actively populates teams, organizations, and memberships.  
  Evidence: [scripts/seed.ts:1057-1155](file:///home/ace/cal.diy/scripts/seed.ts#L1057-L1155) [Confirmed]

- **Unvalidated Client Slug Header**: The server reads `x-cal-force-slug` directly from incoming client headers and attaches it to booking metadata.  
  Evidence: [apps/web/pages/api/book/event.ts:55](file:///home/ace/cal.diy/apps/web/pages/api/book/event.ts#L55) [Confirmed]

- **Anonymous No-Show Endpoint**: Public procedure `markHostAsNoShow` accepts unauthenticated inputs and lacks reporter tracking as acknowledged in its internal comment.  
  Evidence: [packages/trpc/server/routers/publicViewer/markHostAsNoShow.handler.ts:9-18](file:///home/ace/cal.diy/packages/trpc/server/routers/publicViewer/markHostAsNoShow.handler.ts#L9-L18) [Confirmed]

- **Unbounded Admin User Query**: The admin user list procedure executes `prisma.user.findMany()` with no pagination, limit, or cursor parameters.  
  Evidence: [packages/trpc/server/routers/viewer/users/_router.ts:57-61](file:///home/ace/cal.diy/packages/trpc/server/routers/viewer/users/_router.ts#L57-L61) [Confirmed]

- **Syntax Error in SQL Maintenance Script**: A database maintenance script combines a `SELECT` statement directly into a `DELETE` without a terminating delimiter.  
  Evidence: [scripts/delete-empty-google-credentials.sql:11-18](file:///home/ace/cal.diy/scripts/delete-empty-google-credentials.sql#L11-L18) [Confirmed]

- **Silent Mail Disablement**: The Next.js startup configuration emits a console warning when `EMAIL_FROM` is unset but allows normal startup and booking execution without notifications.  
  Evidence: [apps/web/next.config.ts:86-92](file:///home/ace/cal.diy/apps/web/next.config.ts#L86-L92) [Confirmed]
