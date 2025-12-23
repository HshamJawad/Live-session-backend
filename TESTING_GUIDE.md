# Testing Guide - DACUM Live Workshop MVP

## Pre-Testing Setup

### 1. Backend Setup
```bash
cd backend
npm install
npm start
```

Backend should be running on `http://localhost:3000`

### 2. Frontend Setup
- Open `DACUM_Live_Workshop_MVP.html` in a text editor
- Update line 140:
  ```javascript
  const API_BASE = 'http://localhost:3000/api';
  ```
- Open the file in a web browser

---

## Test Suite 1: Facilitator Flow

### Test 1.1: Add Duties and Tasks
**Steps:**
1. Click "➕ Add Duty"
2. Enter duty title: "Diagnose Vehicle Systems"
3. Click "➕ Add Task"
4. Enter task text: "Perform visual inspection"
5. Click "➕ Add Task"
6. Enter task text: "Use diagnostic scanner"

**Expected:**
- ✅ Duty section appears with input field
- ✅ Each task appears in a row with remove button
- ✅ No errors in console

---

### Test 1.2: Validation (Empty Fields)
**Steps:**
1. Leave Occupation Title empty
2. Click "🔒 Finalize & Create Live Session"

**Expected:**
- ❌ Error message: "Please enter Occupation and Job Title"
- ✅ UI remains editable

---

### Test 1.3: Validation (Empty Duty Title)
**Steps:**
1. Fill Occupation Title: "Automotive Technician"
2. Fill Job Title: "Service Technician"
3. Add a duty but leave title empty
4. Add a task with text
5. Click "🔒 Finalize & Create Live Session"

**Expected:**
- ❌ Error message: "Duty 'duty_X' needs a title"
- ✅ UI remains editable

---

### Test 1.4: Validation (No Tasks)
**Steps:**
1. Fill Occupation and Job titles
2. Add duty with title but no tasks
3. Click "🔒 Finalize & Create Live Session"

**Expected:**
- ❌ Error message: "Duty 'X' needs at least one task"
- ✅ UI remains editable

---

### Test 1.5: Successful Finalization
**Steps:**
1. Fill Occupation Title: "Automotive Technician"
2. Fill Job Title: "Service Technician"
3. Add duty: "Diagnose Vehicle Systems"
   - Task 1: "Perform visual inspection"
   - Task 2: "Use diagnostic scanner"
4. Add duty: "Perform Maintenance"
   - Task 1: "Change oil and filter"
   - Task 2: "Rotate tires"
5. Click "🔒 Finalize & Create Live Session"

**Expected:**
- ✅ Success message: "Session created successfully!"
- ✅ "✅ FINALIZED" badge appears
- ✅ All input fields disabled
- ✅ Session info box appears with link
- ✅ Session ID displayed
- ✅ "Finalize" button disabled

**Verify Backend:**
```bash
curl http://localhost:3000/api/debug/sessions
```
Should show 1 session with your occupation title.

---

### Test 1.6: Copy Participant Link
**Steps:**
1. After finalization, click "📋 Copy Link"

**Expected:**
- ✅ Success message: "Link copied to clipboard!"
- ✅ Link format: `http://localhost/.../DACUM_Live_Workshop_MVP.html?session=XXXXX`

---

### Test 1.7: Try to Edit After Finalization
**Steps:**
1. After finalization, try to:
   - Edit duty title
   - Add/remove task
   - Click "Add Duty"

**Expected:**
- ❌ All edit controls disabled
- ❌ Add/Remove buttons disabled or show error

---

## Test Suite 2: Participant Flow

### Test 2.1: Access Session (Invalid Link)
**Steps:**
1. Open new browser tab
2. Navigate to: `http://localhost/.../DACUM_Live_Workshop_MVP.html?session=invalid123`

**Expected:**
- ❌ Error message: "Error loading session: Session not found"

---

### Test 2.2: Access Valid Session
**Steps:**
1. Copy participant link from facilitator view
2. Open in new tab/incognito window
3. Or manually append `?session=YOUR_SESSION_ID` to the HTML file URL

