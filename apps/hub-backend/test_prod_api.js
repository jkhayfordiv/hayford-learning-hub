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
    fs.writeFileSync('prod_api_out.json', text);
    console.log("Status:", res.status, "Wrote to prod_api_out.json");
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
