Now I have a very clear picture of your Quabase stack — **SvelteKit + TypeScript + Tailwind** frontend with a clear API route structure. Here's your comprehensive Teams feature implementation plan for Claude Code:

***

# Quabase Teams Feature — Implementation Plan

## Architecture Overview

Quabase currently has projects, auth, and per-project features. The Teams layer sits **above projects** — a team owns projects, and users belong to teams with roles.

```
Team (workspace)
  ├── Members (users + roles)
  ├── Projects (owned by team)
  │     ├── Test Cases, Runs, Defects, etc.
  └── Invitations (pending)
```

***

## Role Hierarchy (Qase-Inspired)

Model three built-in roles, like Qase:[1]

| Role | Scope | Capabilities |
|---|---|---|
| **Owner** | Team-wide | Full access, billing, delete team, transfer ownership. Only 1 per team |
| **Admin** | Team-wide | Manage members, invite/remove users, manage all projects. Cannot touch Owner settings |
| **Member** | Project-level | Access assigned projects, create/run tests, manage defects. Default for new invitees |
| **Viewer** | Project-level | Read-only access — view cases, runs, results. No create/edit/delete |

Key rule from Qase: **license type overrides role**. In your case, a "deactivated" user status overrides everything.[1]

***

## Database Schema Changes

Add these tables (assumes PostgreSQL/SQLite via your existing backend):

```sql
-- Teams table (the workspace)
CREATE TABLE teams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(50) UNIQUE NOT NULL,
  owner_id    UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Team memberships with roles
CREATE TABLE team_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  role       VARCHAR(20) NOT NULL DEFAULT 'member',
              -- values: 'owner' | 'admin' | 'member' | 'viewer'
  status     VARCHAR(20) NOT NULL DEFAULT 'active',
              -- values: 'active' | 'deactivated'
  joined_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- Invitations (pending, not yet users)
CREATE TABLE team_invitations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      UUID REFERENCES teams(id) ON DELETE CASCADE,
  invited_by   UUID REFERENCES users(id),
  email        VARCHAR(255) NOT NULL,
  role         VARCHAR(20) NOT NULL DEFAULT 'member',
  token        VARCHAR(128) UNIQUE NOT NULL, -- secure random token
  status       VARCHAR(20) DEFAULT 'pending',
                -- values: 'pending' | 'accepted' | 'expired' | 'revoked'
  expires_at   TIMESTAMPTZ NOT NULL,  -- e.g. NOW() + INTERVAL '7 days'
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Link projects to teams
ALTER TABLE projects ADD COLUMN team_id UUID REFERENCES teams(id);

-- Project-level role overrides (optional, for per-project access control)
CREATE TABLE project_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  role       VARCHAR(20) NOT NULL DEFAULT 'member',
  UNIQUE(project_id, user_id)
);
```

***

## Backend API Routes (SvelteKit `+server.ts`)

### Teams CRUD
```
POST   /api/teams                        → Create team (auto-assign current user as owner)
GET    /api/teams                        → List teams current user belongs to
GET    /api/teams/[teamSlug]             → Get team details
PATCH  /api/teams/[teamSlug]             → Update team name/slug (admin+)
DELETE /api/teams/[teamSlug]             → Delete team (owner only)
```

### Members Management
```
GET    /api/teams/[teamSlug]/members             → List all members + their roles
PATCH  /api/teams/[teamSlug]/members/[userId]    → Change role (admin+)
DELETE /api/teams/[teamSlug]/members/[userId]    → Remove member (admin+)
POST   /api/teams/[teamSlug]/members/[userId]/deactivate  → Soft-deactivate
POST   /api/teams/[teamSlug]/transfer-ownership  → Transfer owner role
```

### Invitations
```
POST   /api/teams/[teamSlug]/invitations         → Send invite (email + role)
GET    /api/teams/[teamSlug]/invitations         → List pending invites (admin+)
DELETE /api/teams/[teamSlug]/invitations/[id]    → Revoke invite (admin+)
GET    /api/invitations/[token]                  → Public: get invite details by token
POST   /api/invitations/[token]/accept           → Authenticated user accepts invite
```

***

## Frontend Routes to Create

```
/settings/team                         → Team profile (name, slug, danger zone)
/settings/team/members                 → Members list + role management table
/settings/team/invitations             → Pending invitations list
/settings/team/roles                   → Role descriptions (read-only for MVP)
/invite/[token]                        → Public invite landing page
  (shows team name, inviter, role → "Accept" button → redirects to login/signup if needed)
```

***

## Permission Guard Utility

Create a centralized permission helper at `src/lib/permissions.ts`:

```typescript
export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer';

const ROLE_HIERARCHY: Record<TeamRole, number> = {
  owner: 4, admin: 3, member: 2, viewer: 1
};

export function canManageMembers(role: TeamRole) {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY['admin'];
}

export function canManageProjects(role: TeamRole) {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY['member'];
}

export function canViewOnly(role: TeamRole) {
  return role === 'viewer';
}

export function isAtLeast(userRole: TeamRole, required: TeamRole) {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[required];
}
```

Use this in every `+server.ts` handler and in Svelte components to conditionally render UI.

***

## Server-Side Auth Guard Pattern

In your existing `hooks.server.ts`, inject team role resolution:

