require('dotenv').config();
const jwt = require('jsonwebtoken');

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
    
    console.log("Status:", res.status);
    console.log("Headers:");
    res.headers.forEach((v, k) => console.log(`  ${k}: ${v}`));
    
    const text = await res.text();
    const data = JSON.parse(text);
    console.log("Body:", JSON.stringify(data, null, 2));
    
    if (data.length > 0) {
      console.log("FIRST ITEM KEYS:", Object.keys(data[0]));
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
