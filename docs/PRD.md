# Product Requirements Document (PRD) — Cal.diy Rebuild

## 1. Problem Statement

Individual professionals, academic instructors, freelancers, and students need a self-contained, privacy-respecting scheduling tool to share availability and book appointments without friction. Modern commercial scheduling platforms (such as Calendly or Cal.com Cloud) impose recurring subscription fees, collect invasive telemetry, and bundle extensive enterprise multi-tenant overhead that solo operators do not need. 

Meanwhile, existing open-source forks frequently retain dead enterprise schema artifacts, carry broken documentation references, and suffer from critical software gaps:
1. **Broken Object-Level Authorization (BOLA)** allowing unauthorized appointment cancellation by anyone possessing a booking UID.
2. **Double Booking Race Conditions** under concurrent booking attempts because availability checks and booking records are decoupled without database-level transactional locks.
3. **Bot Exhaustion Attacks** due to optional bot protection and naive IP-only rate limiting.

The Cal.diy Rebuild delivers a streamlined, resilient scheduling platform engineered specifically for personal and independent use, eliminating legacy enterprise code while resolving security and concurrency deficiencies.

---

## 2. Target User

- **Primary Persona**: Solo professionals, freelancers, consultants, educators, and university students (such as a first-year student coordinating study sessions, office hours with professors, and project reviews).
- **User Attributes**: Needs full data ownership, zero licensing fees, zero tracking, straightforward calendar synchronization, and reliable booking links that can be safely shared across messaging channels, emails, and student forums.

---

## 3. One-Line Problem Statement

> **"For solo professionals and students who struggle with coordinating meetings across timezones without paying SaaS subscriptions or exposing personal calendar data to third parties, Cal.diy Rebuild does open-source, lightweight appointment scheduling and calendar synchronization, unlike proprietary SaaS schedulers or enterprise-bloated forks."**

---

## 4. Core Flow

The system operates through an end-to-end 7-step booking lifecycle:

1. **Authentication & Profile Setup**: The host signs in via a secure session and configures their primary profile (name, avatar, default timezone).
2. **Schedule & Working Hours Definition**: The host sets their standard weekly availability schedule (e.g., Monday through Friday, 09:00 to 17:00 in their local timezone) and specifies buffer times between meetings.
3. **Event Type Configuration**: The host creates a customized Event Type (specifying duration, meeting title, URL slug, location such as Google Meet or physical address, and required invitee form fields).
4. **Public Link Sharing**: The host shares their direct booking URL (`/[username]/[event-slug]`) with potential attendees.
5. **Real-Time Slot Discovery**: The invitee opens the public booking page. The application converts the host's schedule and existing busy calendar blocks into available time slots projected into the invitee's detected local timezone.
6. **Atomic Booking Reservation**: The invitee chooses an open time slot, enters their name, email, and responses, and submits the booking. The system acquires an atomic reservation lock to prevent concurrent double-booking, records the booking and attendee entries in the database, and schedules calendar events.
7. **Secure Management & Cancellation**: Both parties receive confirmation details. Cancellations or reschedules require an authenticated host session or a cryptographically signed HMAC token issued directly to the attendee's email, preventing unauthorized cancellation.

---

## 5. Features Ranked with MoSCoW

### Must Have
- **NextAuth Session Authentication**: Password and OAuth authentication for the primary host.
- **Weekly Schedule Management**: Recurring availability windows mapped to days of the week, with timezone awareness.
- **Event Type Management**: Configurable meeting durations, custom slugs, descriptions, and meeting locations.
- **Public Booker Screen**: Responsive interactive calendar and slot selector with automatic visitor timezone detection.
- **Atomic Booking Engine**: Concurrency-safe slot reservation utilizing database transaction locks to guarantee zero double bookings.
- **Cryptographic Token-Based Cancellation**: Cancellation and reschedule endpoints secured via HMAC-signed action tokens or authenticated user sessions (mitigating BOLA vulnerabilities).
- **Calendar Synchronization**: Bidirectional synchronization with external calendar providers (such as Google Calendar) to read busy times and insert confirmed appointments.

