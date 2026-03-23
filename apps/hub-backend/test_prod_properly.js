require('dotenv').config();
const jwt = require('jsonwebtoken');
const fs = require('fs');

async function main() {
  const token = jwt.sign(
    { user: { id: 1, email: 'jkhayfordiv@gmail.com', role: 'super_admin' } },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  try {
    const res = await fetch('https://hayford-learning-hub.onrender.com/api/institutions', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const text = await res.text();
    fs.writeFileSync('institutions_live.json', text);
    console.log("Wrote full response to institutions_live.json");
    
    const parsed = JSON.parse(text);
    console.log("Keys in first item:", Object.keys(parsed[0]));
    console.log("Full first item:", parsed[0]);
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
