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
    
    const text = await res.text();
    const parsed = JSON.parse(text);
    console.log("Status:", res.status);
    console.log(JSON.stringify(parsed, null, 2));
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
