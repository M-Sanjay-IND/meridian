# API & Route Specification — Cal.diy Rebuild

This document catalogs every API route and tRPC procedure for the Cal.diy Rebuild, detailing HTTP methods, request payloads, response structures, authorization tiers, and explicit error status codes.

---

## 1. Public Booking & Scheduling Endpoints

### 1.1 `POST /api/book/event`
- **Description**: Creates a confirmed appointment for an event type, verifies bot challenge, acquires a concurrency lock, persists the booking, and schedules calendar events.
- **Who May Call It**: Anyone (Unauthenticated public invitees).
- **Input**:
  - Headers: `Content-Type: application/json`
  - Body (`JSON`):
    ```json
    {
      "eventTypeId": 12,
      "start": "2026-10-15T14:00:00.000Z",
      "end": "2026-10-15T14:30:00.000Z",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "timeZone": "Europe/London",
      "notes": "Discussion regarding project milestone",
      "cfToken": "0.X.turnstile-token"
    }
    ```
- **Output**:
  - Status `200 OK` or `201 Created`
  - Body (`JSON`):
    ```json
    {
      "id": 105,
      "uid": "bkg_9f82a17b-4d3e-4b71-923a-ec921b7f9a12",
      "title": "30 Min Meeting between Jane Doe and Host",
      "startTime": "2026-10-15T14:00:00.000Z",
      "endTime": "2026-10-15T14:30:00.000Z",
      "status": "ACCEPTED"
    }
    ```
- **Error Cases**:
  - `400 Bad Request`: Missing required fields, invalid date formats, or end time before start time.
  - `403 Forbidden`: Cloudflare Turnstile bot verification failed.
  - `404 Not Found`: Event type ID does not exist or host user is inactive.
  - `409 Conflict`: Slot is already booked or concurrency reservation lock could not be acquired (double-booking prevention).
  - `429 Too Many Requests`: Rate limit exceeded for client IP, target host, or booker email.
  - `500 Internal Server Error`: External calendar provider error or database connection failure.

---

### 1.2 `POST /api/cancel`
- **Description**: Cancels a previously confirmed appointment. Requires either an authenticated host session or a cryptographically signed HMAC token issued directly to the attendee's email.
- **Who May Call It**: Authenticated host owner OR unauthenticated invitee possessing a valid signed token.
- **Input**:
  - Headers: `Content-Type: application/json`, optional Session Cookie.
  - Body (`JSON`):
    ```json
    {
      "uid": "bkg_9f82a17b-4d3e-4b71-923a-ec921b7f9a12",
      "cancellationReason": "Conflict with academic schedule",
      "token": "hmac_sha256_signed_action_token",
      "csrfToken": "csrf_token_string"
    }
    ```
- **Output**:
  - Status `200 OK`
  - Body (`JSON`):
    ```json
    {
      "success": true,
      "message": "Booking successfully cancelled",
      "status": "CANCELLED"
    }
    ```
- **Error Cases**:
  - `400 Bad Request`: Missing UID, invalid JSON, or booking already ended/cancelled.
  - `401 Unauthorized`: Caller is unauthenticated and provided no signature token.
  - `403 Forbidden`: Provided HMAC signature token is invalid, expired, or does not match the booking UID.
  - `404 Not Found`: Booking with specified UID does not exist.
  - `429 Too Many Requests`: Excessive cancellation attempts per IP or user.

---

### 1.3 `GET /api/trpc/publicViewer.slots.getSchedule`
- **Description**: Computes available meeting slots for an event type over a date window, evaluating host working hours and external calendar busy intervals.
- **Who May Call It**: Anyone (Unauthenticated public).
- **Input**:
  - Query Parameters:
    - `eventTypeId` (`number`): ID of target event type.
    - `startTime` (`string`, ISO 8601): Start of search range.
    - `endTime` (`string`, ISO 8601): End of search range.
    - `timeZone` (`string`, IANA identifier): Invitee timezone.
- **Output**:
  - Status `200 OK`
  - Body (`JSON`):
    ```json
    {
      "slots": {
        "2026-10-15": [
          { "time": "2026-10-15T14:00:00.000Z" },
          { "time": "2026-10-15T14:30:00.000Z" },
          { "time": "2026-10-15T15:00:00.000Z" }
        ]
      }
    }
    ```
- **Error Cases**:
  - `400 Bad Request`: Invalid date boundaries or unrecognized timezone string.
  - `404 Not Found`: Event type does not exist.

---

## 2. Authenticated Host Management Endpoints

### 2.1 `GET /api/me`
- **Description**: Returns authenticated user profile, timezone, and account configuration.
- **Who May Call It**: Authenticated Logged-In User.
- **Input**: Session Cookie (`next-auth.session-token`).
- **Output**:
  - Status `200 OK`
  - Body (`JSON`):
    ```json
    {
      "user": {
        "id": 1,
        "username": "ace",
        "email": "ace@example.com",
        "name": "Ace Developer",
        "timeZone": "Asia/Kolkata",
        "role": "USER"
      }
    }
    ```
