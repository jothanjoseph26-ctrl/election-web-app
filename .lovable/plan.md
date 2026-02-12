

# AMAC Election Day Situation Room

## Overview
A web-based command center where 20+ situation room operators can look up agents, verify their identity, log reports from phone calls, track payments, and monitor election day progress across all wards in real-time.

---

## Phase 1: Agent Database & Import

### CSV Upload & Agent Management
- **Bulk import page** where you upload your agent data as a CSV file (name, ward, phone number)
- System flags issues: duplicate phone numbers, missing fields, invalid formats
- Manual editing to fix or add missing entries
- Each agent gets auto-assigned a **unique PIN** for identity verification

### Agent Directory
- Searchable, filterable table of all agents
- Filter by ward, verification status, payment status
- Click any agent to see full details and history

---

## Phase 2: Situation Room Dashboard

### Operator Login
- Each operator gets a login account so we can track who entered what
- Role-based access: **Admin** (full access) vs **Operator** (enter reports, verify agents)

### Agent Verification Panel
- When an agent calls in, operator searches by **phone number, name, or ward**
- System shows agent details — operator asks security questions (PIN, ward name)
- One-click **"Verified"** button to confirm identity before taking reports

### Live Report Entry
- Simple form: select agent → pick report type (Turnout Update, Incident, Material Shortage, Emergency) → enter details
- Timestamped automatically
- Operator name attached to each report entry

### Real-Time Overview Dashboard
- **Ward status board**: color-coded cards showing which wards have reported and which haven't
- **Key metrics**: Total agents checked in, reports received, payments sent, pending wards
- **Live activity feed**: scrolling list of latest reports as they come in
- **Filters**: by ward, report type, time range

---

## Phase 3: Payment Tracking

### Logistics Payment Module
- Pre-load payment amounts per agent
- Mark agents as **"Payment Sent"** with amount and reference number
- Track who's been paid vs who's pending
- Prevent duplicate payments with warnings
- Export payment report for reconciliation

---

## Phase 4: Coordination Tools

### Broadcast Notes
- Admins can post announcements visible to all operators (e.g., "Focus on Ward 5-10 now")
- Priority alerts for urgent situations

### Export & Reports
- Export all data to Excel at any time
- Summary report generation: ward-by-ward breakdown, agent performance, payment summary

---

## Backend Requirements
- **Supabase** for database, authentication (operator logins), and real-time updates
- Operator accounts with role-based access control
- Real-time sync so all 20+ operators see the same live data

---

## What You Need to Prepare
1. **Extract your agent data into a CSV** with columns: Name, Ward Number, Ward Name, Phone Number
2. **List of operator names/emails** for creating their login accounts
3. **Payment amounts** per agent or per ward (if applicable)

