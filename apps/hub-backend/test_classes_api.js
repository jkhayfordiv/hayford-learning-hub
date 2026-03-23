require('dotenv').config();
const jwt = require('jsonwebtoken');

async function main() {
  const token = jwt.sign(
    { user: { id: 1, email: 'jkhayfordiv@gmail.com', role: 'super_admin' } },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  try {
    const res = await fetch('https://hayford-learning-hub.onrender.com/api/classes?include_archived=true', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const text = await res.text();
    console.log("Status:", res.status, "Body:", text.length > 200 ? text.substring(0, 200) + '...' : text);
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
