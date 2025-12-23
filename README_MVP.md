# DACUM Live Workshop MVP - Technical Documentation

## Overview

This is a **minimal, reliable MVP** for live DACUM voting sessions. It provides a clean separation between:
1. **Facilitator** defines and finalizes duties/tasks
2. **System** locks data and creates session
3. **Participants** vote on finalized tasks
4. **Backend** aggregates and returns results

## Architecture Principles

### ✅ What This Does
- **Single action**: "Finalize & Create Live Session"
- **Locked state**: After finalization, duties/tasks cannot be modified
- **Snapshot approach**: Finalized data is sent to backend as immutable snapshot
- **Direct links**: Participants access via `?session=<sessionId>` URL parameter
- **On-demand results**: Facilitator manually refreshes to see aggregated votes
- **No real-time sync**: No polling, no websockets, no complexity

### ❌ What This Does NOT Do
- No database schema assumptions
- No facilitator dashboard links (facilitator already has the page open)
- No authentication system
- No automatic polling/updates
- No speculative features

---

## Data Flow

### Phase 1: Facilitator Setup
```
Facilitator opens page
  → Sees empty form
  → Adds duties (each with tasks)
  → Fills in Occupation Title & Job Title
  → Reviews duties/tasks
```

**Data Structure (in memory)**:
```javascript
duties = {
  "duty_1": {
    title: "Diagnose Vehicle Systems",
    tasks: [
      { id: "duty_1_task_1", text: "Perform visual inspection" },
      { id: "duty_1_task_2", text: "Use diagnostic scanner" }
    ]
  },
  "duty_2": {
    title: "Perform Maintenance",
    tasks: [
      { id: "duty_2_task_1", text: "Change oil and filter" },
      { id: "duty_2_task_2", text: "Rotate tires" }
    ]
  }
}
```

### Phase 2: Finalization & Session Creation
```
Facilitator clicks "Finalize & Create Live Session"
  → Validation: Check all duties have titles & tasks
  → Create snapshot of current data
  → Lock UI (disable all edit buttons)
  → Generate sessionId (timestamp + random)
  → Send to backend: POST /create-session
```

**Finalized Snapshot** (sent to backend):
```javascript
{
  sessionId: "lr8x9m2k5n",
  data: {
    occupation: "Automotive Technician",
    jobTitle: "Service Technician",
    duties: { /* deep copy of duties object */ }
  }
}
```

**Backend Expected Response**:
```javascript
{
  success: true,
  sessionId: "lr8x9m2k5n"
}
```

### Phase 3: Participant Voting
```
Participant opens: ?session=lr8x9m2k5n
  → GET /get-session/lr8x9m2k5n
  → Backend returns finalized duties/tasks
  → Render voting interface
  → Participant rates each task (0-3) on:
     - Importance
     - Frequency  
     - Difficulty
  → Click "Submit All Votes"
  → POST /submit-vote
```

**Vote Submission**:
```javascript
{
  sessionId: "lr8x9m2k5n",
  votes: {
    "duty_1_task_1": {
      importance: 3,
      frequency: 2,
      difficulty: 1
    },
    "duty_1_task_2": {
      importance: 2,
      frequency: 3,
      difficulty: 2
    }
    // ... all tasks
  }
}
```

**Backend Expected Response**:
```javascript
{
  success: true,
  message: "Vote recorded"
}
```

### Phase 4: Results Aggregation
```
Facilitator clicks "Refresh Results"
  → GET /get-results/lr8x9m2k5n
  → Backend calculates:
     - Average importance per task
     - Average frequency per task
     - Average difficulty per task
     - Priority Index (Importance × Frequency)
  → Return aggregated data
  → Display in results table
```

**Aggregated Results**:
```javascript
{
  success: true,
  data: {
    totalVotes: 12,
    taskResults: {
      "duty_1_task_1": {
        dutyTitle: "Diagnose Vehicle Systems",
        taskText: "Perform visual inspection",
        avgImportance: 2.75,
        avgFrequency: 2.33,
        avgDifficulty: 1.08,
        priorityIndex: 6.41  // (avgImportance × avgFrequency)
      },
      "duty_1_task_2": {
        dutyTitle: "Diagnose Vehicle Systems",
        taskText: "Use diagnostic scanner",
        avgImportance: 2.92,
        avgFrequency: 2.67,
        avgDifficulty: 1.83,
        priorityIndex: 7.80
      }
      // ... all tasks
    }
  }
}
```

