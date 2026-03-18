# Halleyx Workflow Engine 🚀
## 🎥 Demo Video
👉 [Click here to watch the demo](https://drive.google.com/file/d/1VZ-pESWLB1aJB4Jp2UC40E1oSKYW1Q04/view?usp=sharing)

> Built for the Halleyx Full Stack Engineer Placement Challenge  
> by Jeevi — March 2026

---

## What I Built

I built a full-stack Workflow Automation Engine from scratch. The idea is simple — businesses have processes like "Expense Approval" or "Employee Onboarding" that involve multiple people making decisions. This app lets you design those processes as workflows, run them with real data, and track every decision.

I spent most of my time on the **rule engine** and **execution engine** because that was the hardest part. The rule engine evaluates JavaScript conditions like `amount > 100 && country == 'US'` at runtime, and the execution engine walks through steps dynamically based on those rules.

---

## Tech Stack

| What | How |
|------|-----|
| Frontend | React 18 |
| Backend | Node.js + Express |
| Database | PostgreSQL 15 |
| ORM | Prisma 5.22.0 |
| Styling | Custom CSS (dark theme) |

---

## Features

- ✅ Design workflows with unlimited steps
- ✅ Write routing rules in plain JS expressions
- ✅ Role-based login (Admin, Manager, CEO, Finance)
- ✅ Approval steps — pauses and waits for human decision
- ✅ Notification steps — simulates email/Slack in logs
- ✅ Live execution polling every 1.5 seconds
- ✅ Full audit log with per-step timing
- ✅ Workflow versioning — every edit increments version
- ✅ Loop protection — MAX_ITERATIONS = 50
- ✅ Rule syntax validator
- ✅ Cancel and retry executions
- ✅ Automated API tests

---

## Setup & Run

### Prerequisites
- Node.js 18 or higher
- PostgreSQL 15 running locally
- npm

### Step 1 — Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/halleyx-workflow-engine.git
cd halleyx-workflow-engine
```

### Step 2 — Set up the database

Open pgAdmin or psql and run:
```sql
CREATE DATABASE halleyx_workflow;
```

Then open `backend/.env` and set:
```
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/halleyx_workflow"
```

### Step 3 — Install dependencies and run migrations

```bash
# Backend
cd backend
npm install
npx prisma migrate deploy
cd ..

# Frontend
cd frontend
npm install
cd ..
```

### Step 4 — Start the app

**Easy way:** Double-click `start.bat` in the root folder

**Manual way (two terminals):**
```bash
# Terminal 1 — Backend (port 3001)
cd backend
node src/index.js

# Terminal 2 — Frontend (port 3000)
cd frontend
npm start
```

Open **http://localhost:3000** in your browser.

### Step 5 — Load sample data (optional)
```bash
curl -X POST http://localhost:3001/seed
```
This loads 2 pre-built sample workflows.

---

## Login Accounts

| Role | Username | Password | Permissions |
|------|----------|----------|-------------|
| Admin | `admin` | `admin123` | Full access |
| Manager | `manager` | `mgr123` | Approve manager steps |
| CEO | `ceo` | `ceo123` | Approve CEO steps |
| Finance | `finance` | `fin123` | View finance steps |

> Auth uses in-memory sessions. If backend restarts, just log in again.

---

## All API Endpoints (26 total)

### Auth
| Method | Endpoint | What it does |
|--------|----------|--------------|
| POST | `/auth/login` | Login with username + password, returns token |
| GET | `/auth/me` | Get current user info from token |
| POST | `/auth/logout` | Invalidate session |

### Workflows
| Method | Endpoint | What it does |
|--------|----------|--------------|
| POST | `/workflows` | Create a new workflow |
| GET | `/workflows` | List all (supports search + pagination) |
| GET | `/workflows/:id` | Get single workflow with steps and rules |
| PUT | `/workflows/:id` | Update — auto-increments version number |
| DELETE | `/workflows/:id` | Delete with full cascade |

### Steps
| Method | Endpoint | What it does |
|--------|----------|--------------|
| POST | `/workflows/:id/steps` | Add step to a workflow |
| GET | `/workflows/:id/steps` | List all steps |
| PUT | `/steps/:id` | Update step |
| DELETE | `/steps/:id` | Delete step |

### Rules
| Method | Endpoint | What it does |
|--------|----------|--------------|
| POST | `/steps/:id/rules` | Add routing rule to a step |
| GET | `/steps/:id/rules` | List all rules for a step |
| PUT | `/rules/:id` | Update rule |
| DELETE | `/rules/:id` | Delete rule |
| POST | `/rules/validate` | Validate JS condition syntax before saving |

### Executions
| Method | Endpoint | What it does |
|--------|----------|--------------|
| POST | `/workflows/:id/execute` | Start execution with input data |
| GET | `/executions/:id` | Poll status and logs (used for live updates) |
| GET | `/executions` | Full audit log of all executions |
| POST | `/executions/:id/cancel` | Cancel a running execution |
| POST | `/executions/:id/retry` | Retry from the failed step |
| POST | `/executions/:id/approve` | Approve an approval step |
| POST | `/executions/:id/reject` | Reject an approval step |

### Utility
| Method | Endpoint | What it does |
|--------|----------|--------------|
| POST | `/seed` | Load 2 demo workflows into DB |
| GET | `/health` | Health check |

---

## How the Rule Engine Works

This was the most interesting part to build.

Each step has a list of routing rules. A rule looks like this:

```json
{
  "condition": "amount > 100 && country == 'US'",
  "nextStepId": "uuid-of-next-step",
  "priority": 1,
  "isDefault": false
}
```

When execution reaches a step, it loops through the rules in priority order and evaluates each condition against the input data:

```javascript
function evaluateCondition(condition, inputData) {
  const fn = new Function(...Object.keys(inputData), `return (${condition})`);
  return fn(...Object.values(inputData));
}
```

I used `new Function()` instead of `eval()` because it doesn't have access to the outer scope — much safer for user-provided expressions.

If no condition matches → falls back to the DEFAULT rule.  
If no DEFAULT exists → execution ends at that step.  
Loop protection: stops at `MAX_ITERATIONS = 50`.

---

## How the Execution Engine Works

```
POST /workflows/:id/execute  (with input data)
          ↓
    currentStep = first step
          ↓
    ┌─────────────────────────────────┐
    │  Is step type APPROVAL?         │
    │  → YES: save status to DB,      │
    │         return (pause here)     │
    │  → NO: run step, log result     │
    └────────────┬────────────────────┘
                 ↓
    Evaluate rules against input data
                 ↓
    nextStep = first matching rule's target
                 ↓
    Loop until no nextStep → SUCCESS
```

Approval steps resume when the frontend calls `POST /executions/:id/approve`.

Each step result goes into the `logs` JSON field on the Execution record. Frontend polls every 1.5 seconds to show live progress.

---

## Sample Workflow — Expense Approval

**Input fields:** `amount` (number), `country` (string), `department` (string), `priority` (string)

**Routing logic:**

```
Manager Approval (APPROVAL)
  Rule 1: amount > 100 && country == 'US' && priority == 'High'  →  Finance Notification
  Rule 2: amount <= 100 || department == 'HR'                    →  CEO Approval
  Rule 3: priority == 'Low'                                      →  Task Rejection
  DEFAULT                                                        →  Task Rejection

Finance Notification (NOTIFICATION)
  DEFAULT  →  CEO Approval

CEO Approval (APPROVAL)
  DEFAULT  →  Task Completion

Task Completion (TASK)  →  END
Task Rejection (TASK)   →  END
```

**Example execution:**
```
Input: { "amount": 500, "country": "US", "department": "Engineering", "priority": "High" }

10:01:00  Manager Approval      WAITING_APPROVAL
10:01:45  Manager Approval      APPROVED (by: manager)
10:01:45  Finance Notification  SENT [simulated — 112ms]
10:01:45  CEO Approval          WAITING_APPROVAL
10:02:10  CEO Approval          APPROVED (by: ceo)
10:02:10  Task Completion       COMPLETED [87ms]
          ✅ STATUS: SUCCESS
```

---

## Sample Workflow — Employee Onboarding

**Input fields:** `department` (string), `location` (string), `role` (string)

```
HR Document Check (ACTION)       → DEFAULT → IT Setup
IT Setup (NOTIFICATION)          → DEFAULT → Manager Introduction
Manager Introduction (APPROVAL)  → DEFAULT → Role Training
Role Training (TASK)             → DEFAULT → END
```

---

## Project Structure

```
halleyx-workflow-engine/
├── start.bat                      ← double-click to start everything
├── README.md                      ← this file
├── dev-log.md                     ← daily notes while building
├── .gitignore
│
├── backend/
│   ├── prisma/
│   │   └── schema.prisma          ← 4 tables: Workflow, Step, Rule, Execution
│   ├── src/
│   │   └── index.js               ← auth + all APIs + rule engine + execution engine
│   ├── test.js                    ← automated API tests
│   ├── package.json
│   └── .env                       ← DATABASE_URL (not committed to git)
│
└── frontend/
    └── src/
        ├── App.js                 ← navigation shell + auth context
        ├── App.css                ← dark theme
        ├── api.js                 ← all fetch calls to backend
        └── pages/
            ├── WorkflowList.jsx   ← Screen 1: table of all workflows
            ├── WorkflowEditor.jsx ← Screen 2: create/edit workflow + steps
            ├── RuleEditor.jsx     ← Screen 3: routing rules per step
            ├── ExecutionView.jsx  ← Screen 4: run + live logs + approve/reject
            └── AuditLog.jsx       ← Screen 5: full execution history
```

---

## Running the Tests

```bash
cd backend
node test.js
```

Tests create a workflow, add steps, add rules, execute it, poll for completion, then clean up. All pass green.

---

## Known Limitations

Being honest about what this doesn't have:

1. **No JWT** — tokens are in-memory. In production I'd use JWT + Redis session store.
2. **No real notifications** — email/Slack steps are simulated as log entries. Would connect to SendGrid or Twilio next.
3. **No visual flow diagram** — workflows are shown as a step list. React Flow would be the next UI addition.
4. **Single server only** — in-memory sessions break with multiple instances. Redis would fix this.
5. **Retry quirk** — retrying re-runs from the failed step but doesn't erase already-completed step logs from the previous run.

---

## What I Learned

- How to build a safe runtime rule evaluator using `new Function()`
- How to design async execution that can pause mid-flow and resume on human input
- How Prisma handles cascading deletes across related tables
- How to structure a full-stack project where backend and frontend are clearly separated
- Why loop protection matters in any state-machine system

---

## Dev Log

| Day | What I worked on |
|-----|-----------------|
| Day 1 | Project setup, PostgreSQL, Prisma schema, basic CRUD APIs |
| Day 2 | Rule engine, execution engine, approval pause/resume |
| Day 3 | All 5 frontend screens, live polling, dark theme |
| Day 4 | Auth (role-based), versioning, seed data, tests, README |

---

*Built with ☕, a lot of `console.log()`, and one too many late nights.*
