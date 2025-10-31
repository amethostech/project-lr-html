
//--- signup request -----

import { API_BASE_URL } from "../config/constants.js";
const signupform = document.getElementById('signupForm');

if (signupform) {
    signupform.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const phone = document.getElementById('phone').value;
        const password = document.getElementById('password').value;
        const confirm_password = document.getElementById('confirm_password').value;


        if (password !== confirm_password) {
            alert("Passwords do not match!");
            return;
        }

        try {

            const response = await fetch(`${API_BASE_URL}api/auth/register`, {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, email, phone, password })  

            });

            const data = await response.json();
            console.log(data);
            if (response.ok) {
                alert("Sign Up Successful! Please log in.");
                window.location.href = 'login.html'
            } else {
                alert(`Sign Up Failed: ${data.msg || 'Unknown Error'}`);
            }

        } catch (error) {
            console.error('Network Error:', error);
            alert('A network error occurred. Check server connection.');
        }
    })

}


// -----login request ---- 
const loginForm = document.getElementById('loginForm');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); 

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password }) 
            });

            const data = await response.json();
            console.log(data);
            if (response.ok) {
                localStorage.setItem('token', data.data.token);
                alert("Login Successful! Redirecting...");
                window.location.href = 'profile.html'; 
            } else {
                alert(`Login Failed: ${data.msg || 'Unknown Error'}`);
            }
        } catch (error) {
            console.error('Network Error:', error);
            alert('A network error occurred. Check server connection.');
        }
    });
}
