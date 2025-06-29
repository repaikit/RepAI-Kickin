const axios = require('axios');

async function simulateWins() {
  const USER_ID = "6831c304e6e6fb1b725091bc"; // Anh Nguyễn
  const API_URL = "http://localhost:5000/api/victory_nft/simulate-win/";
  
  try {
    console.log("🎮 Simulating user wins to reach milestone...");
    console.log("User ID:", USER_ID);
    console.log("Target: 90 wins (milestone 9)");
    
    // Simulate wins to reach 90
    const response = await axios.post(`${API_URL}${USER_ID}`, {}, {
      headers: {
        'Content-Type': 'application/json',
        // Add your admin token here if needed
        // 'Authorization': 'Bearer YOUR_ADMIN_TOKEN'
      }
    });
    
    console.log("✅ Response:", response.data);
    
    if (response.data.success) {
      console.log("🎉 User now has 90 wins!");
      console.log("📱 Check frontend Victory NFT component - dropdown should now be visible!");
    }
    
  } catch (error) {
    console.error("❌ Error simulating wins:", error.response?.data || error.message);
  }
}

simulateWins(); 