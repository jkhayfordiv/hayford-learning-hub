const fs = require('fs');
const path = require('path');

function extractLevelObjects(content) {
    const levels = [];
    // More aggressive search for level-like objects: { "level": X, ... "questionBank": [...] }
    const levelRegex = /\{\s*\"level\":\s*(\d+)[\s\S]*?\"questionBank\":\s*\[[\s\S]*?\]\s*\}/g;
    let match;
    while ((match = levelRegex.exec(content)) !== null) {
        try {
            // Check brace balance to avoid capturing too much or too little
            let chunk = match[0];
            let open = 0;
            let endOffset = -1;
            for (let i = 0; i < chunk.length; i++) {
                if (chunk[i] === '{') open++;
                if (chunk[i] === '}') open--;
                if (open === 0) {
                    endOffset = i;
                    break;
                }
            }
            if (endOffset !== -1) {
                chunk = chunk.substring(0, endOffset + 1);
            }
            const obj = JSON.parse(chunk);
            if (obj.level !== undefined && obj.questionBank) {
                levels.push(obj);
            }
        } catch (e) {
            // Attempt to fix specific common issues if parse fails
            try {
                let chunk = match[0];
                // Remove trailing commas before closing braces/brackets
                chunk = chunk.replace(/,\s*\}/g, '}').replace(/,\s*\]/g, ']');
                const obj = JSON.parse(chunk);
                levels.push(obj);
            } catch (e2) {}
        }
    }
    return levels;
}

function fixFile(filePath) {
    console.log(`Processing ${filePath}`);
    const rawContent = fs.readFileSync(filePath, 'utf8');
    
    // Extract metadata
    let topicId = path.basename(filePath, '.json');
    let topicName = topicId.replace(/^\d+_/, '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    const idMatch = rawContent.match(/\"topicId\":\s*\"([^\"]+)\"/);
    if (idMatch) topicId = idMatch[1];
    const nameMatch = rawContent.match(/\"topicName\":\s*\"([^\"]+)\"/);
    if (nameMatch) topicName = nameMatch[1];

    const levels = extractLevelObjects(rawContent);
    
    // Dedup by level number
    const levelMap = new Map();
    levels.forEach(l => {
        if (!levelMap.has(l.level) || l.questionBank.length > levelMap.get(l.level).questionBank.length) {
            levelMap.set(l.level, l);
        }
    });
    
    const sortedLevels = Array.from(levelMap.values()).sort((a, b) => a.level - b.level);

    if (sortedLevels.length > 0) {
        const result = {
            topicId: topicId,
            topicName: topicName,
            levels: sortedLevels
        };
        fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
        console.log(`  Success: Found ${sortedLevels.length} levels.`);
    } else {
        console.log(`  Warning: No levels found in ${filePath}`);
    }
}

const dataDir = 'apps/grammar-lab/src/data';
if (fs.existsSync(dataDir)) {
    fs.readdirSync(dataDir).filter(f => f.endsWith('.json')).forEach(f => {
        fixFile(path.join(dataDir, f));
    });
}
