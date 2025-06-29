const axios = require('axios');

async function createTestUser() {
  const API_URL = "http://localhost:5000/api/users/register";
  
  const testUser = {
    username: "testuser90",
    email: "test90@example.com",
    password: "password123",
    wins: 90, // Đạt milestone 9
    total_matches: 100
  };
  
  try {
    console.log("👤 Creating test user with 90 wins...");
    
    const response = await axios.post(API_URL, testUser, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log("✅ Test user created:", response.data);
    console.log("📱 Login with this user and check Victory NFT dropdown!");
    
  } catch (error) {
    console.error("❌ Error creating test user:", error.response?.data || error.message);
  }
}

createTestUser(); 