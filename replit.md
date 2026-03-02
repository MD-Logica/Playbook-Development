# PlaybookMD — Practice Revenue Optimization Platform

## Overview
PlaybookMD is a Practice Revenue Optimization (PRO) platform designed for cash-pay aesthetic medicine practices. Its primary goal is to streamline operations and enhance revenue generation by providing tools for patient management, pipeline tracking, and financial oversight. The platform aims to be a comprehensive solution for managing patient journeys from inquiry to post-treatment, offering a comprehensive suite of modules for various practice needs.

## User Preferences
I want iterative development.
I want you to ask before making major changes.

## System Architecture

### UI/UX Decisions
The platform features a premium healthcare aesthetic, combining elements of Linear.app with a dark, structured, and precise design. Key elements include:
- **Color Scheme:** Primary emerald (#10B981) accents, dark navy (#0A1628) sidebar, light (#F9FAFB) content areas, and a grayscale text palette.
- **Typography:** Geist Sans, 14px base size.
- **Components:** Cards with 10px border radius, buttons and navigation with 6px radius.
- **Layout:** Fixed left sidebar for navigation and user footer, top bar for page titles, search, and notifications.
- **Branding:** Customizable practice branding with logo upload and primary/secondary color pickers.

### Technical Implementations
- **Framework:** Next.js 15.5.12 with App Router.
- **Database:** PostgreSQL accessed via Prisma ORM (v7) using an adapter pattern.
- **Authentication:** Clerk (Next.js SDK) for user authentication and organization management.
- **Styling:** Tailwind CSS integrated with a custom design system.
- **Form Validation:** Zod.
- **State Management:** TanStack Query and Zustand.
- **Icons:** lucide-react.

### Feature Specifications
- **Patient Management:** Comprehensive patient profiles, including personal details, timelines, financial summaries, and a standardized tagging system. Each patient is assigned a unique `chartId` for internal use.
- **Pipeline/CRM Kanban Board:** Drag-and-drop Kanban interface for managing deals with customizable stages, rotting thresholds, and automation rules. Includes quick-add deal functionality and a bottom action bar. Deals (formerly Leads/Opportunities) are the primary entities tracked.
- **Deal Panel:** Reusable slide-out panel for detailed deal management, supporting inline editing, activity logging, and multi-tabbed views.
- **Settings Modules:**
    - **Managed Lists:** Tags, Lead Sources (Paid, Organic, Relationship channels), and Procedure Types (Surgical, Non-Surgical, Skincare, Body, Hair, Other categories) with full CRUD operations.
    - **Pipeline Settings:** Full CRUD for pipelines and stages, including rotting configuration.
    - **My Account:** Personal information, security (2FA, active sessions), and default landing page preferences.
    - **User Management:** Admin-only staff management with role editing (ADMIN, PROVIDER, COORDINATOR, FRONT_DESK), deactivation with deal reassignment, and invite system.
    - **Finances:** Income Categories (hierarchical tree with playbook templates) and Tax Settings (default tax rate).
    - **Products & Services:** Catalog for various item types (flat/hourly/tiered service, bundle, inventory) with pricing, income category assignment, and taxability.
    - **Practice Settings:** Branding (logo, colors).
    - **Appointments:** Appointment Types (configurable types with color, duration, buffer, subcategories, archive/restore) and Working Hours (Coming Soon placeholder).
- **Deal Creation:** Multi-select procedure chips for auto-generated deal titles, and source selection for patient referral tracking.
- **Phone & Email Handling:** Phone numbers normalized to `+1XXXXXXXXXX` and displayed as `(XXX) XXX-XXXX`. Real-time duplicate patient detection by phone/email. Email typo detection.
- **Quote Builder:** Comprehensive quote creation and editing, featuring product/service line items, deposit/discount options, internal/patient notes, and server-side calculations for totals. Quotes have unique numbers and statuses (including CONVERTED). Patient-facing previews and PDF generation with practice branding. Quotes can be converted to invoices via "Accept & Convert to Invoice" action.
- **Invoice Management:** Full invoice lifecycle from quote conversion to payment collection. Invoice creation via quote conversion (auto-generates INV-YYYY-#### numbers), editable line items, status auto-management (Draft → Sent → Partially Paid → Paid), voiding with confirmation. Invoice PDF generation with practice branding and payment history.
- **Payment Tracking:** Record payments against invoices with amount, date, method (Cash, Check, Credit Card, CareCredit, Cherry, PatientFi, Wire Transfer, Other), reference numbers, and notes. Automatic balance calculation and invoice status updates. Admin-only payment deletion. Full payment history displayed on invoices, deal panels, and patient profiles.
- **Invoices Nav Page:** Filterable sortable list with KPI strip (Total Invoiced, Amount Collected, Outstanding Balance, Overdue). Record payments directly from the list. KPIs dynamically update with filter changes.
- **Invoice View Page:** Dedicated invoice view/edit page at `/invoices/[invoiceId]` with editable line items, totals, deposit/discount, payment history with Record Payment modal, Void Invoice with confirmation, Mark as Sent, PDF download, and patient-facing preview modal.
- **Dynamic KPIs:** Both Quotes and Invoices pages have KPIs that recalculate when filters change (status, coordinator, date range, search). Quotes acceptance rate uses deal-level calculation. Loading states shown during re-fetch.
- **Calendar/Appointments Page:** Full calendar UI at `/appointments` with Day, Week, and Agenda views. Day view shows time grid with colored appointment blocks, buffer hatching, current time indicator, and multi-provider columns when "All Providers" is selected. Week view shows 7-day columns with clickable day headers. Agenda view shows chronological grouped list (30 days, load more). Provider filter dropdown. API routes: `GET /api/appointments` (date range + provider filter), `GET /api/appointments/agenda`, `GET /api/providers`.
- **Appointment Booking Flow:** BookingModal component (`components/appointments/BookingModal.tsx`) for creating and editing appointments. Supports internal block toggle, appointment type with auto-duration, subcategory selection, patient search, deal linking, provider selection, date/time pickers, duration override, buffer display, room, and notes. Edit mode supports cancel (with reason), no-show, and admin-only delete. Conflict detection warns on provider double-booking. Triggered from: calendar time slots, calendar header "+ New Appointment", deal panel "+ Book Appointment" (pre-fills patient/deal locked), patient profile "Book Appointment" (pre-fills patient locked).
- **Appointment Status Tracking:** Status flow: CONFIRMED → CHECKED_IN → ROOMED → IN_PROGRESS → ENDED → CHECKED_OUT, plus NO_SHOW/CANCELLED from any. Hover actions on calendar blocks show next-status button. Visual indicators: green dot (checked in), blue dot (roomed), pulsing green border (in progress), muted (ended/checked out), "NS" label (no show). Timestamps recorded per transition.
- **Deal Panel Appointments Tab:** Real appointment data from `/api/opportunities/[id]/appointments`. Book Appointment pre-fills patient+deal locked. Status actions inline. Overview tab shows Next Appointment.
- **Patient Profile Appointments:** Sidebar shows upcoming 1-2 appointments. Book Appointment button opens modal pre-filled. Appointments tab replaces placeholder with grouped Upcoming/Past list, clickable rows for editing, inline status actions.
- **Activity Logging:** Detailed activity metadata for stage changes, lead creation, quote conversion, payment recording, appointment CRUD, status changes, rescheduling, and user management actions for comprehensive reporting.

### System Design Choices
- **Data Access Layer:** All database interactions are abstracted through API routes and `lib/db.ts` to prevent direct Prisma client access in components.
- **Authentication Protection:** Clerk middleware secures all dashboard routes.
- **Environment Configuration:** Sensitive credentials managed via environment variables.
- **Build Process:** Utilizes `scripts/build.cjs` for Next.js standalone output.

## External Dependencies
- **PostgreSQL:** Primary relational database.
- **Prisma ORM:** Database access and schema management.
- **Clerk:** Authentication and user management.
- **Tailwind CSS:** Styling framework.
- **Zod:** Schema validation.
- **TanStack Query:** Data fetching and caching.
- **Zustand:** State management.
- **lucide-react:** Icon library.
- **Geist Sans:** Custom font.
- **@dnd-kit:** Drag-and-drop library.
- **@react-pdf/renderer:** Server-side PDF generation.