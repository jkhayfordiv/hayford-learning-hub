const fs = require('fs');

function fix(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 1. Remove line number patterns like "\n664: " or "\n  664: "
    content = content.replace(/\n\s*\d+: /g, '\n');
    
    // 2. Fix known specific corruptions from previous turns
    content = content.replace(/\]\s*,\s*academic_r\s*\"correc/g, '], \"correctAnswer\": \"');
    content = content.replace(/working\.\" \],academic_r \"correc/g, 'working.\" ], \"correctAnswer\": \"');
    content = content.replace(/\} \] \{/g, '}, {');
    
    // 3. Flatten fragmented structures
    content = content.replace(/\]\s*\}\s*\]\s*\}\s*\{\s*\"levels\":\s*\[/g, ',');
    content = content.replace(/\]\s*\}\s*\]\s*\}\s*\{/g, ',');
    content = content.replace(/\}\s*\]\s*\{\s*\"levels\":\s*\[/g, ',');
    content = content.replace(/\}\s*\]\s*\{\s*\"questionBank\":\s*\[/g, ',');
    
    // 4. Fix redundant/missing braces at common boundaries
    content = content.replace(/explanation\": \"[^\"]*\"\s*\]/g, (m) => m.replace(']', '  }  ]'));
    
    fs.writeFileSync(filePath, content);
    console.log('Fixed ' + filePath);
}

fix('apps/grammar-lab/src/data/02_countability_and_plurals.json');
fix('apps/grammar-lab/src/data/20_hedging.json');
fix('apps/grammar-lab/src/data/01_article_usage.json');
fix('apps/grammar-lab/src/data/03_subject_verb_agreement.json');
// Checking these too just in case.
