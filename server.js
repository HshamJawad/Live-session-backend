const express = require('express');
const cors = require('cors');
const app = express();

// Middleware
// 2 MB: a full chart plus supplementary lists can exceed the 100 KB default.
app.use(express.json({ limit: '2mb' }));
app.use(cors()); // Allow all origins for MVP (restrict in production)

// In-memory storage (replace with Redis or database in production)
const sessions = new Map();
const votes = new Map();
// sessionId -> Set of voter tokens that already voted (one vote per device).
const voters = new Map();

// ── Helpers ──────────────────────────────────────────────────────────────
const crypto = require('crypto');

// Debug/admin endpoints are OFF unless ADMIN_TOKEN is set, and then need the
// header  x-admin-token: <ADMIN_TOKEN>.
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

// One vote per voter token. The token is a random string the voting page makes
// once per device and session. Older pages send none: they are still accepted
// unless REQUIRE_VOTER_TOKEN=1 is set once every participant uses the new page.
const REQUIRE_VOTER_TOKEN = process.env.REQUIRE_VOTER_TOKEN === '1';
const VOTER_TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

function adminGuard(req, res, next) {
  if (!ADMIN_TOKEN) {
    return res.status(404).json({ success: false, error: 'Not found' });
  }
  const given = Buffer.from(String(req.headers['x-admin-token'] || ''));
  const wanted = Buffer.from(ADMIN_TOKEN);
  const ok = given.length === wanted.length && crypto.timingSafeEqual(given, wanted);
  if (!ok) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
}

// A rating is a number from 0 to 3 (numeric strings are accepted). Anything
// else — NaN, text, 9999, null, booleans — is rejected.
function cleanRating(v) {
  if (typeof v === 'boolean' || v === null || v === '') return null;
  const n = typeof v === 'number' ? v : (typeof v === 'string' ? Number(v) : NaN);
  return Number.isFinite(n) && n >= 0 && n <= 3 ? n : null;
}

const isPlainObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);

// Every task of a session's data, tolerating missing or malformed duties/tasks.
function forEachTask(sessionData, cb) {
  const duties = sessionData && sessionData.duties;
  if (!duties || typeof duties !== 'object') return;
  Object.keys(duties).forEach(dutyId => {
    const duty = duties[dutyId];
    if (!duty || !Array.isArray(duty.tasks)) return;
    duty.tasks.forEach(task => {
      if (task && task.id !== undefined && task.id !== null) cb(duty, task);
    });
  });
}

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'DACUM Live Workshop API',
    activeSessions: sessions.size
  });
});

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * POST /api/create-session
 * Creates a new live workshop session with finalized duties/tasks
 */
app.post('/api/create-session', (req, res) => {
  try {
    const { sessionId, data } = req.body;
    
    // Validation
    if (!sessionId || !data) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: sessionId, data' 
      });
    }
    
    if (!data.occupation || !data.duties || typeof data.duties !== 'object') {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid data structure: missing occupation or duties' 
      });
    }
    
    // Store session data
    sessions.set(sessionId, {
      data: data,
      createdAt: new Date().toISOString()
    });
    
    // Initialize empty votes array for this session
    votes.set(sessionId, []);
    voters.set(sessionId, new Set());
    
    console.log(`✅ Session created: ${sessionId}`);
    
    res.json({ 
      success: true, 
      sessionId: sessionId,
      message: 'Session created successfully'
    });
    
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

/**
 * GET /api/get-session/:sessionId
 * Returns finalized session data for participants
 */