### Should Have
- **Bot Detection & Turnstile**: Mandatory bot verification enabled by default on public booking forms, with secure graceful degradation.
- **Composite Rate Limiting**: Multi-tier rate limiting evaluating client IP, event type ID, and booker email to protect against slot exhaustion.
- **Transactional Notifications**: Email confirmations and calendar invites sent to host and invitees, with active administrator warnings if mail transport is unconfigured.
- **Paginated Management Views**: Cursor- or limit-based pagination on booking histories and administrative user tables to protect server memory.

### Could Have
- **Custom Invitee Questions**: Ability to add custom text, dropdown, or checkbox fields to the public booking form.
- **Direct ICS File Downloads**: Downloadable calendar invite files on the confirmation screen for invitees not using webmail.
- **Theme Persistence**: Light and dark mode support persisted in browser local storage.
- **Booking Notes**: Internal private notes attached to booking records accessible only to the host.

### Won't Have (Out of Scope for Rebuild)
- **Enterprise Multi-Tenant Organizations**: No organization hierarchies, subdomains, or member roles beyond single-tenant host and admin.
- **Enterprise Directory Sync**: No SCIM, SAML Jackson, or enterprise identity provider sync.
- **Commercial License Key Verification**: No license checks, telemetry beacons, or commercial feature locks.
- **Telephony & Conversational AI Agents**: No Retell AI or Twilio phone agent infrastructure.
- **Legacy Denormalized Views & Orphaned Cache Models**: No dead database tables (`BookingDenormalized`, `CalendarCache`).

---

## 6. Out of Scope

- Multi-tenant enterprise permissions and role hierarchies.
- Stripe Connect marketplace billing splits and paid platform commissions.
- Telephony inbound/outbound automated calling.
- Complex round-robin team scheduling algorithms.

---

## 7. Acceptance Criteria (Given / When / Then)

### Standard Booking Creation
- **Given** an active host with availability configured on Tuesday from 14:00 to 18:00 UTC and an active 30-minute event type,
- **When** an invitee submits a booking request for Tuesday at 14:00 UTC with valid name and email,
- **Then** the system creates a confirmed booking record in the database, removes the 14:00 slot from subsequent availability calculations, and returns a successful booking response with status `200`.

### Killer Test 1: Concurrency & Double Booking Prevention
- **Given** an event type with an available slot on Wednesday at 10:00 UTC,
- **When** two independent invitees simultaneously submit booking requests for Wednesday at 10:00 UTC within the same millisecond window,
- **Then** exactly one request successfully acquires the reservation lock and receives a `200/201` confirmed status, while the second request fails with a `409 Conflict` error stating that the slot was reserved, and exactly one booking record exists in the database.

### Killer Test 2: BOLA Prevention on Booking Cancellation
- **Given** a confirmed booking with an identified UID belonging to another user,
- **When** an unauthenticated external caller sends a cancellation request to `/api/cancel` containing only the booking UID and CSRF token,
- **Then** the server rejects the cancellation with status `401 Unauthorized` or `403 Forbidden`, leaving the booking in its confirmed state.
- **Given** an attendee who received a cancellation link with a valid HMAC signature derived from the booking UID and secret,
- **When** the attendee submits the signed cancellation request,
- **Then** the server validates the signature and successfully marks the booking as cancelled.

### Killer Test 3: Timezone Conversion Accuracy
- **Given** a host whose weekly schedule is set to 09:00–17:00 in `America/New_York` (UTC-5),
- **When** an invitee located in `Europe/London` (UTC+0) requests available slots for that date,
- **Then** the slots returned by the API range from 14:00 to 22:00 in `Europe/London` time, exactly matching the host's working hours.
