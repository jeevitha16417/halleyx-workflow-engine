# Dev Log — Halleyx Workflow Engine

> My daily notes while building this project.
> Writing these as I go so I remember what I was thinking.

---

## Day 1 — Project Setup + Basic APIs

**What I did:**
- Set up the folder structure — backend (Node/Express) and frontend (React)
- Installed Prisma and connected to PostgreSQL
- Designed the schema: Workflow, Step, Rule, Execution
- Built basic CRUD for workflows — create, list, get, update, delete
- Tested with Postman — all working

**What was hard:**
- Figuring out Prisma's cascade delete. If you delete a workflow, you need to delete its steps and rules too, otherwise you get foreign key constraint errors. Had to manually delete in the right order: Rules → Steps → Workflows.

**TODO for tomorrow:**
- Rule engine
- Execution engine
- Approval flow

---

## Day 2 — Rule Engine + Execution Engine

**What I did:**
- Built the rule engine using `new Function()` — safer than eval()
- Built the execution engine — async function that walks steps and follows rules
- Added approval step logic — pauses execution, saves state to DB
- Added notification step logic — logs simulated email/Slack message
- Added loop protection — MAX_ITERATIONS = 50
- Added /rules/validate endpoint so frontend can check syntax before saving
- Added cancel and retry endpoints

**What was hard:**
- The approval pause/resume was tricky. When execution hits an APPROVAL step, it needs to stop and wait. But Node.js is async, so I can't just "pause" — I save the current step ID to the DB and return. When the user approves, a new request comes in and execution resumes from where it left off.
- Took me a while to get the rule priority ordering right.

**Decision I made:**
- Used `new Function()` instead of `eval()` because eval() has access to the outer closure which is a security risk with user-provided conditions.

**What's working:**
- Full execution from start to finish with rule routing
- Approval steps pause and resume correctly
- Notification steps log and continue

---

## Day 3 — Frontend

**What I did:**
- Built all 5 screens in React
- WorkflowList — table with search and pagination
- WorkflowEditor — create and edit workflows, add/remove steps
- RuleEditor — add rules per step with condition builder
- ExecutionView — input form, run button, live logs, approve/reject buttons
- AuditLog — history of all executions with drill-down

**What was hard:**
- Live polling for execution status. I set up a setInterval that calls GET /executions/:id every 1.5 seconds and updates the UI. Had to make sure to clearInterval when the component unmounts or when execution finishes, otherwise it keeps polling forever.
- The approve/reject flow — the button only shows when execution status is WAITING_APPROVAL. Had to handle all the status states carefully.

**Design choice:**
- Dark theme because it looks more professional and most developer tools use dark mode.

---

## Day 4 — Auth + Polish + Tests + README

**What I did:**
- Added role-based auth — USERS array with username/password/role
- Added /auth/login, /auth/logout, /auth/me endpoints
- Added in-memory session store with random tokens
- Added ROLE_CAN_APPROVE to control which roles can approve which step types
- Added workflow versioning — every PUT increments version field
- Wrote automated tests in test.js — covers all major endpoints
- Loaded seed data — 2 sample workflows pre-built
- Wrote README and dev-log

**What was hard:**
- Realized at the end that the USERS array existed but the /auth/login route was missing. Classic — defined the data but forgot to add the endpoint. Fixed by adding the route block right after the USERS array.

**Known issues I'm leaving for now:**
- No JWT — tokens reset on server restart. Fine for demo.
- No real email — notification steps are simulated. Fine for demo.
- No flow diagram — would use React Flow library if I had more time.

---

## Overall Reflection

This was a solid challenge. The rule engine was the part I'm most proud of — evaluating user-written JS conditions safely at runtime is not something you do every day.

If I had more time I'd add:
1. JWT with refresh tokens
2. Real email via SendGrid
3. Drag-and-drop workflow builder with a visual canvas
4. Docker compose so setup is one command
5. Proper role middleware on every protected route

Total time: ~4 days of actual work spread over the challenge period.
