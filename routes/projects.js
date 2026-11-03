/**
 * routes/projects.js
 * Project + task tracking — projects belong to clients, tasks belong to projects.
 *
 * DB migration (run once in Supabase SQL editor):
 * ─────────────────────────────────────────────────────────────────
 * CREATE TABLE IF NOT EXISTS projects (
 *   id            SERIAL PRIMARY KEY,
 *   freelancer_id INTEGER NOT NULL REFERENCES users(id),
 *   client_id     INTEGER NOT NULL REFERENCES users(id),
 *   name          TEXT NOT NULL,
 *   description   TEXT,
 *   status        TEXT NOT NULL DEFAULT 'active'
 *                 CHECK (status IN ('active','paused','completed','cancelled')),
 *   deadline      DATE,
 *   created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *   updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
 * );
 *
 * CREATE TABLE IF NOT EXISTS tasks (
 *   id            SERIAL PRIMARY KEY,
 *   project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 *   freelancer_id INTEGER NOT NULL REFERENCES users(id),
 *   title         TEXT NOT NULL,
 *   description   TEXT,
 *   status        TEXT NOT NULL DEFAULT 'todo'
 *                 CHECK (status IN ('todo','in_progress','done','blocked')),
 *   priority      TEXT NOT NULL DEFAULT 'medium'
 *                 CHECK (priority IN ('low','medium','high','urgent')),
 *   due_date      DATE,
 *   time_log_id   INTEGER REFERENCES time_logs(id),  -- optional link to a time log
 *   created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *   updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
 * );
 * CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(freelancer_id, client_id);
 * CREATE INDEX IF NOT EXISTS idx_tasks_project   ON tasks(project_id);
 * ─────────────────────────────────────────────────────────────────
 *
 * Routes:
 *   GET    /api/projects                  — all projects (freelancer)
 *   GET    /api/projects/client/:clientId — projects for one client
 *   POST   /api/projects                  — create project
 *   PUT    /api/projects/:id              — update project
 *   DELETE /api/projects/:id              — delete project (cascades tasks)
 *
 *   GET    /api/projects/:id/tasks        — list tasks for a project
 *   POST   /api/projects/:id/tasks        — create task
 *   PUT    /api/projects/:id/tasks/:tid   — update task
 *   DELETE /api/projects/:id/tasks/:tid   — delete task
 *   PATCH  /api/projects/:id/tasks/:tid/status — quick status change
 *
 *   GET    /api/projects/client-view      — client sees their own projects + tasks
 */

const router = require('express').Router();
const pool   = require('../db/pool');
const { requireFreelancer, requireAuth } = require('../middleware/auth');
const verifyToken = requireAuth; // alias — requireAuth sets req.user for any role

const VALID_PROJECT_STATUS = ['active', 'paused', 'completed', 'cancelled'];
const VALID_TASK_STATUS    = ['todo', 'in_progress', 'done', 'blocked'];
const VALID_PRIORITY       = ['low', 'medium', 'high', 'urgent'];

// ════════════════════════════════════════════════════════════════════
// PROJECT ROUTES
// ════════════════════════════════════════════════════════════════════

