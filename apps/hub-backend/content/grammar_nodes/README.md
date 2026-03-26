# Grammar Nodes Content Directory

This directory contains JSON files for all Grammar World Map nodes. Each JSON file represents a single node in the grammar learning pathway.

## How to Add Nodes

1. Create a new JSON file in this directory (e.g., `time-matrix-01.json`)
2. Follow the schema structure below
3. Run the seed script: `node scripts/seed_grammar_nodes.js`
4. The script will automatically upsert the node into the database

## Node JSON Schema

```json
{
  "node_id": "string (required, unique)",
  "region": "string (required, one of: The Time Matrix, The Architecture, The Connectors, The Modifiers, The Nuance, Diagnostic)",
  "tier": "string (required, one of: Bronze, Silver, Gold, Diagnostic)",
  "title": "string (required)",
  "description": "string (optional)",
  "display_order": "number (optional, default: 0)",
  "prerequisites": ["array of node_ids (optional, empty array = unlocked)"],
  "lesson_content_markdown": "string (markdown formatted lesson content)",
  "mastery_check": {
    "type": "string (required, one of: ai_graded_text_input, multiple_choice, fill_in_the_blank, error_correction)",
    "prompt_to_student": "string (instructions for the student)",
    "activity_data": {
      // Structure varies by type (see examples below)
    },
    "ai_grading_rubric": "string (required for ai_graded_text_input, null for others)"
  },
  "rewards": {
    "mastery_points": "number (default: 100)",
    "medal_tier": "string (matches tier)"
  }
}
```

## Activity Types

### 1. Multiple Choice

```json
"mastery_check": {
  "type": "multiple_choice",
  "prompt_to_student": "Select the best answer for each question.",
  "activity_data": {
    "questions": [
      {
        "question": "The research team _____ the data.",
        "options": ["analyze", "analyzes", "analyzed", "analyzing"],
        "correct_answer": 2,
        "category": "Time Matrix"
      }
    ]
  },
  "ai_grading_rubric": null
}
```

### 2. Fill in the Blank

```json
"mastery_check": {
  "type": "fill_in_the_blank",
  "prompt_to_student": "Fill in the blanks with the correct form.",
  "activity_data": {
    "text": "The study ___ conducted in 2020. Researchers ___ analyzing the data.",
    "blanks": [
      {
        "position": 0,
        "accepted_answers": ["was", "was being"]
      },
      {
        "position": 1,
        "accepted_answers": ["are", "have been", "are currently"]
      }
    ]
  },
  "ai_grading_rubric": null
}
```

### 3. Error Correction

```json
"mastery_check": {
  "type": "error_correction",
  "prompt_to_student": "Click on the incorrect word and type the correction.",
  "activity_data": {
    "sentence": "The data shows that temperatures is rising.",
    "errors": [
      {
        "word_index": 2,
        "incorrect_word": "shows",
        "accepted_corrections": ["show"]
      },
      {
        "word_index": 5,
        "incorrect_word": "is",
        "accepted_corrections": ["are"]
      }
    ]
  },
  "ai_grading_rubric": null
}
```

### 4. AI Graded Text Input

```json
"mastery_check": {
  "type": "ai_graded_text_input",
  "prompt_to_student": "Write 2-3 sentences using the present perfect tense to describe a recent research study.",
  "activity_data": {},
  "ai_grading_rubric": "The student must:\n1. Use present perfect tense correctly (have/has + past participle)\n2. Write 2-3 complete sentences\n3. Demonstrate understanding of unfinished time reference\n4. Use appropriate academic vocabulary\n\nPass threshold: 80% (all criteria must be met)"
}
```

## Prerequisite System

Nodes are unlocked based on strict prerequisite completion:

- **Empty array** `[]`: Node is unlocked from the start
- **With prerequisites** `["node-id-1", "node-id-2"]`: Node unlocks only when ALL listed nodes are completed

Example:
```json
{
  "node_id": "time-matrix-13",
  "prerequisites": ["time-matrix-11", "time-matrix-12"],
  ...
}
```

This node will only unlock after the student completes both `time-matrix-11` AND `time-matrix-12`.

## Naming Conventions

- **Diagnostic**: `node-0-diagnostic`
- **Time Matrix**: `time-matrix-01` through `time-matrix-28`
- **Architecture**: `architecture-01` through `architecture-29`
- **Connectors**: `connectors-01` through `connectors-28`
- **Modifiers**: `modifiers-01` through `modifiers-25`
- **Nuance**: `nuance-01` through `nuance-25`

## Running the Seed Script

```bash
cd apps/hub-backend
node scripts/seed_grammar_nodes.js
```

The script will:
- Read all JSON files from this directory
- Validate the schema
- Upsert nodes into the database (INSERT or UPDATE if exists)
- Log success/failure for each file

## Tips

1. **Test with one node first**: Create and seed a single node to verify the structure
2. **Use consistent naming**: Follow the naming conventions above
3. **Validate JSON**: Use a JSON validator before seeding
4. **Multiple accepted answers**: For client-side grading, always provide an array of acceptable variations
5. **Case insensitive**: The frontend will sanitize inputs (trim, lowercase) before validation