**Expected:**
- ✅ Participant view loads
- ✅ Occupation title displayed
- ✅ All duties and tasks visible (read-only)
- ✅ Each task has 3 rating scales:
  - Importance (0-3)
  - Frequency (0-3)
  - Difficulty (0-3)

---

### Test 2.3: Incomplete Voting
**Steps:**
1. Rate only Importance for first task
2. Click "✅ Submit All Votes"

**Expected:**
- ❌ Error: "Please rate all tasks on all three dimensions"
- ✅ Button remains enabled

---

### Test 2.4: Complete Voting
**Steps:**
1. Rate ALL tasks on all three dimensions
2. Example votes:
   - Task 1: Importance=3, Frequency=2, Difficulty=1
   - Task 2: Importance=2, Frequency=3, Difficulty=2
   - Task 3: Importance=3, Frequency=2, Difficulty=1
   - Task 4: Importance=2, Frequency=2, Difficulty=2
3. Click "✅ Submit All Votes"

**Expected:**
- ✅ Success message: "Votes submitted successfully!"
- ✅ Submit button disabled
- ✅ No errors in console

**Verify Backend:**
```bash
curl http://localhost:3000/api/debug/sessions
```
Should show voteCount: 1

---

### Test 2.5: Multiple Participants
**Steps:**
1. Open participant link in 2-3 different browsers/incognito windows
2. Each participant submits different ratings
3. All participants complete voting

**Expected:**
- ✅ Each vote submission succeeds
- ✅ Backend voteCount increments

**Verify Backend:**
```bash
curl http://localhost:3000/api/debug/sessions
```
Should show voteCount: 3 (or your number of participants)

---

## Test Suite 3: Results Aggregation

### Test 3.1: No Votes Yet
**Steps:**
1. In facilitator view (before any votes)
2. Click "🔄 Refresh Results"

**Expected:**
- ✅ Success message
- ℹ️ "No votes received yet" or totalVotes: 0

---

### Test 3.2: View Results After Votes
**Steps:**
1. After 2-3 participants submit votes
2. In facilitator view, click "🔄 Refresh Results"

**Expected:**
- ✅ Results table appears
- ✅ Shows "Total Participants: X"
- ✅ Table shows:
  - Duty title
  - Task text
  - Avg Importance (2 decimal places)
  - Avg Frequency (2 decimal places)
  - Avg Difficulty (2 decimal places)
  - Priority Index (2 decimal places)

**Verify Calculations:**
Example: If 2 votes:
- Vote 1: Importance=3, Frequency=2
- Vote 2: Importance=1, Frequency=2
- Expected: avgImportance=2.00, avgFrequency=2.00, priorityIndex=4.00

---

### Test 3.3: Results Update
**Steps:**
1. Note current results
2. Add another participant vote
3. Click "🔄 Refresh Results"

**Expected:**
- ✅ Total Participants count increases
- ✅ Averages recalculated correctly
- ✅ Priority Index updated

---

## Test Suite 4: Error Handling

### Test 4.1: Backend Offline
**Steps:**
1. Stop backend server (Ctrl+C)
2. Try to finalize session

**Expected:**
- ❌ Error message: "Error creating session: Failed to fetch"
- ✅ UI remains editable
- ✅ No session created

---

### Test 4.2: Network Timeout
**Steps:**
1. Set slow 3G in browser DevTools (Network tab)
2. Try operations

**Expected:**
- ⏳ Loading state (if implemented)
- ❌ Error message on failure
- ✅ Graceful degradation

---

### Test 4.3: Invalid Session ID Format
**Steps:**
1. Manually navigate to: `?session=<script>alert('xss')</script>`

**Expected:**
- ❌ Error: "Session not found"
- ✅ No XSS execution
- ✅ Safe error handling

---

## Test Suite 5: Edge Cases

### Test 5.1: Many Tasks (Performance)
**Steps:**
1. Add 5 duties with 10 tasks each (50 total tasks)
2. Finalize session
3. Participant votes on all

