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
    const res = await fetch('https://hayford-learning-hub.onrender.com/api/assignments', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const text = await res.text();
    const data = JSON.parse(text);
    
    if (data.length > 0) {
      fs.writeFileSync('assign_keys.json', JSON.stringify({keys: Object.keys(data[0])}, null, 2));
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