// GET /api/projects — all projects for freelancer (with task counts)
router.get('/', requireFreelancer, async (req, res, next) => {
  try {
    const { status, client_id } = req.query;
    let q = `
      SELECT p.*,
             u.name AS client_name, u.company AS client_company,
             COUNT(t.id)::int                                            AS total_tasks,
             COUNT(CASE WHEN t.status = 'done' THEN 1 END)::int         AS done_tasks,
             COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END)::int  AS inprogress_tasks,
             COUNT(CASE WHEN t.status = 'blocked' THEN 1 END)::int      AS blocked_tasks
      FROM projects p
      JOIN users u ON u.id = p.client_id
      LEFT JOIN tasks t ON t.project_id = p.id
      WHERE p.freelancer_id = $1
    `;
    const params = [req.user.id];
    if (status)    { params.push(status);    q += ` AND p.status = $${params.length}`; }
    if (client_id) { params.push(client_id); q += ` AND p.client_id = $${params.length}`; }
    q += ' GROUP BY p.id, u.name, u.company ORDER BY p.updated_at DESC';

    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (e) { next(e); }
});

// GET /api/projects/client-view — client sees their projects + task list (read-only)
router.get('/client-view', verifyToken, async (req, res, next) => {
  try {
    if (req.user.role !== 'client') return res.status(403).json({ error: 'Clients only' });

    const { rows: projects } = await pool.query(`
      SELECT p.id, p.name, p.description, p.status, p.deadline, p.created_at,
             COUNT(t.id)::int AS total_tasks,
             COUNT(CASE WHEN t.status = 'done' THEN 1 END)::int AS done_tasks
      FROM projects p
      LEFT JOIN tasks t ON t.project_id = p.id
      WHERE p.client_id = $1
      GROUP BY p.id
      ORDER BY p.updated_at DESC
    `, [req.user.id]);

    // Also fetch tasks for each project
    const { rows: tasks } = await pool.query(`
      SELECT t.id, t.project_id, t.title, t.description,
             t.status, t.priority, t.due_date, t.created_at
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      WHERE p.client_id = $1
      ORDER BY t.project_id, t.priority DESC, t.due_date NULLS LAST
    `, [req.user.id]);

    // Group tasks under their project
    const tasksByProject = {};
    tasks.forEach(tk => {
      if (!tasksByProject[tk.project_id]) tasksByProject[tk.project_id] = [];
      tasksByProject[tk.project_id].push(tk);
    });

    const result = projects.map(p => ({ ...p, tasks: tasksByProject[p.id] || [] }));
    res.json(result);
  } catch (e) { next(e); }
});

// GET /api/projects/client/:clientId — projects for one specific client
router.get('/client/:clientId', requireFreelancer, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*,
             COUNT(t.id)::int AS total_tasks,
             COUNT(CASE WHEN t.status='done' THEN 1 END)::int AS done_tasks
      FROM projects p
      LEFT JOIN tasks t ON t.project_id = p.id
      WHERE p.freelancer_id = $1 AND p.client_id = $2
      GROUP BY p.id
      ORDER BY p.updated_at DESC
    `, [req.user.id, req.params.clientId]);
    res.json(rows);
  } catch (e) { next(e); }
});

// POST /api/projects — create project
router.post('/', requireFreelancer, async (req, res, next) => {
  try {
    const { client_id, name, description, status = 'active', deadline } = req.body;
    if (!client_id || !name) return res.status(400).json({ error: 'client_id and name required' });
    if (!VALID_PROJECT_STATUS.includes(status))
      return res.status(400).json({ error: `status must be one of: ${VALID_PROJECT_STATUS.join(', ')}` });

    // Verify client belongs to freelancer
    const check = await pool.query(
      'SELECT id FROM clients WHERE user_id=$1 AND freelancer_id=$2',
      [client_id, req.user.id]
    );
    if (!check.rows.length) return res.status(403).json({ error: 'Client not found' });

    const { rows } = await pool.query(`
      INSERT INTO projects (freelancer_id, client_id, name, description, status, deadline)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [req.user.id, client_id, name, description || null, status, deadline || null]);

    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// PUT /api/projects/:id — update project
router.put('/:id', requireFreelancer, async (req, res, next) => {
  try {
    const { name, description, status, deadline } = req.body;
    if (status && !VALID_PROJECT_STATUS.includes(status))
      return res.status(400).json({ error: `status must be one of: ${VALID_PROJECT_STATUS.join(', ')}` });

    const { rows } = await pool.query(`
      UPDATE projects
      SET name        = COALESCE($1, name),
          description = COALESCE($2, description),
          status      = COALESCE($3, status),
          deadline    = COALESCE($4, deadline),
          updated_at  = NOW()
      WHERE id = $5 AND freelancer_id = $6
      RETURNING *
    `, [name, description, status, deadline, req.params.id, req.user.id]);

    if (!rows.length) return res.status(404).json({ error: 'Project not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// DELETE /api/projects/:id — delete project (cascades all its tasks)
router.delete('/:id', requireFreelancer, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM projects WHERE id=$1 AND freelancer_id=$2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Project not found' });
    res.json({ message: 'Project and all its tasks deleted' });
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════════
// TASK ROUTES (nested under /api/projects/:id/tasks)
// ════════════════════════════════════════════════════════════════════

// GET /api/projects/:id/tasks
router.get('/:id/tasks', requireFreelancer, async (req, res, next) => {
  try {
    // First verify ownership of the project
    const proj = await pool.query(
      'SELECT id FROM projects WHERE id=$1 AND freelancer_id=$2',
      [req.params.id, req.user.id]
    );
    if (!proj.rows.length) return res.status(404).json({ error: 'Project not found' });

    const { status, priority } = req.query;
    let q = `
      SELECT t.*
      FROM tasks t
      WHERE t.project_id = $1
    `;
    const params = [req.params.id];
    if (status)   { params.push(status);   q += ` AND t.status = $${params.length}`; }
    if (priority) { params.push(priority); q += ` AND t.priority = $${params.length}`; }
    q += ' ORDER BY t.priority DESC, t.due_date NULLS LAST, t.created_at';

    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (e) { next(e); }
});

// POST /api/projects/:id/tasks
router.post('/:id/tasks', requireFreelancer, async (req, res, next) => {
  try {
    const proj = await pool.query(
      'SELECT id FROM projects WHERE id=$1 AND freelancer_id=$2',
      [req.params.id, req.user.id]
    );
    if (!proj.rows.length) return res.status(404).json({ error: 'Project not found' });

    const { title, description, status = 'todo', priority = 'medium', due_date, time_log_id } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    if (!VALID_TASK_STATUS.includes(status))
      return res.status(400).json({ error: `status must be one of: ${VALID_TASK_STATUS.join(', ')}` });
    if (!VALID_PRIORITY.includes(priority))
      return res.status(400).json({ error: `priority must be one of: ${VALID_PRIORITY.join(', ')}` });

    const { rows } = await pool.query(`
      INSERT INTO tasks (project_id, freelancer_id, title, description, status, priority, due_date, time_log_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [req.params.id, req.user.id, title, description || null, status, priority, due_date || null, time_log_id || null]);

    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// PUT /api/projects/:id/tasks/:tid
router.put('/:id/tasks/:tid', requireFreelancer, async (req, res, next) => {
  try {
    const { title, description, status, priority, due_date, time_log_id } = req.body;
    if (status && !VALID_TASK_STATUS.includes(status))
      return res.status(400).json({ error: `status must be one of: ${VALID_TASK_STATUS.join(', ')}` });
    if (priority && !VALID_PRIORITY.includes(priority))
      return res.status(400).json({ error: `priority must be one of: ${VALID_PRIORITY.join(', ')}` });

    const { rows } = await pool.query(`
      UPDATE tasks
      SET title        = COALESCE($1, title),
          description  = COALESCE($2, description),
          status       = COALESCE($3, status),
          priority     = COALESCE($4, priority),
          due_date     = COALESCE($5, due_date),
          time_log_id  = COALESCE($6, time_log_id),
          updated_at   = NOW()
      WHERE id = $7 AND project_id = $8 AND freelancer_id = $9
      RETURNING *
    `, [title, description, status, priority, due_date, time_log_id, req.params.tid, req.params.id, req.user.id]);

    if (!rows.length) return res.status(404).json({ error: 'Task not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// PATCH /api/projects/:id/tasks/:tid/status — quick status flip
router.patch('/:id/tasks/:tid/status', requireFreelancer, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!VALID_TASK_STATUS.includes(status))
      return res.status(400).json({ error: `status must be one of: ${VALID_TASK_STATUS.join(', ')}` });

    const { rows } = await pool.query(`
      UPDATE tasks SET status=$1, updated_at=NOW()
      WHERE id=$2 AND project_id=$3 AND freelancer_id=$4
      RETURNING *
    `, [status, req.params.tid, req.params.id, req.user.id]);

    if (!rows.length) return res.status(404).json({ error: 'Task not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// DELETE /api/projects/:id/tasks/:tid
router.delete('/:id/tasks/:tid', requireFreelancer, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM tasks WHERE id=$1 AND project_id=$2 AND freelancer_id=$3 RETURNING id',
      [req.params.tid, req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Task deleted' });
  } catch (e) { next(e); }
});

module.exports = router;
