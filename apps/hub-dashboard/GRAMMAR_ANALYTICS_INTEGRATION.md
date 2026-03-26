# Grammar Analytics Integration Guide

## Overview
The Grammar Analytics component has been created as a standalone component that can be integrated into the TeacherDashboard.

## Files Created

### Backend
1. **`apps/hub-backend/middleware/requireRole.js`** - RBAC middleware for role-based access control
2. **`apps/hub-backend/routes/grammar.js`** - Added 3 admin endpoints:
   - `GET /api/grammar/admin/cohort-progress` - Aggregate cohort data
   - `GET /api/grammar/admin/heat-map` - Bottleneck analysis
   - `GET /api/grammar/admin/recent-submissions` - AI grading review queue

### Frontend
1. **`apps/hub-dashboard/src/services/grammarApi.js`** - API service for grammar admin endpoints
2. **`apps/hub-dashboard/src/components/GrammarAnalytics.jsx`** - Complete analytics component

## Integration Steps

### Step 1: Add Grammar Analytics Tab to TeacherDashboard.jsx

Find the tab navigation section (around line 105 where `activeTab` is defined) and add a new tab option:

```javascript
// Add to the tab navigation buttons
<button
  onClick={() => setActiveTab('grammar-analytics')}
  className={`px-6 py-3 rounded-xl font-bold transition-all ${
    activeTab === 'grammar-analytics'
      ? 'bg-[#5E1914] text-white'
      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
  }`}
>
  Grammar Analytics
</button>
```

### Step 2: Import the Component

At the top of `TeacherDashboard.jsx`, add:

```javascript
import GrammarAnalytics from './components/GrammarAnalytics';
```

### Step 3: Add Conditional Rendering

In the main content area where other tabs are rendered (around line 1400+), add:

```javascript
) : activeTab === 'grammar-analytics' ? (
  <GrammarAnalytics />
```

## Features Implemented

### 1. Cohort Overview Panel
- Total students enrolled
- Diagnostic completion count
- Total mastery points earned globally
- Medal distribution (Bronze/Silver/Gold)
- Completion rates by region with progress bars

### 2. Bottleneck Heat Map
- Data table showing nodes with high failure rates
- Highlights nodes with ≥40% failure rate in red
- Shows total attempts, failure rate, and average attempts per student
- Helps identify curriculum areas needing additional instruction

### 3. AI Review Queue
- Last 50 AI-graded submissions
- Student name, email, and node information
- Full student response text
- AI feedback with score
- Pass/fail status indicators

## Security

All admin endpoints are protected with:
- JWT authentication (`auth` middleware)
- Role-based access control (`requireRole('teacher', 'admin')`)
- Only teachers and admins can access analytics data

## Styling

The component uses:
- Brand colors: Sangria (#5E1914), Navy (#0A1930), Gold (#D4AF37)
- Playfair Display for headings
- Inter for body text
- Rounded-xl containers with soft shadows
- Professional, data-dense layout optimized for educators

## Testing

To test the integration:
1. Log in as a teacher or admin user
2. Navigate to the Grammar Analytics tab
3. Verify all three panels load correctly
4. Check that data refreshes when clicking the Refresh button
5. Ensure non-teacher users cannot access the endpoints (403 Forbidden)