---

## Backend Requirements

### Required Endpoints

#### 1. `POST /api/create-session`
**Purpose**: Store finalized session data

**Request**:
```json
{
  "sessionId": "lr8x9m2k5n",
  "data": {
    "occupation": "Automotive Technician",
    "jobTitle": "Service Technician",
    "duties": { /* duties object */ }
  }
}
```

**Response**:
```json
{
  "success": true,
  "sessionId": "lr8x9m2k5n"
}
```

**Implementation Notes**:
- Store session data in memory (Redis/HashMap) or database
- Session should persist for 24-48 hours minimum
- No authentication needed

---

#### 2. `GET /api/get-session/:sessionId`
**Purpose**: Return finalized session data to participants

**Response**:
```json
{
  "success": true,
  "data": {
    "occupation": "Automotive Technician",
    "jobTitle": "Service Technician",
    "duties": { /* duties object */ }
  }
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "Session not found"
}
```

---

#### 3. `POST /api/submit-vote`
**Purpose**: Record participant vote

**Request**:
```json
{
  "sessionId": "lr8x9m2k5n",
  "votes": {
    "duty_1_task_1": {
      "importance": 3,
      "frequency": 2,
      "difficulty": 1
    }
    /* ... all tasks */
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Vote recorded"
}
```

**Implementation Notes**:
- Append vote to session's vote array
- No duplicate vote prevention needed (MVP simplicity)
- Store votes with timestamp (optional for future features)

---

#### 4. `GET /api/get-results/:sessionId`
**Purpose**: Return aggregated voting results

**Response**:
```json
{
  "success": true,
  "data": {
    "totalVotes": 12,
    "taskResults": {
      "duty_1_task_1": {
        "dutyTitle": "Diagnose Vehicle Systems",
        "taskText": "Perform visual inspection",
        "avgImportance": 2.75,
        "avgFrequency": 2.33,
        "avgDifficulty": 1.08,
        "priorityIndex": 6.41
      }
      /* ... all tasks */
    }
  }
}
```

**Calculation Logic**:
```javascript
// For each task:
avgImportance = sum(all_votes.importance) / totalVotes
avgFrequency = sum(all_votes.frequency) / totalVotes
avgDifficulty = sum(all_votes.difficulty) / totalVotes
priorityIndex = avgImportance × avgFrequency
```

---

## Simple Backend Implementation Example

### Option 1: Node.js + Express + In-Memory Storage

```javascript
const express = require('express');
const app = express();
app.use(express.json());

// In-memory storage (use Redis in production)
const sessions = new Map();
const votes = new Map();

// Create session
app.post('/api/create-session', (req, res) => {
  const { sessionId, data } = req.body;
  sessions.set(sessionId, data);
  votes.set(sessionId, []);
  res.json({ success: true, sessionId });
});

// Get session
app.get('/api/get-session/:sessionId', (req, res) => {
  const data = sessions.get(req.params.sessionId);
  if (!data) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }
  res.json({ success: true, data });
});

// Submit vote
app.post('/api/submit-vote', (req, res) => {
  const { sessionId, votes: voteData } = req.body;
  const sessionVotes = votes.get(sessionId);
  if (!sessionVotes) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }
  sessionVotes.push(voteData);
  res.json({ success: true, message: 'Vote recorded' });
});

// Get results
app.get('/api/get-results/:sessionId', (req, res) => {
  const sessionData = sessions.get(req.params.sessionId);
  const sessionVotes = votes.get(req.params.sessionId);
  
  if (!sessionData || !sessionVotes) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }
  
  const totalVotes = sessionVotes.length;
  const taskResults = {};
  
  // Aggregate votes
  Object.keys(sessionData.duties).forEach(dutyId => {
    const duty = sessionData.duties[dutyId];
    duty.tasks.forEach(task => {
      const taskId = task.id;
      
      let sumImportance = 0;
      let sumFrequency = 0;
      let sumDifficulty = 0;
      
      sessionVotes.forEach(vote => {
        if (vote[taskId]) {
          sumImportance += vote[taskId].importance;
          sumFrequency += vote[taskId].frequency;
          sumDifficulty += vote[taskId].difficulty;
        }
      });
      
      const avgImportance = sumImportance / totalVotes;
      const avgFrequency = sumFrequency / totalVotes;
      const avgDifficulty = sumDifficulty / totalVotes;
      
      taskResults[taskId] = {
        dutyTitle: duty.title,
        taskText: task.text,
        avgImportance,
        avgFrequency,
        avgDifficulty,
        priorityIndex: avgImportance * avgFrequency
      };
    });
  });
  
  res.json({ success: true, data: { totalVotes, taskResults } });
});

app.listen(3000, () => console.log('Server running on port 3000'));
```

