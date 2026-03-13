async function loadStats() {
    const res = await fetch("/api/history", {
        headers: { "Authorization": "Bearer " + localStorage.getItem("token") }
    });

    const routes = await res.json();

    let totalTrips = routes.length;
    let totalCost = routes.reduce((sum, r) => sum + r.fuelCost, 0);

    document.getElementById("stats").innerHTML = `
        <p>Total Trips: ${totalTrips}</p>
        <p>Total Fuel Cost: ₱${totalCost.toFixed(2)}</p>
    `;
}

loadStats();

function logout() {
    localStorage.removeItem("token");
    window.location = "login.html";
}