**Expected:**
- ✅ Page remains responsive
- ✅ All tasks render correctly
- ✅ Vote submission succeeds
- ✅ Results display correctly

---

### Test 5.2: Long Text
**Steps:**
1. Add duty with very long title (200+ characters)
2. Add task with very long description (500+ characters)
3. Finalize and test participant view

**Expected:**
- ✅ Text displays without breaking layout
- ✅ Long text wraps appropriately
- ✅ Vote submission includes full text

---

### Test 5.3: Special Characters
**Steps:**
1. Add duty/task with special characters:
   - Quotes: "Test & 'quotes'"
   - HTML: <script>alert(1)</script>
   - Unicode: 🚗 🔧 ⚙️
2. Finalize and test

**Expected:**
- ✅ Special characters preserved
- ✅ No HTML injection
- ✅ Unicode displays correctly

---

## Test Suite 6: Browser Compatibility

Test in multiple browsers:
- ✅ Chrome/Chromium
- ✅ Firefox
- ✅ Safari
- ✅ Edge

**Test:**
1. Full facilitator flow
2. Full participant flow
3. Results display

---

## Test Suite 7: Mobile Responsiveness

**Test on:**
- Mobile browser (Chrome/Safari)
- Different screen sizes (DevTools)

**Verify:**
- ✅ Buttons are tappable
- ✅ Forms are usable
- ✅ Text is readable
- ✅ No horizontal scroll
- ✅ Rating scales work on touch

---

## Automated Testing (Optional)

Create automated tests using Postman or similar:

### Backend API Tests

**Test 1: Create Session**
```
POST http://localhost:3000/api/create-session
{
  "sessionId": "test123",
  "data": {
    "occupation": "Test Occupation",
    "duties": {
      "duty_1": {
        "title": "Test Duty",
        "tasks": [
          { "id": "duty_1_task_1", "text": "Test Task" }
        ]
      }
    }
  }
}
```
Expected: 200 OK, `{ "success": true }`

**Test 2: Get Session**
```
GET http://localhost:3000/api/get-session/test123
```
Expected: 200 OK, returns session data

**Test 3: Submit Vote**
```
POST http://localhost:3000/api/submit-vote
{
  "sessionId": "test123",
  "votes": {
    "duty_1_task_1": {
      "importance": 3,
      "frequency": 2,
      "difficulty": 1
    }
  }
}
```
Expected: 200 OK, `{ "success": true }`

**Test 4: Get Results**
```
GET http://localhost:3000/api/get-results/test123
```
Expected: 200 OK, returns aggregated results

---

## Bug Tracking Template

When you find a bug, document it:

```
**Bug ID:** BUG-001
**Severity:** High/Medium/Low
**Component:** Frontend/Backend
**Description:** [What went wrong]
**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
**Expected:** [What should happen]
**Actual:** [What actually happened]
**Browser:** Chrome 120.0
**Screenshot:** [If applicable]
**Console Errors:** [If any]
```

---

## Success Criteria

✅ All Test Suite 1 tests pass (Facilitator)
✅ All Test Suite 2 tests pass (Participant)
✅ All Test Suite 3 tests pass (Results)
✅ All Test Suite 4 tests pass (Error Handling)
✅ Works in 3+ browsers
✅ Mobile responsive
✅ No console errors
✅ No data loss
✅ Clean error messages

---

## Ready for Production?

Before deploying to Railway:
- [ ] All tests pass
- [ ] No console errors
- [ ] Error messages are user-friendly
- [ ] Mobile tested
- [ ] Multi-browser tested
- [ ] Backend deployed and tested
- [ ] Frontend API_BASE updated
- [ ] Session link works end-to-end

---

## Need Help?

If tests fail:
1. Check browser console for errors
2. Check backend logs: `npm start` output
3. Verify API_BASE URL is correct
4. Test backend endpoints directly with curl
5. Review README_MVP.md for architecture details
