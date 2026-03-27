const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
app.use(cors({ origin: '*', credentials: false }));
app.use(express.json());

// ── USERS ──
const USERS = [
  { id: 'u1', username: 'admin',   password: 'admin123', role: 'admin',   name: 'Admin User'   },
  { id: 'u2', username: 'manager', password: 'mgr123',   role: 'manager', name: 'Rajesh Kumar'  },
  { id: 'u3', username: 'ceo',     password: 'ceo123',   role: 'ceo',     name: 'Priya Sharma'  },
  { id: 'u4', username: 'finance', password: 'fin123',   role: 'finance', name: 'Anitha Rajan'  },
];

const ROLE_CAN_APPROVE = {
  manager: ['manager'],
  ceo:     ['ceo'],
  admin:   ['manager', 'ceo', 'finance', 'admin'],
};

// ── EMAIL ──
// only send one email per event, no duplicates
async function sendEmail(to, subject, html) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });
    await transporter.sendMail({
      from: '"Halleyx Workflow Engine" <' + process.env.EMAIL_USER + '>',
      to: to,
      subject: subject,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
          <div style="background:#1a2e1c;padding:24px 32px;">
            <h2 style="color:#3fb950;margin:0;font-size:20px;">Halleyx Workflow Engine</h2>
            <p style="color:#8bc98a;margin:6px 0 0;font-size:13px;">Automated Workflow Notification</p>
          </div>
          <div style="padding:28px 32px;background:#ffffff;">
            ${html}
            <hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;">
            <p style="color:#888;font-size:12px;margin:0;">
              This is an automated message from Halleyx Workflow Engine.<br>
              Please do not reply to this email.
            </p>
          </div>
        </div>
      `
    });
    console.log('[EMAIL] Sent to ' + to + ' — ' + subject);
    return { success: true };
  } catch (e) {
    console.error('[EMAIL] Failed:', e.message);
    return { success: false, error: e.message };
  }
}

// ── RULE ENGINE ──
function evaluateCondition(condition, data) {
  if (!condition || condition.trim().toUpperCase() === 'DEFAULT') {
    return { result: true, error: null };
  }
  try {
    let expr = condition
      .replace(/contains\((\w+),\s*["'](.+?)["']\)/g,  (_, f, v) => 'String(data["' + f + '"]).includes("' + v + '")')
      .replace(/startsWith\((\w+),\s*["'](.+?)["']\)/g, (_, f, v) => 'String(data["' + f + '"]).startsWith("' + v + '")')
      .replace(/endsWith\((\w+),\s*["'](.+?)["']\)/g,   (_, f, v) => 'String(data["' + f + '"]).endsWith("' + v + '")');
    Object.keys(data).forEach(function(key) {
      expr = expr.replace(new RegExp('\\b' + key + '\\b', 'g'), 'data["' + key + '"]');
    });
    const fn = new Function('data', '"use strict"; return (' + expr + ');');
    return { result: fn(data), error: null };
  } catch (e) {
    return { result: false, error: 'Invalid condition: ' + e.message };
  }
}

function validateCondition(condition) {
  if (!condition || condition.trim().toUpperCase() === 'DEFAULT') return { valid: true, error: null };
  try {
    new Function('data', '"use strict"; return (' + condition + ');');
    return { valid: true, error: null };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

function getTaskDetails(action, data) {
  const map = {
    mark_complete:      'Expense of ' + (data.amount || 'N/A') + ' from ' + (data.department || 'N/A') + ' department has been approved and marked complete.',
    mark_rejected:      'Expense of ' + (data.amount || 'N/A') + ' has been rejected.',
    provision_accounts: 'System accounts have been provisioned for ' + (data.employee_name || 'new employee') + ' in the ' + (data.department || 'N/A') + ' department.',
    generate_report:    'Report generated successfully at ' + new Date().toISOString(),
    generic_task:       'Task completed with the provided workflow data.',
  };
  return map[action] || 'Task "' + action + '" executed successfully.';
}

// ── EXECUTION ENGINE ──
const MAX_ITERATIONS = 50;

async function runExecution(executionId) {
  const execution = await prisma.execution.findUnique({
    where: { id: executionId },
    include: {
      workflow: {
        include: { steps: { include: { rules: { orderBy: { priority: 'asc' } } } } }
      }
    }
  });
  if (!execution) return;

  const data  = execution.data;
  const steps = execution.workflow.steps;
  const logs  = [];
  let iterationCount  = 0;
  let currentStepId   = execution.workflow.start_step_id;

  await prisma.execution.update({ where: { id: executionId }, data: { status: 'in_progress' } });

  while (currentStepId) {
    iterationCount++;

    // prevent infinite loops
    if (iterationCount > MAX_ITERATIONS) {
      await prisma.execution.update({
        where: { id: executionId },
        data: {
          status: 'failed',
          logs: logs.concat([{
            step_name: 'System', step_type: 'system', status: 'failed',
            error_message: 'Max iterations (' + MAX_ITERATIONS + ') reached. Possible infinite loop.',
            started_at: new Date().toISOString(), ended_at: new Date().toISOString()
          }]),
          ended_at: new Date()
        }
      });
      return;
    }

    const step = steps.find(s => s.id === currentStepId);
    if (!step) {
      await prisma.execution.update({
        where: { id: executionId },
        data: {
          status: 'failed',
          logs: logs.concat([{
            step_name: 'System', step_type: 'system', status: 'failed',
            error_message: 'Step not found: ' + currentStepId,
            started_at: new Date().toISOString(), ended_at: new Date().toISOString()
          }]),
          ended_at: new Date()
        }
      });
      return;
    }

    const stepLog = {
      step_id: step.id, step_name: step.name, step_type: step.step_type,
      evaluated_rules: [], selected_next_step: null,
      status: 'completed', error_message: null, metadata: step.metadata,
      started_at: new Date().toISOString(), ended_at: null
    };

    await prisma.execution.update({ where: { id: executionId }, data: { current_step_id: step.id } });

    // ── APPROVAL: pause and wait, send ONE email to approver ──
    if (step.step_type === 'approval') {
      const assigneeRole  = step.metadata && step.metadata.assignee_role  ? step.metadata.assignee_role  : 'manager';
      const assigneeEmail = step.metadata && step.metadata.assignee_email ? step.metadata.assignee_email : process.env.EMAIL_USER;

      // send ONE approval request email
      const emailResult = await sendEmail(
        assigneeEmail,
        'Action Required: ' + step.name + ' — ' + execution.workflow.name,
        `
          <h3 style="color:#1f2328;margin:0 0 16px;">Approval Required</h3>
          <p style="color:#444;margin:0 0 16px;">
            Hello <strong>${assigneeRole === 'manager' ? 'Manager' : 'CEO'}</strong>,<br><br>
            A workflow step is waiting for your approval. Please review the details below and take action.
          </p>
          <table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
            <tr style="background:#f6f8fa;">
              <td style="padding:10px 14px;border:1px solid #d0d7de;font-weight:bold;width:140px;">Workflow</td>
              <td style="padding:10px 14px;border:1px solid #d0d7de;">${execution.workflow.name}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;border:1px solid #d0d7de;font-weight:bold;">Step</td>
              <td style="padding:10px 14px;border:1px solid #d0d7de;">${step.name}</td>
            </tr>
            <tr style="background:#f6f8fa;">
              <td style="padding:10px 14px;border:1px solid #d0d7de;font-weight:bold;">Role Required</td>
              <td style="padding:10px 14px;border:1px solid #d0d7de;">${assigneeRole.toUpperCase()}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;border:1px solid #d0d7de;font-weight:bold;">Submitted Data</td>
              <td style="padding:10px 14px;border:1px solid #d0d7de;"><pre style="margin:0;font-size:13px;">${JSON.stringify(data, null, 2)}</pre></td>
            </tr>
          </table>
          <p style="color:#444;">Please log in to <strong>Halleyx Workflow Engine</strong> to approve or reject this request.</p>
          <p style="color:#888;font-size:13px;">You are receiving this because you are the <strong>${assigneeRole}</strong> assigned to this step.</p>
        `
      );

      stepLog.status        = 'pending_approval';
      stepLog.assignee_role = assigneeRole;
      stepLog.email_sent    = emailResult;
      stepLog.ended_at      = new Date().toISOString();
      logs.push(stepLog);

      // save and pause — execution resumes when approved
      await prisma.execution.update({
        where: { id: executionId },
        data: { status: 'in_progress', logs: logs, current_step_id: step.id }
      });
      return;
    }

    // ── NOTIFICATION: send ONE email ──
    if (step.step_type === 'notification') {
      const channel   = step.metadata && step.metadata.channel   ? step.metadata.channel   : 'email';
      const template  = step.metadata && step.metadata.template  ? step.metadata.template  : 'default';
      const recipient = step.metadata && step.metadata.assignee_email ? step.metadata.assignee_email : process.env.EMAIL_USER;

      let notifResult = { success: false, error: 'Not email channel' };

      if (channel === 'email') {
        let emailBody = '';

        if (template === 'welcome') {
          emailBody = `
            <h3 style="color:#1f2328;margin:0 0 16px;">Welcome to the Team!</h3>
            <p style="color:#444;margin:0 0 16px;">
              Dear <strong>${data.employee_name || 'New Employee'}</strong>,<br><br>
              We are thrilled to welcome you to our team! Your onboarding process has been initiated and everything is being set up for you.
            </p>
            <table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
              <tr style="background:#f6f8fa;">
                <td style="padding:10px 14px;border:1px solid #d0d7de;font-weight:bold;width:140px;">Name</td>
                <td style="padding:10px 14px;border:1px solid #d0d7de;">${data.employee_name || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;border:1px solid #d0d7de;font-weight:bold;">Department</td>
                <td style="padding:10px 14px;border:1px solid #d0d7de;">${data.department || 'N/A'}</td>
              </tr>
              <tr style="background:#f6f8fa;">
                <td style="padding:10px 14px;border:1px solid #d0d7de;font-weight:bold;">Role</td>
                <td style="padding:10px 14px;border:1px solid #d0d7de;">${data.role || 'N/A'}</td>
              </tr>
            </table>
            <p style="color:#444;">Your account and system access will be ready shortly. We look forward to working with you!</p>
            <p style="color:#238636;font-weight:bold;">Welcome aboard!</p>
          `;
        } else if (template === 'finance-alert') {
          emailBody = `
            <h3 style="color:#1f2328;margin:0 0 16px;">Finance Team Notification</h3>
            <p style="color:#444;margin:0 0 16px;">
              Dear Finance Team,<br><br>
              An expense request has been approved by the Manager and requires your attention for further processing.
            </p>
            <table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
              <tr style="background:#f6f8fa;">
                <td style="padding:10px 14px;border:1px solid #d0d7de;font-weight:bold;width:140px;">Amount</td>
                <td style="padding:10px 14px;border:1px solid #d0d7de;">$${data.amount || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;border:1px solid #d0d7de;font-weight:bold;">Country</td>
                <td style="padding:10px 14px;border:1px solid #d0d7de;">${data.country || 'N/A'}</td>
              </tr>
              <tr style="background:#f6f8fa;">
                <td style="padding:10px 14px;border:1px solid #d0d7de;font-weight:bold;">Department</td>
                <td style="padding:10px 14px;border:1px solid #d0d7de;">${data.department || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;border:1px solid #d0d7de;font-weight:bold;">Priority</td>
                <td style="padding:10px 14px;border:1px solid #d0d7de;">${data.priority || 'N/A'}</td>
              </tr>
            </table>
            <p style="color:#444;">This expense has been forwarded to the CEO for final approval. No action required from Finance at this time.</p>
          `;
        } else {
          emailBody = `
            <h3 style="color:#1f2328;margin:0 0 16px;">Workflow Notification: ${step.name}</h3>
            <p style="color:#444;margin:0 0 16px;">
              This is an automated notification from the <strong>${execution.workflow.name}</strong> workflow.
            </p>
            <pre style="background:#f6f8fa;padding:16px;border-radius:6px;font-size:13px;">${JSON.stringify(data, null, 2)}</pre>
          `;
        }

        notifResult = await sendEmail(
          recipient,
          'Notification: ' + step.name + ' — ' + execution.workflow.name,
          emailBody
        );
      }

      stepLog.notification_sent = {
        channel:         channel,
        template:        template,
        recipient:       recipient,
        email_delivered: notifResult.success,
        message:         notifResult.success ? 'Email sent to ' + recipient : 'Email failed: ' + notifResult.error
      };
    }

    // ── TASK: log detailed result ──
    if (step.step_type === 'task') {
      const action = step.metadata && step.metadata.action ? step.metadata.action : 'generic_task';
      stepLog.task_result = {
        action:       action,
        status:       'executed',
        executed_at:  new Date().toISOString(),
        message:      getTaskDetails(action, data),
        input_data:   data
      };
      console.log('[TASK] ' + action + ' — ' + stepLog.task_result.message);
    }

    // ── EVALUATE RULES to find next step ──
    let nextStepId    = undefined;
    let matched       = false;
    let hasInvalidRule = false;

    for (const rule of step.rules) {
      const evaluation = evaluateCondition(rule.condition, data);
      const ruleLog = {
        rule_id:  rule.id,
        rule:     rule.condition,
        priority: rule.priority,
        result:   evaluation.result,
        error:    evaluation.error || null
      };
      if (evaluation.error) hasInvalidRule = true;
      stepLog.evaluated_rules.push(ruleLog);

      if (evaluation.result && !matched) {
        matched    = true;
        nextStepId = rule.next_step_id;
        const nextStep = nextStepId ? steps.find(s => s.id === nextStepId) : null;
        stepLog.selected_next_step = nextStep ? nextStep.name : (nextStepId === null ? 'END' : 'unknown');
      }
    }

    if (!matched) {
      stepLog.status        = 'failed';
      stepLog.error_message = hasInvalidRule
        ? 'Rule syntax error — add a DEFAULT rule as fallback'
        : 'No matching rule found — add a DEFAULT rule to handle all cases';
      stepLog.ended_at = new Date().toISOString();
      logs.push(stepLog);
      await prisma.execution.update({ where: { id: executionId }, data: { status: 'failed', logs: logs, ended_at: new Date() } });
      return;
    }

    stepLog.ended_at = new Date().toISOString();
    logs.push(stepLog);

    // null = workflow ends here
    if (nextStepId === null || nextStepId === undefined) break;
    currentStepId = nextStepId;
  }

  await prisma.execution.update({
    where: { id: executionId },
    data: { status: 'completed', logs: logs, current_step_id: null, ended_at: new Date() }
  });
}

// continues execution from a specific step after approval
async function continueExecution(executionId, fromStepId) {
  const execution = await prisma.execution.findUnique({
    where: { id: executionId },
    include: {
      workflow: {
        include: { steps: { include: { rules: { orderBy: { priority: 'asc' } } } } }
      }
    }
  });
  if (!execution) return;

  const data      = execution.data;
  const steps     = execution.workflow.steps;
  const logs      = Array.isArray(execution.logs) ? [...execution.logs] : [];
  let iterationCount = 0;
  let currentStepId  = fromStepId;

  while (currentStepId) {
    iterationCount++;
    if (iterationCount > MAX_ITERATIONS) break;

    const step = steps.find(s => s.id === currentStepId);
    if (!step) break;

    await prisma.execution.update({ where: { id: executionId }, data: { current_step_id: step.id } });

    // another approval step — pause again
    if (step.step_type === 'approval') {
      const assigneeRole  = step.metadata && step.metadata.assignee_role  ? step.metadata.assignee_role  : 'manager';
      const assigneeEmail = step.metadata && step.metadata.assignee_email ? step.metadata.assignee_email : process.env.EMAIL_USER;

      await sendEmail(
        assigneeEmail,
        'Action Required: ' + step.name + ' — ' + execution.workflow.name,
        `
          <h3 style="color:#1f2328;margin:0 0 16px;">Approval Required</h3>
          <p style="color:#444;">
            Hello <strong>${assigneeRole === 'ceo' ? 'CEO' : 'Manager'}</strong>,<br><br>
            The previous approval step has been completed and this step now requires your review.
          </p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr style="background:#f6f8fa;">
              <td style="padding:10px 14px;border:1px solid #d0d7de;font-weight:bold;width:140px;">Workflow</td>
              <td style="padding:10px 14px;border:1px solid #d0d7de;">${execution.workflow.name}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;border:1px solid #d0d7de;font-weight:bold;">Step</td>
              <td style="padding:10px 14px;border:1px solid #d0d7de;">${step.name}</td>
            </tr>
            <tr style="background:#f6f8fa;">
              <td style="padding:10px 14px;border:1px solid #d0d7de;font-weight:bold;">Role Required</td>
              <td style="padding:10px 14px;border:1px solid #d0d7de;">${assigneeRole.toUpperCase()}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;border:1px solid #d0d7de;font-weight:bold;">Submitted Data</td>
              <td style="padding:10px 14px;border:1px solid #d0d7de;"><pre style="margin:0;font-size:13px;">${JSON.stringify(data, null, 2)}</pre></td>
            </tr>
          </table>
          <p style="color:#444;">Log in to Halleyx Workflow Engine to take action.</p>
        `
      );

      logs.push({
        step_id: step.id, step_name: step.name, step_type: step.step_type,
        status: 'pending_approval', assignee_role: assigneeRole,
        evaluated_rules: [],
        started_at: new Date().toISOString(), ended_at: new Date().toISOString()
      });
      await prisma.execution.update({ where: { id: executionId }, data: { logs: logs, current_step_id: step.id } });
      return;
    }

    // notification step
    if (step.step_type === 'notification') {
      const channel   = step.metadata && step.metadata.channel   ? step.metadata.channel   : 'email';
      const recipient = step.metadata && step.metadata.assignee_email ? step.metadata.assignee_email : process.env.EMAIL_USER;
      if (channel === 'email') {
        await sendEmail(
          recipient,
          'Notification: ' + step.name + ' — ' + execution.workflow.name,
          '<h3>' + step.name + '</h3><p>Workflow <strong>' + execution.workflow.name + '</strong> notification.</p><pre>' + JSON.stringify(data, null, 2) + '</pre>'
        );
      }
    }

    // task step
    if (step.step_type === 'task') {
      const action = step.metadata && step.metadata.action ? step.metadata.action : 'generic_task';
      console.log('[TASK] ' + action + ' — ' + getTaskDetails(action, data));
    }

    const stepLog = {
      step_id: step.id, step_name: step.name, step_type: step.step_type,
      evaluated_rules: [], selected_next_step: null,
      status: 'completed', error_message: null,
      started_at: new Date().toISOString(), ended_at: null
    };

    let nextStepId = undefined;
    let matched    = false;

    for (const rule of step.rules) {
      const evaluation = evaluateCondition(rule.condition, data);
      stepLog.evaluated_rules.push({ rule: rule.condition, priority: rule.priority, result: evaluation.result });
      if (evaluation.result && !matched) {
        matched    = true;
        nextStepId = rule.next_step_id;
        const nextStep = nextStepId ? steps.find(s => s.id === nextStepId) : null;
        stepLog.selected_next_step = nextStep ? nextStep.name : 'END';
      }
    }

    if (!matched) {
      stepLog.status        = 'failed';
      stepLog.error_message = 'No matching rule found';
      stepLog.ended_at      = new Date().toISOString();
      logs.push(stepLog);
      await prisma.execution.update({ where: { id: executionId }, data: { status: 'failed', logs: logs, ended_at: new Date() } });
      return;
    }

    stepLog.ended_at = new Date().toISOString();
    logs.push(stepLog);
    if (nextStepId === null || nextStepId === undefined) break;
    currentStepId = nextStepId;
  }

  await prisma.execution.update({
    where: { id: executionId },
    data: { status: 'completed', logs: logs, current_step_id: null, ended_at: new Date() }
  });
}

// ══════════════════════════════════════════════════════
// AUTH ENDPOINTS
// ══════════════════════════════════════════════════════

app.post('/api/auth/login', function(req, res) {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const user = USERS.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid username or password' });
  res.json({ message: 'Login successful', user: { id: user.id, username: user.username, role: user.role, name: user.name } });
});

app.get('/api/auth/users', function(req, res) {
  res.json(USERS.map(u => ({ id: u.id, username: u.username, role: u.role, name: u.name })));
});

// returns only executions waiting for THIS role's approval
app.get('/api/auth/pending/:role', async function(req, res) {
  try {
    const role = req.params.role;
    const executions = await prisma.execution.findMany({
      where: { status: 'in_progress' },
      include: { workflow: { select: { name: true } } },
      orderBy: { started_at: 'desc' }
    });

    const pending = executions.filter(ex => {
      const logs = Array.isArray(ex.logs) ? ex.logs : [];
      const pendingLog = logs.find(l => l.status === 'pending_approval');
      if (!pendingLog) return false;
      // admin sees everything
      if (role === 'admin') return true;
      // other roles only see steps assigned to their role
      const assigneeRole = pendingLog.assignee_role || 'manager';
      return assigneeRole === role;
    });

    res.json(pending);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════
// WORKFLOWS
// ══════════════════════════════════════════════════════

app.post('/api/workflows', async function(req, res) {
  try {
    const { name, description, input_schema } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const workflow = await prisma.workflow.create({
      data: { name, description: description || '', input_schema: input_schema || {}, version: 1, is_active: true }
    });
    res.status(201).json(workflow);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/workflows', async function(req, res) {
  try {
    const { search, page = 1, limit = 10 } = req.query;
    const where = search ? { name: { contains: search, mode: 'insensitive' } } : {};
    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const [workflows, total] = await Promise.all([
      prisma.workflow.findMany({ where, skip, take: parseInt(limit), orderBy: { created_at: 'desc' }, include: { _count: { select: { steps: true } } } }),
      prisma.workflow.count({ where })
    ]);
    res.json({ workflows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/workflows/:id', async function(req, res) {
  try {
    const workflow = await prisma.workflow.findUnique({
      where: { id: req.params.id },
      include: { steps: { orderBy: { order: 'asc' }, include: { rules: { orderBy: { priority: 'asc' } } } } }
    });
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
    res.json(workflow);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/workflows/:id', async function(req, res) {
  try {
    const existing = await prisma.workflow.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Workflow not found' });
    const data = { version: existing.version + 1 };
    if (req.body.name        !== undefined) data.name         = req.body.name;
    if (req.body.description !== undefined) data.description  = req.body.description;
    if (req.body.input_schema!== undefined) data.input_schema = req.body.input_schema;
    if (req.body.is_active   !== undefined) data.is_active    = req.body.is_active;
    if (req.body.start_step_id!==undefined) data.start_step_id= req.body.start_step_id;
    const workflow = await prisma.workflow.update({ where: { id: req.params.id }, data });
    res.json(workflow);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/workflows/:id', async function(req, res) {
  try {
    const id    = req.params.id;
    const steps = await prisma.step.findMany({ where: { workflow_id: id } });
    for (const step of steps) await prisma.rule.deleteMany({ where: { step_id: step.id } });
    await prisma.step.deleteMany({ where: { workflow_id: id } });
    await prisma.execution.deleteMany({ where: { workflow_id: id } });
    await prisma.workflow.delete({ where: { id } });
    res.json({ message: 'Workflow deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════
// STEPS
// ══════════════════════════════════════════════════════

app.post('/api/workflows/:workflow_id/steps', async function(req, res) {
  try {
    const { name, step_type, order, metadata } = req.body;
    if (!name) return res.status(400).json({ error: 'Step name is required' });
    if (!['task','approval','notification'].includes(step_type)) return res.status(400).json({ error: 'step_type must be task, approval, or notification' });
    const step = await prisma.step.create({ data: { workflow_id: req.params.workflow_id, name, step_type: step_type || 'task', order: order || 0, metadata: metadata || {} } });
    res.status(201).json(step);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/workflows/:workflow_id/steps', async function(req, res) {
  try {
    const steps = await prisma.step.findMany({ where: { workflow_id: req.params.workflow_id }, orderBy: { order: 'asc' }, include: { rules: { orderBy: { priority: 'asc' } } } });
    res.json(steps);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/steps/:id', async function(req, res) {
  try {
    const data = {};
    if (req.body.name     !== undefined) data.name     = req.body.name;
    if (req.body.step_type!== undefined) data.step_type= req.body.step_type;
    if (req.body.order    !== undefined) data.order    = req.body.order;
    if (req.body.metadata !== undefined) data.metadata = req.body.metadata;
    const step = await prisma.step.update({ where: { id: req.params.id }, data, include: { rules: { orderBy: { priority: 'asc' } } } });
    res.json(step);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/steps/:id', async function(req, res) {
  try {
    await prisma.rule.deleteMany({ where: { step_id: req.params.id } });
    await prisma.step.delete({ where: { id: req.params.id } });
    res.json({ message: 'Step deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════
// RULES
// ══════════════════════════════════════════════════════

app.post('/api/steps/:step_id/rules', async function(req, res) {
  try {
    const { condition, next_step_id, priority } = req.body;
    if (!condition) return res.status(400).json({ error: 'Condition is required' });
    const rule = await prisma.rule.create({ data: { step_id: req.params.step_id, condition, next_step_id: next_step_id || null, priority: priority || 10 } });
    res.status(201).json(rule);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/steps/:step_id/rules', async function(req, res) {
  try {
    const rules = await prisma.rule.findMany({ where: { step_id: req.params.step_id }, orderBy: { priority: 'asc' } });
    res.json(rules);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/rules/:id', async function(req, res) {
  try {
    const data = {};
    if (req.body.condition    !== undefined) data.condition     = req.body.condition;
    if (req.body.next_step_id !== undefined) data.next_step_id  = req.body.next_step_id;
    if (req.body.priority     !== undefined) data.priority      = req.body.priority;
    const rule = await prisma.rule.update({ where: { id: req.params.id }, data });
    res.json(rule);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/rules/:id', async function(req, res) {
  try {
    await prisma.rule.delete({ where: { id: req.params.id } });
    res.json({ message: 'Rule deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/rules/validate', function(req, res) {
  const { condition } = req.body;
  if (!condition) return res.status(400).json({ error: 'Condition required' });
  res.json(validateCondition(condition));
});

// ══════════════════════════════════════════════════════
// EXECUTIONS
// ══════════════════════════════════════════════════════

app.post('/api/workflows/:workflow_id/execute', async function(req, res) {
  try {
    const workflow = await prisma.workflow.findUnique({ where: { id: req.params.workflow_id } });
    if (!workflow)            return res.status(404).json({ error: 'Workflow not found' });
    if (!workflow.is_active)  return res.status(400).json({ error: 'Workflow is inactive' });
    if (!workflow.start_step_id) return res.status(400).json({ error: 'No start step defined. Go to editor and add steps.' });
    const execution = await prisma.execution.create({
      data: { workflow_id: req.params.workflow_id, workflow_version: workflow.version, status: 'pending', data: req.body.data || {}, logs: [], triggered_by: req.body.triggered_by || 'user' }
    });
    runExecution(execution.id).catch(console.error);
    res.status(201).json(execution);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/executions/:id', async function(req, res) {
  try {
    const execution = await prisma.execution.findUnique({ where: { id: req.params.id }, include: { workflow: { select: { name: true, version: true } } } });
    if (!execution) return res.status(404).json({ error: 'Execution not found' });
    res.json(execution);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/executions', async function(req, res) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [executions, total] = await Promise.all([
      prisma.execution.findMany({ skip, take: parseInt(limit), orderBy: { started_at: 'desc' }, include: { workflow: { select: { name: true } } } }),
      prisma.execution.count()
    ]);
    res.json({ executions, total });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/executions/:id/cancel', async function(req, res) {
  try {
    const execution = await prisma.execution.findUnique({ where: { id: req.params.id } });
    if (!execution) return res.status(404).json({ error: 'Not found' });
    if (!['pending','in_progress'].includes(execution.status)) return res.status(400).json({ error: 'Cannot cancel this execution' });
    const updated = await prisma.execution.update({ where: { id: req.params.id }, data: { status: 'canceled', ended_at: new Date() } });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/executions/:id/retry', async function(req, res) {
  try {
    const execution = await prisma.execution.findUnique({ where: { id: req.params.id } });
    if (!execution) return res.status(404).json({ error: 'Not found' });
    if (execution.status !== 'failed') return res.status(400).json({ error: 'Only failed executions can be retried' });
    const updated = await prisma.execution.update({ where: { id: req.params.id }, data: { status: 'pending', retries: execution.retries + 1, ended_at: null } });
    runExecution(updated.id).catch(console.error);
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/executions/:id/approve', async function(req, res) {
  try {
    const { approver_id = 'user', approver_role = 'manager', comment = '' } = req.body;

    const execution = await prisma.execution.findUnique({
      where: { id: req.params.id },
      include: { workflow: { include: { steps: { include: { rules: { orderBy: { priority: 'asc' } } } } } } }
    });
    if (!execution) return res.status(404).json({ error: 'Not found' });
    if (execution.status !== 'in_progress') return res.status(400).json({ error: 'Execution is not waiting for approval' });

    const logs       = Array.isArray(execution.logs) ? [...execution.logs] : [];
    const pendingLog = logs.find(l => l.step_id === execution.current_step_id && l.status === 'pending_approval');

    if (pendingLog) {
      // check role permission
      const required = pendingLog.assignee_role || 'manager';
      const allowed  = ROLE_CAN_APPROVE[approver_role] || [];
      if (!allowed.includes(required)) {
        return res.status(403).json({ error: 'Role "' + approver_role + '" cannot approve a "' + required + '" step. Please log in as the correct user.' });
      }
      pendingLog.status        = 'approved';
      pendingLog.approver_id   = approver_id;
      pendingLog.approver_role = approver_role;
      pendingLog.comment       = comment;
      pendingLog.approved_at   = new Date().toISOString();
      pendingLog.ended_at      = new Date().toISOString();
    }

    await prisma.execution.update({ where: { id: req.params.id }, data: { logs } });

    // find next step from rules and continue
    const currentStep = execution.workflow.steps.find(s => s.id === execution.current_step_id);
    if (currentStep) {
      let nextStepId = undefined;
      for (const rule of currentStep.rules) {
        const ev = evaluateCondition(rule.condition, execution.data);
        if (ev.result) { nextStepId = rule.next_step_id; break; }
      }
      if (nextStepId === null || nextStepId === undefined) {
        await prisma.execution.update({ where: { id: req.params.id }, data: { status: 'completed', current_step_id: null, ended_at: new Date() } });
      } else {
        await prisma.execution.update({ where: { id: req.params.id }, data: { current_step_id: nextStepId } });
        continueExecution(req.params.id, nextStepId).catch(console.error);
      }
    }

    const updated = await prisma.execution.findUnique({ where: { id: req.params.id } });
    res.json({ message: 'Approved successfully', execution: updated });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/executions/:id/reject', async function(req, res) {
  try {
    const { approver_id = 'user', approver_role = 'manager', comment = '' } = req.body;

    const execution = await prisma.execution.findUnique({ where: { id: req.params.id } });
    if (!execution) return res.status(404).json({ error: 'Not found' });
    if (execution.status !== 'in_progress') return res.status(400).json({ error: 'Execution is not waiting for approval' });

    const logs       = Array.isArray(execution.logs) ? [...execution.logs] : [];
    const pendingLog = logs.find(l => l.step_id === execution.current_step_id && l.status === 'pending_approval');
    if (pendingLog) {
      pendingLog.status        = 'rejected';
      pendingLog.approver_id   = approver_id;
      pendingLog.approver_role = approver_role;
      pendingLog.comment       = comment;
      pendingLog.rejected_at   = new Date().toISOString();
      pendingLog.ended_at      = new Date().toISOString();
    }
    await prisma.execution.update({ where: { id: req.params.id }, data: { status: 'failed', logs, ended_at: new Date() } });
    res.json({ message: 'Rejected — execution marked as failed' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════
// SEED
// ══════════════════════════════════════════════════════

app.post('/api/seed', async function(req, res) {
  try {
    await prisma.execution.deleteMany();
    const allSteps = await prisma.step.findMany();
    for (const s of allSteps) await prisma.rule.deleteMany({ where: { step_id: s.id } });
    await prisma.step.deleteMany();
    await prisma.workflow.deleteMany();

    // Workflow 1: Expense Approval
    // Full flow: Manager Approval → Finance Notification → CEO Approval → Task Completion
    // OR short flow: Manager Approval → Task Rejection (for low amounts)
    const wf1 = await prisma.workflow.create({
      data: {
        name: 'Expense Approval',
        description: 'Multi-level expense approval: Manager → Finance → CEO → Complete',
        version: 1, is_active: true,
        input_schema: {
          amount:     { type: 'number', required: true },
          country:    { type: 'string', required: true },
          department: { type: 'string', required: false },
          priority:   { type: 'string', required: true, allowed_values: ['High','Medium','Low'] }
        }
      }
    });

    const s1 = await prisma.step.create({ data: { workflow_id: wf1.id, name: 'Manager Approval',    step_type: 'approval',     order: 1, metadata: { assignee_role: 'manager', assignee_email: process.env.EMAIL_USER } } });
    const s2 = await prisma.step.create({ data: { workflow_id: wf1.id, name: 'Finance Notification', step_type: 'notification', order: 2, metadata: { channel: 'email', template: 'finance-alert', assignee_email: process.env.EMAIL_USER } } });
    const s3 = await prisma.step.create({ data: { workflow_id: wf1.id, name: 'CEO Approval',         step_type: 'approval',     order: 3, metadata: { assignee_role: 'ceo', assignee_email: process.env.EMAIL_USER } } });
    const s4 = await prisma.step.create({ data: { workflow_id: wf1.id, name: 'Task Completion',      step_type: 'task',         order: 4, metadata: { action: 'mark_complete' } } });
    const s5 = await prisma.step.create({ data: { workflow_id: wf1.id, name: 'Task Rejection',       step_type: 'task',         order: 5, metadata: { action: 'mark_rejected' } } });

    await prisma.workflow.update({ where: { id: wf1.id }, data: { start_step_id: s1.id } });

    // Manager Approval rules — priority order matters
    await prisma.rule.create({ data: { step_id: s1.id, condition: "priority == 'Low'",    next_step_id: s5.id, priority: 1 } });
    await prisma.rule.create({ data: { step_id: s1.id, condition: "priority == 'High'",   next_step_id: s2.id, priority: 2 } });
    await prisma.rule.create({ data: { step_id: s1.id, condition: "priority == 'Medium'", next_step_id: s2.id, priority: 3 } });
    await prisma.rule.create({ data: { step_id: s1.id, condition: 'DEFAULT',              next_step_id: s5.id, priority: 4 } });

    // Finance Notification always goes to CEO
    await prisma.rule.create({ data: { step_id: s2.id, condition: 'DEFAULT', next_step_id: s3.id, priority: 1 } });

    // CEO Approval always goes to completion
    await prisma.rule.create({ data: { step_id: s3.id, condition: 'DEFAULT', next_step_id: s4.id, priority: 1 } });

    // End steps
    await prisma.rule.create({ data: { step_id: s4.id, condition: 'DEFAULT', next_step_id: null, priority: 1 } });
    await prisma.rule.create({ data: { step_id: s5.id, condition: 'DEFAULT', next_step_id: null, priority: 1 } });

    // Workflow 2: Employee Onboarding
    const wf2 = await prisma.workflow.create({
      data: {
        name: 'Employee Onboarding',
        description: 'Welcome email → Account setup → Manager introduction',
        version: 1, is_active: true,
        input_schema: {
          employee_name: { type: 'string', required: true },
          department:    { type: 'string', required: true },
          role:          { type: 'string', required: true }
        }
      }
    });

    const e1 = await prisma.step.create({ data: { workflow_id: wf2.id, name: 'Send Welcome Email',   step_type: 'notification', order: 1, metadata: { channel: 'email', template: 'welcome', assignee_email: process.env.EMAIL_USER } } });
    const e2 = await prisma.step.create({ data: { workflow_id: wf2.id, name: 'Setup Accounts',       step_type: 'task',         order: 2, metadata: { action: 'provision_accounts' } } });
    const e3 = await prisma.step.create({ data: { workflow_id: wf2.id, name: 'Manager Introduction', step_type: 'approval',     order: 3, metadata: { assignee_role: 'manager', assignee_email: process.env.EMAIL_USER } } });

    await prisma.workflow.update({ where: { id: wf2.id }, data: { start_step_id: e1.id } });

    await prisma.rule.create({ data: { step_id: e1.id, condition: 'DEFAULT', next_step_id: e2.id, priority: 1 } });
    await prisma.rule.create({ data: { step_id: e2.id, condition: 'DEFAULT', next_step_id: e3.id, priority: 1 } });
    await prisma.rule.create({ data: { step_id: e3.id, condition: 'DEFAULT', next_step_id: null,  priority: 1 } });

    res.json({ message: 'Demo data seeded successfully!', workflows: ['Expense Approval', 'Employee Onboarding'] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════
// HEALTH
// ══════════════════════════════════════════════════════

app.get('/api/health', function(req, res) {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, function() {
  console.log('Workflow Engine backend ready on port ' + PORT);
});