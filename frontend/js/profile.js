import { API_BASE_URL } from "../config/constants.js";
document.addEventListener('DOMContentLoaded', fetchUserProfile);

async function fetchUserProfile() {
    const profileContainer = document.getElementById('profile-container');
    const token = localStorage.getItem('token');
    
    if (!token) {
        profileContainer.innerHTML = '<p style="color: red;">Error: You are not logged in. Please log in to view your profile.</p>';
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/profile`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (response.ok) {
            const user = data.data;
            profileContainer.innerHTML = `
                <p><strong>Name:</strong> ${user.name}</p>
                <p><strong>Email:</strong> ${user.email}</p>
                <p><strong>Phone No:</strong> ${user.phone}</p>
            `;
        } else {
            profileContainer.innerHTML = `<p style="color: red;">Failed to load profile: ${data.message || 'Unknown error'}</p>`;
        }
    } catch (error) {
        console.error('Fetch error:', error);
        profileContainer.innerHTML = `<p style="color: red;">Network Error. Could not connect to the server.</p>`;
    }
}

// Navigation + Logout
function goHome() {
    window.location.href = '/frontend/index.html';
}

function goDashboard() {
    window.location.href = '/frontend/pages/main.html';
}

function logout() {
    localStorage.removeItem('token');
    window.location.href = '/frontend/pages/login.html';
}
