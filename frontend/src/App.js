import React, { useState } from 'react';
import Login              from './pages/Login';
import WorkflowList       from './pages/WorkflowList';
import WorkflowEditor     from './pages/WorkflowEditor';
import RuleEditor         from './pages/RuleEditor';
import ExecutionView      from './pages/ExecutionView';
import AuditLog           from './pages/AuditLog';
import ApprovalDashboard  from './pages/ApprovalDashboard';
import { seedDemo }       from './api';
import './App.css';

export default function App() {
  const [user, setUser]          = useState(null);
  const [nav, setNav]            = useState('list');
  const [workflowId, setWfId]    = useState(null);
  const [stepId, setStepId]      = useState(null);
  const [executionId, setExecId] = useState(null);
  const [seeding, setSeeding]    = useState(false);
  const [toast, setToast]        = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const go = (page, opts = {}) => {
    if (opts.workflowId)   setWfId(opts.workflowId);
    if (opts.stepId)       setStepId(opts.stepId);
    if (opts.executionId)  setExecId(opts.executionId);
    setNav(page);
  };

  const handleLogout = () => {
    setUser(null);
    setNav('list');
  };

  const handleSeed = async () => {
    if (!window.confirm('Clear all data and load demo workflows?')) return;
    setSeeding(true);
    try {
      await seedDemo();
      setNav('list');
      showToast('Demo data loaded!');
    } catch { showToast('Seed failed — is backend running?'); }
    finally { setSeeding(false); }
  };

  const roleColor = {
    admin:   '#3fb950',
    manager: '#d29922',
    ceo:     '#bc8cff',
    finance: '#58a6ff',
  };

  if (!user) return <Login onLogin={(u) => {
    setUser(u);
    // redirect to correct home page based on role
    if (u.role === 'admin')   setNav('list');
    else if (u.role === 'manager' || u.role === 'ceo') setNav('approvals');
    else setNav('audit');
  }} />;

  const isAdmin    = user.role === 'admin';
  const isApprover = user.role === 'manager' || user.role === 'ceo';

  return (
    <div className="app">
      {toast && <div className="toast">{toast}</div>}

      <header className="header">
        <div className="header-inner">
          <div className="brand" onClick={() => go(isAdmin ? 'list' : isApprover ? 'approvals' : 'audit')}>
            <div className="brand-logo">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 1.5L2 4.5v7L8 14.5l6-3v-7L8 1.5z" stroke="#3fb950" strokeWidth="1.2" fill="none"/>
                <circle cx="8" cy="8" r="2" fill="#3fb950" opacity="0.6"/>
              </svg>
            </div>
            <div>
              <div className="brand-name">Halleyx</div>
              <div className="brand-tag">Workflow Engine</div>
            </div>
          </div>

          <nav className="nav">
            {/* Admin only tabs */}
            {isAdmin && (
              <button className={`nav-btn ${nav === 'list' ? 'active' : ''}`} onClick={() => go('list')}>
                Workflows
              </button>
            )}

            {/* Approvals — only for manager and ceo, NOT admin */}
            {isApprover && (
              <button className={`nav-btn ${nav === 'approvals' ? 'active' : ''}`} onClick={() => go('approvals')}>
                My Approvals
              </button>
            )}

            {/* Audit log — everyone */}
            <button className={`nav-btn ${nav === 'audit' ? 'active' : ''}`} onClick={() => go('audit')}>
              Audit Log
            </button>
          </nav>

          {/* Demo data — admin only */}
          {isAdmin && (
            <button className="btn btn-ghost btn-sm" onClick={handleSeed} disabled={seeding}>
              {seeding ? '...' : '⚡ Demo Data'}
            </button>
          )}

          {/* User badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '5px 10px'
            }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: roleColor[user.role] || '#3fb950'
              }} />
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>{user.name}</span>
              <span style={{
                fontSize: 10, fontFamily: 'var(--mono)',
                color: roleColor[user.role] || '#3fb950',
                background: 'var(--bg4)', padding: '1px 6px',
                borderRadius: 4, textTransform: 'uppercase'
              }}>
                {user.role}
              </span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Logout</button>
          </div>

          <div className="live-badge"><span className="live-dot" /> Live</div>
        </div>
      </header>

      <main className="main">
        {/* Admin screens */}
        {nav === 'list'   && isAdmin && <WorkflowList   go={go} showToast={showToast} />}
        {nav === 'editor' && isAdmin && <WorkflowEditor go={go} workflowId={workflowId} showToast={showToast} />}
        {nav === 'rules'  && isAdmin && <RuleEditor     go={go} stepId={stepId} workflowId={workflowId} showToast={showToast} />}
        {nav === 'execute'           && <ExecutionView  go={go} workflowId={workflowId} executionId={executionId} showToast={showToast} user={user} />}

        {/* Approval screen — manager and ceo only */}
        {nav === 'approvals' && isApprover && (
          <ApprovalDashboard user={user} showToast={showToast} />
        )}

        {/* Audit log — everyone */}
        {nav === 'audit' && <AuditLog go={go} showToast={showToast} />}

        {/* Access denied fallback */}
        {nav === 'approvals' && !isApprover && (
          <div className="empty">
            <div className="empty-icon">◈</div>
            <h3>Access restricted</h3>
            <p>Only Manager and CEO roles can access approvals.</p>
            <button className="btn btn-primary" onClick={() => go('audit')}>Go to Audit Log</button>
          </div>
        )}
      </main>
    </div>
  );
}