```typescript
// In hooks.server.ts — add to handle()
const teamMembership = await db.teamMembers.findFirst({
  where: { user_id: user.id, team_id: resolvedTeamId, status: 'active' }
});
event.locals.teamRole = teamMembership?.role ?? null;
```

Then in any `+server.ts`:
```typescript
import { isAtLeast } from '$lib/permissions';

export const POST: RequestHandler = async ({ locals }) => {
  if (!isAtLeast(locals.teamRole, 'admin')) {
    return json({ error: 'Forbidden' }, { status: 403 });
  }
  // ... proceed
};
```

***

## Invitation Flow (Step-by-Step)

1. **Admin sends invite** → POST `/api/teams/[slug]/invitations` with `{ email, role }` → generate secure random `token`, set `expires_at = +7 days`, store in DB, send email with link `https://quabase.app/invite/{token}`
2. **Recipient opens link** → GET `/invite/[token]` page (public, no auth required) → shows "You've been invited to join **[Team Name]** as **Member**"
3. **Recipient accepts** → if not logged in → redirect to `/auth/signup?redirect=/invite/{token}` → after login/signup → POST `/api/invitations/[token]/accept` → create `team_members` row → mark invitation `accepted`
4. **Guard expiry** → always check `expires_at` and `status = 'pending'` server-side before accepting

***

## Claude Code Prompt to Get Started

Paste this directly into Claude Code:

```
I'm building a Teams feature for Quabase, a SvelteKit + TypeScript + Tailwind test management app.

The stack is: SvelteKit frontend at /frontend/src, with API routes under /frontend/src/routes/api/, 
Svelte pages under /frontend/src/routes/, and shared lib at /frontend/src/lib/.

Please implement the following in order:

1. DATABASE: Add migrations for these tables: teams, team_members, team_invitations, 
   and add team_id to projects. Use the same DB client already in use.

2. PERMISSIONS UTIL: Create /frontend/src/lib/permissions.ts with a TeamRole type 
   ('owner' | 'admin' | 'member' | 'viewer'), a role hierarchy map, and helper functions: 
   isAtLeast(userRole, requiredRole), canManageMembers(role), canManageProjects(role).

3. API ROUTES: Create these server routes:
   - /api/teams (GET list, POST create)
   - /api/teams/[teamSlug]/members (GET, PATCH role, DELETE)
   - /api/teams/[teamSlug]/invitations (GET list, POST send invite, DELETE revoke)
   - /api/invitations/[token] (GET details, POST accept)
   All routes must check auth via locals.user and enforce role permissions.

4. FRONTEND PAGES:
   - /settings/team — team settings with name/slug edit form and danger zone (delete)
   - /settings/team/members — data table of members with role dropdown and remove button 
     (conditionally rendered based on current user's role)
   - /settings/team/invitations — list of pending invites with revoke button
   - /invite/[token] — public invite acceptance page showing team name, role, and accept button

5. HOOKS: Update hooks.server.ts to resolve the current team from the session/URL and 
   attach teamRole to event.locals.

Match the existing code style, use the same auth pattern as /routes/api/auth/me/+server.ts, 
and follow the existing Tailwind component patterns from other pages.
```

***

## MVP Scope vs. Future

| Now (MVP) | Later |
|---|---|
| 3 built-in roles (Owner, Admin, Member) | Custom roles with permission matrix |
| Email invitation with token link | SSO / bulk invite CSV |
| Project inherits team access | Per-project role overrides |
| Deactivate members | Audit log for member changes |
| Single team per user | Multiple team memberships |

This gives you a clean, Qase-comparable Teams system  that fits directly into your existing SvelteKit architecture  without requiring a backend rewrite.[2][3][1]

Sources
[1] Roles & Permissions | Qase Help Center https://docs.qase.io/en/articles/5563741-roles-permissions
[2] Enhancements and improvements https://www.qase.io/blog/enhancements-and-improvements
[4] AIDEN - Role based access control | Qase Help Center https://docs.qase.io/en/articles/12143902-aiden-role-based-access-control
[5] Role-Based Access Control | Qase Blog https://www.qase.io/blog/access-control
[6] Administration / Workspace Management: Users https://www.youtube.com/watch?v=LOtRfs34grU
[7] TestMu AI Role-Based Access Control (RBAC) https://www.testmuai.com/support/docs/role-based-access-control/
[8] Qase — Shipping velocity meets release quality https://www.qase.io
[9] Managing Users & Roles https://support.functionize.com/hc/en-us/articles/32990607648151-Managing-Users-Roles
[10] Qase Alternatives - Best Test Management Tools https://www.testiny.io/qase-alternatives/
[11] DESIGN OF A ROLE BASED ACCESS CONTROL ... https://www.authorea.com/doi/10.22541/au.177091733.32934837
[12] Global Shared Parameters in Test Case Management https://www.qase.io/blog/global-shared-parameters
[13] Role-Based Access Control (RBAC): A Comprehensive ... https://pathlock.com/blog/role-based-access-control-rbac/
[14] Qase.io Test Management: Streamline QA, Automation & ... https://www.ramotion.com/blog/qase-io-qa-task-management/
[15] RBAC Explained: Benefits, Models, and Best Practices Guide https://blog.securelayer7.net/role-based-access-control/
[16] Roles https://docs.qase.io/administration/workspace-management/roles
