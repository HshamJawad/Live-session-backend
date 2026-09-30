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
    
    if (!data.occupation || !data.duties) {
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
    const { sessionId, votes: voteData, supplementaryVotes } = req.body;
    
    // Validation
    if (!sessionId || !voteData) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: sessionId, votes' 
      });
    }
    
    // Check if session exists
    if (!sessions.has(sessionId)) {
      return res.status(404).json({ 
        success: false, 
        error: 'Session not found' 
      });
    }
    
    const sessionVotes = votes.get(sessionId);
    
    // Add timestamp to vote
    const voteRecord = {
      votes: voteData,
      timestamp: new Date().toISOString()
    };

    // Optional — Supplementary Occupational Verification ratings
    // ({ itemId: 0-3 }). Stored apart from task votes; older clients
    // simply never send the field.
    if (supplementaryVotes && typeof supplementaryVotes === 'object') {
      const clean = {};
      Object.keys(supplementaryVotes).forEach(id => {
        const v = parseInt(supplementaryVotes[id], 10);
        if (v >= 0 && v <= 3) clean[id] = v;
      });
      voteRecord.supplementaryVotes = clean;
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
    
    // If no votes yet, return empty results
    if (totalVotes === 0) {
      return res.json({ 
        success: true, 
        data: { 
          totalVotes: 0, 
          taskResults: {} 
        } 
      });
    }
    
    const taskResults = {};
    const sessionData = session.data;
    
    // Aggregate votes for each task
    Object.keys(sessionData.duties).forEach(dutyId => {
      const duty = sessionData.duties[dutyId];
      
      duty.tasks.forEach(task => {
        const taskId = task.id;
        
        // Sum all votes for this task
        let sumImportance = 0;
        let sumFrequency = 0;
        let sumDifficulty = 0;
        
        sessionVotes.forEach(voteRecord => {
          const vote = voteRecord.votes[taskId];
          if (vote) {
            sumImportance += vote.importance;
            sumFrequency += vote.frequency;
            sumDifficulty += vote.difficulty;
          }
        });
        
        // Calculate averages
        const avgImportance = sumImportance / totalVotes;
        const avgFrequency = sumFrequency / totalVotes;
        const avgDifficulty = sumDifficulty / totalVotes;
        
        // Calculate priority index (Importance × Frequency)
        const priorityIndex = avgImportance * avgFrequency;
        
        taskResults[taskId] = {
          dutyTitle: duty.title,
          taskText: task.text,
          avgImportance: avgImportance,
          avgFrequency: avgFrequency,
          avgDifficulty: avgDifficulty,
          priorityIndex: priorityIndex
        };
      });
    });
    
    // ── Supplementary Occupational Verification ──────────────────
    // Only for sessions created with a `supplementary` block. Returned
    // as raw 0-3 COUNTS per item (the same shape the tool's workshop
    // mode uses), under its own key — task results and the Priority
    // Index above are computed exactly as before and never mixed in.
    const responseData = {
      totalVotes: totalVotes,
      taskResults: taskResults
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
// ADMIN/DEBUG ENDPOINTS (Optional - remove in production)
// ============================================================================

/**
 * GET /api/debug/sessions
 * Lists all active sessions (for debugging)
 */
app.get('/api/debug/sessions', (req, res) => {
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
app.delete('/api/debug/session/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  
  if (sessions.has(sessionId)) {
    sessions.delete(sessionId);
    votes.delete(sessionId);
    
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
  
  Debug Endpoints:
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
