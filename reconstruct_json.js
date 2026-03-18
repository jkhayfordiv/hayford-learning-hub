const fs = require('fs');
const path = require('path');

function extractLevels(content) {
    const levels = [];
    let pos = 0;
    while (true) {
        // Find next Level object start - look for "level" property
        const start = content.indexOf('"level":', pos);
        if (start === -1) break;
        
        // Go back to the opening brace of this object
        let braceStart = content.lastIndexOf('{', start);
        if (braceStart === -1) {
            pos = start + 8;
            continue;
        }

        // Find the balanced closing brace
        let openBraces = 0;
        let end = -1;
        for (let i = braceStart; i < content.length; i++) {
            if (content[i] === '{') openBraces++;
            if (content[i] === '}') openBraces--;
            if (openBraces === 0) {
                end = i;
                break;
            }
        }
        
        if (end !== -1) {
            const chunk = content.substring(braceStart, end + 1);
            try {
                const levelObj = JSON.parse(chunk);
                // Only add if it actually looks like a level object (has level, title, questionBank)
                if (levelObj.level !== undefined && levelObj.questionBank) {
                    levels.push(levelObj);
                }
            } catch (e) {
                // If JSON.parse fails, try to fix common issues in the chunk
                try {
                    // Try removing trailing commas or other small fixes if needed,
                    // but for now let's just log failure.
                    console.log('    Failed to parse chunk at ' + braceStart);
                } catch (e2) {}
            }
            pos = end + 1;
        } else {
            pos = start + 8;
        }
    }
    return levels;
}

function fixFile(filePath) {
    console.log('Fixing ' + filePath + '...');
    let rawContent = fs.readFileSync(filePath, 'utf8');
    
    // Pre-processing: remove line numbers and compacted whitespace
    let content = rawContent.replace(/^\s*\d+: /gm, '').replace(/\r?\n/g, ' ');
    
    let topicId = path.basename(filePath, '.json');
    let topicName = topicId.replace(/^\d+_/, '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    // Try to get topic info from the raw content before it's too mangled
    const idMatch = rawContent.match(/"topicId":\s*"([^"]+)"/);
    if (idMatch) topicId = idMatch[1];
    const nameMatch = rawContent.match(/"topicName":\s*"([^"]+)"/);
    if (nameMatch) topicName = nameMatch[1];
    
    const levels = extractLevels(content);
    
    if (levels.length === 0) {
        console.log('  No levels found! Check if file is empty or format is very different.');
        return;
    }
    
    // Sort levels by level number to be safe
    levels.sort((a, b) => a.level - b.level);
    
    // Remove duplicates based on level number (keep the one with more questions)
    const uniqueLevels = [];
    const seen = new Set();
    levels.forEach(lvl => {
        if (!seen.has(lvl.level)) {
            uniqueLevels.push(lvl);
            seen.add(lvl.level);
        } else {
            // If already seen, compare question bank size
            const existingIdx = uniqueLevels.findIndex(l => l.level === lvl.level);
            if (lvl.questionBank.length > uniqueLevels[existingIdx].questionBank.length) {
                uniqueLevels[existingIdx] = lvl;
            }
        }
    });

    const result = {
        topicId: topicId,
        topicName: topicName,
        levels: uniqueLevels
    };
    
    fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
    console.log('  Successfully fixed with ' + uniqueLevels.length + ' unique levels.');
}

const dir = 'apps/grammar-lab/src/data';
fs.readdirSync(dir).filter(f => f.endsWith('.json')).forEach(f => {
    fixFile(path.join(dir, f));
});
