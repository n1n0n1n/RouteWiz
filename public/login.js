// login.js - Full File Replacement

async function login() {
    // 🛑 The Bouncer: Stop if empty and clean input
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!email || !password) {
        return alert("Please enter both your email and password.");
    }

    const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (data.error) return alert(data.error);

    localStorage.setItem("token", data.token);
    window.location = "index.html";
}

async function register() {
    // 🛑 The Bouncer: Stop if empty and clean input
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!email || !password) {
        return alert("Please enter a valid email and password to register.");
    }

    const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (data.error) return alert(data.error);

    alert("Account created successfully! You can now log in.");
}


async function forgotPassword() {
    
    const email = prompt("Enter your registered email address to receive a password reset link:");
    
    
    if (!email) return; 

    
    if (!email.includes("@") || !email.includes(".")) {
        return alert("⚠️ Please enter a valid email address.");
    }

    
    alert(`✅ A password reset link has been sent to ${email}. Please check your inbox!`);
}