---

## Frontend Configuration

Update the API endpoint in the HTML file:

```javascript
// Line 140 in DACUM_Live_Workshop_MVP.html
const API_BASE = 'https://your-railway-app.railway.app/api';
```

Replace `your-railway-app.railway.app` with your actual Railway deployment URL.

---

## Testing Checklist

### Facilitator Tests
- ✅ Add duty with tasks
- ✅ Edit duty title and task text
- ✅ Remove duty/task
- ✅ Finalize with empty fields (should show error)
- ✅ Finalize with valid data (should lock UI)
- ✅ Try to edit after finalization (should be disabled)
- ✅ Copy participant link
- ✅ Refresh results (should show aggregated data)

### Participant Tests
- ✅ Open participant link
- ✅ See finalized duties/tasks (read-only)
- ✅ Rate all tasks on three dimensions
- ✅ Try to submit with incomplete ratings (should show error)
- ✅ Submit complete votes (should succeed)
- ✅ Try to submit again (button disabled)

### Integration Tests
- ✅ Multiple participants vote on same session
- ✅ Facilitator sees aggregated results
- ✅ Invalid session ID returns error
- ✅ Session persists after page refresh

---

## Future Enhancements (NOT in MVP)

The following features are intentionally excluded to keep the MVP simple:

- ❌ Database schema / ORM
- ❌ User authentication
- ❌ Session expiration management
- ❌ Real-time vote count display
- ❌ Vote editing/deletion
- ❌ Export results to PDF/Excel
- ❌ Multiple facilitators per session
- ❌ Session history/archive
- ❌ Participant anonymity tracking
- ❌ Advanced analytics/charts

---

## Deployment

### Frontend (Static HTML)
- Deploy to GitHub Pages, Netlify, or Vercel
- No build process needed (single HTML file)

### Backend (Node.js)
- Deploy to Railway.app (recommended)
- Set environment variables if needed
- Enable CORS for frontend domain

### Example Railway Deployment
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Deploy
railway up
```

---

## Error Handling

### Common Errors

**Error: Session not found**
- Cause: Invalid sessionId or session expired
- Solution: Check sessionId in URL matches created session

**Error: Failed to create session**
- Cause: Backend unreachable or network error
- Solution: Check API_BASE URL and backend status

**Error: Failed to submit votes**
- Cause: Incomplete ratings or network error
- Solution: Ensure all tasks rated, check network

---

## Summary

This MVP focuses on **deterministic, reliable behavior** with:
1. **Clear state transitions**: Setup → Finalize → Vote → Results
2. **Explicit actions**: No automatic behaviors
3. **Simple error messages**: Clear feedback
4. **Minimal dependencies**: Single HTML file + simple backend

The system is intentionally **not real-time** and requires **manual refresh** to keep complexity low and reliability high.

---

## Questions?

For implementation questions or issues:
- Review this README carefully
- Check browser console for errors
- Verify backend endpoint responses
- Test with simple data first

**Remember**: This is an MVP. Keep it simple. Resist the urge to add features until this core functionality is solid and tested.
