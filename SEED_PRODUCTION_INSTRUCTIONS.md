# How to Seed Production Database on Render

The Time Matrix region is blank because the production database needs to be seeded with grammar nodes.

## Option 1: Using Render Shell (Recommended)

1. **Log in to Render Dashboard**
   - Go to https://dashboard.render.com
   - Navigate to your `hayford-learning-hub` backend service

2. **Open Shell**
   - Click on the "Shell" tab in the left sidebar
   - This opens a terminal connected to your production server

3. **Run the Seeding Script**
   ```bash
   cd /opt/render/project/src/apps/hub-backend
   node scripts/seed_production.js
   ```

4. **Verify Success**
   - You should see output like:
     ```
     ✅ time-matrix-01.json: time-matrix-01 (Bronze - The Time Matrix)
     ✅ time-matrix-02.json: time-matrix-02 (Bronze - The Time Matrix)
     ...
     🎉 Seeding Complete!
     ✅ Success: 29 nodes
     ```

5. **Test the Fix**
   - Refresh the Grammar World page at https://hub.hayfordacademy.com/grammar-world/hub
   - Click on "The Time Matrix" card
   - You should now see the interactive node map with grammar lessons!

## Option 2: Using Local Script with Production Database URL

If you have access to the production `DATABASE_URL`:

1. **Set Environment Variable** (Windows PowerShell):
   ```powershell
   $env:DATABASE_URL="your-production-database-url-from-render"
   ```

2. **Run Seeding Script**:
   ```bash
   cd apps/hub-backend
   node scripts/seed_production.js
   ```

## What Gets Seeded

- **1 Diagnostic Node**: The placement test (already seeded)
- **28 Time Matrix Nodes**:
  - 10 Bronze tier lessons (easier)
  - 10 Silver tier lessons (intermediate)
  - 8 Gold tier lessons (advanced)

## Troubleshooting

If seeding fails:
- Check that the Render service is running
- Verify database connection in Render environment variables
- Check Render logs for any database connection errors

## After Seeding

The Time Matrix page will display:
- Interactive pathway map with all 28 grammar nodes
- Nodes positioned in a visually appealing sine wave layout
- Prerequisites shown as connecting arrows
- Node states (locked/actionable/cleared) based on your progress