- **Error Cases**:
  - `401 Unauthorized`: Session cookie missing, invalid, or expired.

---

### 2.2 `GET /api/trpc/viewer.eventTypes.list`
- **Description**: Retrieves all event types created by the authenticated host.
- **Who May Call It**: Authenticated Logged-In User.
- **Input**: None (Session context).
- **Output**:
  - Status `200 OK`
  - Array of event type objects with `id`, `title`, `slug`, `length`, `location`, `scheduleId`.
- **Error Cases**:
  - `401 Unauthorized`: Session not authenticated.

---

### 2.3 `POST /api/trpc/viewer.eventTypes.create`
- **Description**: Creates a new meeting event type for the host.
- **Who May Call It**: Authenticated Logged-In User.
- **Input** (`JSON`):
  ```json
  {
    "title": "30 Min Consultation",
    "slug": "30-min-consult",
    "length": 30,
    "description": "Introductory consulting session",
    "location": "integrations:google:meet",
    "scheduleId": 1
  }
  ```
- **Output**:
  - Status `200 OK`
  - Created event type record with assigned `id`.
- **Error Cases**:
  - `400 Bad Request`: Slug contains invalid characters or length is non-positive.
  - `401 Unauthorized`: Session not authenticated.
  - `409 Conflict`: Slug already in use by this host.

---

### 2.4 `PATCH /api/trpc/viewer.eventTypes.update`
- **Description**: Updates configuration details of an existing event type.
- **Who May Call It**: Host Owner of the event type.
- **Input** (`JSON`):
  ```json
  {
    "id": 12,
    "title": "Updated 30 Min Consultation",
    "length": 45
  }
  ```
- **Output**:
  - Status `200 OK`
  - Updated event type object.
- **Error Cases**:
  - `401 Unauthorized`: Session not authenticated.
  - `403 Forbidden`: Caller does not own the target event type.
  - `404 Not Found`: Event type ID does not exist.

---

### 2.5 `DELETE /api/trpc/viewer.eventTypes.delete`
- **Description**: Permanently deletes an event type.
- **Who May Call It**: Host Owner of the event type.
- **Input** (`JSON`):
  ```json
  {
    "id": 12
  }
  ```
- **Output**: Status `200 OK`.
- **Error Cases**:
  - `401 Unauthorized`: Session not authenticated.
  - `403 Forbidden`: Caller does not own the target event type.
  - `404 Not Found`: Event type ID does not exist.

---

### 2.6 `GET /api/trpc/viewer.availability.schedule.list`
- **Description**: Lists all availability schedules and recurring day intervals for the authenticated user.
- **Who May Call It**: Authenticated Logged-In User.
- **Input**: None (Session context).
- **Output**:
  - Status `200 OK`
  - Array of schedules with nested `availability` windows.
- **Error Cases**:
  - `401 Unauthorized`: Session not authenticated.

---

### 2.7 `POST /api/trpc/viewer.availability.schedule.create`
- **Description**: Creates a new weekly schedule profile with daily availability windows.
- **Who May Call It**: Authenticated Logged-In User.
- **Input** (`JSON`):
  ```json
  {
    "name": "Evening Office Hours",
    "timeZone": "America/New_York",
    "availability": [
      { "dayOfWeek": 1, "startTime": "17:00", "endTime": "20:00" },
      { "dayOfWeek": 3, "startTime": "17:00", "endTime": "20:00" }
    ]
  }
  ```
- **Output**: Created schedule object with assigned `id`.
- **Error Cases**:
  - `400 Bad Request`: Start time after end time or invalid day of week.
  - `401 Unauthorized`: Session not authenticated.

---

### 2.8 `GET /api/trpc/viewer.bookings.list`
- **Description**: Retrieves a paginated list of bookings for the authenticated host, filterable by status (`ACCEPTED`, `CANCELLED`).
- **Who May Call It**: Authenticated Logged-In User.
- **Input** (`Query`):
  - `status` (`string`, optional): Filter by booking status.
  - `limit` (`number`, default `20`, max `100`): Page size.
  - `cursor` (`number`, optional): ID cursor for pagination.
- **Output**:
  - Status `200 OK`
  - Array of booking summaries with next cursor.
- **Error Cases**:
  - `401 Unauthorized`: Session not authenticated.

---

## 3. Administrative Endpoints

### 3.1 `GET /api/trpc/viewer.users.list`
- **Description**: Lists registered users across the platform with mandatory cursor/limit pagination to prevent memory exhaustion.
- **Who May Call It**: Administrator (`ADMIN` role only).
- **Input** (`Query`):
  - `limit` (`number`, default `50`, max `100`): Maximum records to retrieve.
  - `cursor` (`number`, optional): Pagination offset identifier.
  - `search` (`string`, optional): Substring search against username or email.
- **Output**:
  - Status `200 OK`
  - Object containing `users` array (id, username, email, role, createdAt) and `nextCursor`.
- **Error Cases**:
  - `401 Unauthorized`: Session not authenticated.
  - `403 Forbidden`: Authenticated user role is not `ADMIN`.