app.get('/api/get-session/:sessionId', (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const session = sessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({ 
        success: false, 
        error: 'Session not found' 
      });
    }
    
    console.log(`📖 Session retrieved: ${sessionId}`);
    
    res.json({ 
      success: true, 
      data: session.data 
    });
    
  } catch (error) {
    console.error('Error retrieving session:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

/**
 * POST /api/submit-vote
 * Records participant votes for a session
 */
app.post('/api/submit-vote', (req, res) => {
  try {
    const { sessionId, votes: voteData, supplementaryVotes, group, voterToken } = req.body;
    
    // Validation
    if (!sessionId || !voteData) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: sessionId, votes' 
      });
    }

    if (!isPlainObject(voteData)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid votes: expected an object keyed by task id' 
      });
    }
    
    // Check if session exists
    if (!sessions.has(sessionId)) {
      return res.status(404).json({ 
        success: false, 
        error: 'Session not found' 
      });
    }

    // Voter token: optional for older pages, malformed ones are refused.
    const hasToken = voterToken !== undefined && voterToken !== null && voterToken !== '';
    if (hasToken && (typeof voterToken !== 'string' || !VOTER_TOKEN_RE.test(voterToken))) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid voterToken' 
      });
    }
    if (!hasToken && REQUIRE_VOTER_TOKEN) {
      return res.status(400).json({ 
        success: false, 
        error: 'voterToken is required' 
      });
    }
    
    const sessionVotes = votes.get(sessionId);
    if (!voters.has(sessionId)) voters.set(sessionId, new Set());
    const sessionVoters = voters.get(sessionId);

    // Keep only ratings for tasks that really exist in this session, and only
    // when importance, frequency and difficulty are all numbers from 0 to 3.
    const validTaskIds = new Set();
    forEachTask(sessions.get(sessionId).data, (duty, task) => validTaskIds.add(String(task.id)));

    const cleanVotes = {};
    Object.keys(voteData).forEach(taskId => {
      if (!validTaskIds.has(taskId)) return;
      const v = voteData[taskId];
      if (!isPlainObject(v)) return;
      const importance = cleanRating(v.importance);
      const frequency = cleanRating(v.frequency);
      const difficulty = cleanRating(v.difficulty);
      if (importance === null || frequency === null || difficulty === null) return;
      cleanVotes[taskId] = { importance, frequency, difficulty };
    });
    
    // Add timestamp to vote
    // Optional — who voted: 'workshop' (in the room, the default) or
    // 'external' (the link sent to practitioners outside the workshop,
    // DACUM Live Pro 3.134+). Older clients never send it.
    const voteRecord = {
      votes: cleanVotes,
      group: group === 'external' ? 'external' : 'workshop',
      timestamp: new Date().toISOString()
    };

    // Optional — Supplementary Occupational Verification ratings
    // ({ itemId: 0-3 }). Stored apart from task votes; older clients
    // simply never send the field.
    if (isPlainObject(supplementaryVotes)) {
      const clean = {};
      Object.keys(supplementaryVotes).forEach(id => {
        const v = cleanRating(supplementaryVotes[id]);
        if (v !== null && Number.isInteger(v)) clean[id] = v;
      });
      voteRecord.supplementaryVotes = clean;
    }

    // Nothing usable in this submission → refuse it instead of counting it.
    if (!Object.keys(cleanVotes).length &&
        !(voteRecord.supplementaryVotes && Object.keys(voteRecord.supplementaryVotes).length)) {
      return res.status(400).json({ 
        success: false, 
        error: 'No valid ratings: each task needs importance, frequency and difficulty from 0 to 3' 
      });
    }
    
    // One vote per token. Checked last so a refused submission never uses
    // up the token.
    if (hasToken) {
      if (sessionVoters.has(voterToken)) {
        return res.status(409).json({ 
          success: false, 
          code: 'already_voted',
          error: 'This device has already voted in this session' 
        });
      }
      sessionVoters.add(voterToken);
    }

    sessionVotes.push(voteRecord);
    
    console.log(`✅ Vote submitted for session: ${sessionId} (Total votes: ${sessionVotes.length})`);
    
    res.json({ 
      success: true, 
      message: 'Vote recorded successfully',
      totalVotes: sessionVotes.length
    });
    
  } catch (error) {
    console.error('Error submitting vote:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

/**
 * GET /api/get-results/:sessionId
 * Returns aggregated voting results for a session
 */
app.get('/api/get-results/:sessionId', (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const session = sessions.get(sessionId);
    const sessionVotes = votes.get(sessionId);
    
    if (!session || !sessionVotes) {
      return res.status(404).json({ 
        success: false, 
        error: 'Session not found' 
      });
    }
    
    const totalVotes = sessionVotes.length;
    // How many voted in each group (3.134+). Votes stored before groups
    // existed have none and count as workshop.
    const groupCounts = { workshop: 0, external: 0 };
    sessionVotes.forEach(v => { groupCounts[v.group === 'external' ? 'external' : 'workshop']++; });
    
    // If no votes yet, return empty results
    if (totalVotes === 0) {
      return res.json({ 
        success: true, 
        data: { 
          totalVotes: 0, 
          taskResults: {},
          groupCounts
        } 
      });
    }
    
    const taskResults = {};
    const sessionData = session.data;
    
    // Aggregate votes for each task. Averages are over the people who
    // actually rated THAT task, not over everyone who voted in the session.
    forEachTask(sessionData, (duty, task) => {
      const taskId = task.id;
      
      let sumImportance = 0;
      let sumFrequency = 0;
      let sumDifficulty = 0;
      let responses = 0;
      
      sessionVotes.forEach(voteRecord => {
        const vote = voteRecord.votes && voteRecord.votes[taskId];
        const importance = vote && cleanRating(vote.importance);
        const frequency = vote && cleanRating(vote.frequency);
        const difficulty = vote && cleanRating(vote.difficulty);
        if (importance === null || frequency === null || difficulty === null || !vote) return;
        sumImportance += importance;
        sumFrequency += frequency;
        sumDifficulty += difficulty;
        responses++;
      });
      
      const avgImportance = responses ? sumImportance / responses : 0;
      const avgFrequency = responses ? sumFrequency / responses : 0;
      const avgDifficulty = responses ? sumDifficulty / responses : 0;
      
      // Priority index (Importance × Frequency)
      const priorityIndex = avgImportance * avgFrequency;
      
      taskResults[taskId] = {
        dutyTitle: duty.title,
        taskText: task.text,
        avgImportance: avgImportance,
        avgFrequency: avgFrequency,
        avgDifficulty: avgDifficulty,
        priorityIndex: priorityIndex,
        responses: responses
      };
    });
    
    // ── Supplementary Occupational Verification ──────────────────
    // Only for sessions created with a `supplementary` block. Returned
    // as raw 0-3 COUNTS per item (the same shape the tool's workshop
    // mode uses), under its own key — task results and the Priority
    // Index above are computed exactly as before and never mixed in.
    const responseData = {
      totalVotes: totalVotes,
      taskResults: taskResults,
      groupCounts
    };

    const supp = sessionData.supplementary;
    if (supp && Array.isArray(supp.categories)) {
      const supplementaryResults = {};
      supp.categories.forEach(cat => {
        (cat.items || []).forEach(item => {
          const counts = { 0: 0, 1: 0, 2: 0, 3: 0 };
          let responses = 0, sum = 0;
          sessionVotes.forEach(voteRecord => {
            const v = voteRecord.supplementaryVotes && voteRecord.supplementaryVotes[item.id];
            if (v === 0 || v === 1 || v === 2 || v === 3) {
              counts[v]++; responses++; sum += v;
            }
          });
          supplementaryResults[item.id] = {
            categoryId: cat.id,
            categoryName: cat.name,
            text: item.text,
            counts,
            responses,
            mean: responses ? sum / responses : null
          };
        });
      });
      responseData.supplementaryResults = supplementaryResults;
    }

    console.log(`📊 Results retrieved for session: ${sessionId} (${totalVotes} votes)`);
    
    res.json({ 
      success: true, 
      data: responseData
    });
    
  } catch (error) {
    console.error('Error retrieving results:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// ============================================================================
// ADMIN/DEBUG ENDPOINTS — disabled unless ADMIN_TOKEN is set; then they
// require the header  x-admin-token
// ============================================================================

/**
 * GET /api/debug/sessions
 * Lists all active sessions (for debugging)
 */
app.get('/api/debug/sessions', adminGuard, (req, res) => {
  const sessionList = [];
  sessions.forEach((session, sessionId) => {
    const voteCount = votes.get(sessionId)?.length || 0;
    sessionList.push({
      sessionId: sessionId,
      occupation: session.data.occupation,
      createdAt: session.createdAt,
      voteCount: voteCount
    });
  });
  
  res.json({ 
    success: true, 
    sessions: sessionList 
  });
});

/**
 * DELETE /api/debug/session/:sessionId
 * Deletes a session (for debugging)
 */
app.delete('/api/debug/session/:sessionId', adminGuard, (req, res) => {
  const sessionId = req.params.sessionId;
  
  if (sessions.has(sessionId)) {
    sessions.delete(sessionId);
    votes.delete(sessionId);
    voters.delete(sessionId);
    
    console.log(`🗑️ Session deleted: ${sessionId}`);
    
    res.json({ 
      success: true, 
      message: 'Session deleted' 
    });
  } else {
    res.status(404).json({ 
      success: false, 
      error: 'Session not found' 
    });
  }
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════╗
  ║  DACUM Live Workshop API Server              ║
  ║  Status: Running                             ║
  ║  Port: ${PORT}                                   ║
  ╚══════════════════════════════════════════════╝
  
  Endpoints:
  - GET  /                        → Health check
  - POST /api/create-session      → Create session
  - GET  /api/get-session/:id     → Get session data
  - POST /api/submit-vote         → Submit vote
  - GET  /api/get-results/:id     → Get results
  
  Debug Endpoints (need ADMIN_TOKEN + x-admin-token header):
  - GET    /api/debug/sessions    → List all sessions
  - DELETE /api/debug/session/:id → Delete session
  `);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
