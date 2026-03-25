const BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';
const handle = async (res) => {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
};

// ── Auth
export const login = (data) =>
  fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handle);

export const getPendingApprovals = (role) =>
  fetch(`${BASE}/auth/pending/${role}`).then(handle);

// ── Workflows
export const getWorkflows = (search = '', page = 1) =>
  fetch(`${BASE}/workflows?search=${search}&page=${page}&limit=10`).then(handle);

export const getWorkflow = (id) =>
  fetch(`${BASE}/workflows/${id}`).then(handle);

export const createWorkflow = (data) =>
  fetch(`${BASE}/workflows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handle);

export const updateWorkflow = (id, data) =>
  fetch(`${BASE}/workflows/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handle);

export const deleteWorkflow = (id) =>
  fetch(`${BASE}/workflows/${id}`, { method: 'DELETE' }).then(handle);

// ── Steps
export const createStep = (workflowId, data) =>
  fetch(`${BASE}/workflows/${workflowId}/steps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handle);

export const updateStep = (id, data) =>
  fetch(`${BASE}/steps/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handle);

export const deleteStep = (id) =>
  fetch(`${BASE}/steps/${id}`, { method: 'DELETE' }).then(handle);

// ── Rules
export const getRules = (stepId) =>
  fetch(`${BASE}/steps/${stepId}/rules`).then(handle);

export const createRule = (stepId, data) =>
  fetch(`${BASE}/steps/${stepId}/rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handle);

export const updateRule = (id, data) =>
  fetch(`${BASE}/rules/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handle);

export const deleteRule = (id) =>
  fetch(`${BASE}/rules/${id}`, { method: 'DELETE' }).then(handle);

export const validateRule = (condition) =>
  fetch(`${BASE}/rules/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ condition })
  }).then(handle);

// ── Executions
export const executeWorkflow = (workflowId, data) =>
  fetch(`${BASE}/workflows/${workflowId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handle);

export const getExecution = (id) =>
  fetch(`${BASE}/executions/${id}`).then(handle);

export const getExecutions = (page = 1) =>
  fetch(`${BASE}/executions?page=${page}&limit=20`).then(handle);

export const cancelExecution = (id) =>
  fetch(`${BASE}/executions/${id}/cancel`, { method: 'POST' }).then(handle);

export const retryExecution = (id) =>
  fetch(`${BASE}/executions/${id}/retry`, { method: 'POST' }).then(handle);

export const approveExecution = (id, data) =>
  fetch(`${BASE}/executions/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handle);

export const rejectExecution = (id, data) =>
  fetch(`${BASE}/executions/${id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handle);

// ── Seed
export const seedDemo = () =>
  fetch(`${BASE}/seed`, { method: 'POST' }).then(handle);