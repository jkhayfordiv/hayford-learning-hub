require('dotenv').config({ path: 'apps/hub-backend/.env' });
const jwt = require('jsonwebtoken');

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
    console.log("Status:", res.status);
    
    if (data.length > 0) {
      console.log("FIRST ITEM KEYS:", Object.keys(data[0]));
    } else {
      console.log("Empty assignments list.");
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
