
if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark");
}


async function loadRecords() {
    try {
        const res = await fetch("/api/trips", {
            headers: { "Authorization": "Bearer " + localStorage.getItem("token") }
        });

        
        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                logout();
                return;
            }
            throw new Error("Failed to load records");
        }

        const trips = await res.json();
        const listContainer = document.getElementById("list");

        
        if (trips.length === 0) {
            listContainer.innerHTML = `
                <div class="glass" style="text-align:center; padding: 30px; opacity: 0.8; border-radius: 12px;">
                    📭 No deliveries completed yet. Time to hit the road!
                </div>`;
            return;
        }

        let html = "";
        
       
        trips.reverse().forEach(t => {
            const dateStr = new Date(t.date).toLocaleString([], { 
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
            });
            
            
            let photoHtml = "";
            if (t.proofPhoto) {
                photoHtml = `
                    <div style="margin-top: 14px; border-top: 1px solid rgba(255,255,255,0.15); padding-top: 14px;">
                        <div style="font-size: 13px; opacity: 0.8; margin-bottom: 8px; font-weight: 600;">📷 Proof of Delivery:</div>
                        <img src="${t.proofPhoto}" style="width: 100%; max-height: 250px; object-fit: cover; border-radius: 8px; border: 2px solid #00c2a8;">
                    </div>
                `;
            }

           
            html += `
                <li class="glass record-card glow" style="margin-bottom: 20px; padding: 20px; display: flex; flex-direction: column; gap: 10px;">
                    
                    <!-- Top Row: Date & Fare -->
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.15); padding-bottom: 10px; margin-bottom: 4px;">
                        <span style="font-size: 14px; opacity: 0.9;">📅 ${dateStr}</span>
                        <span style="color: #00c2a8; font-weight: 600; font-size: 20px;">₱${t.fare.toFixed(0)}</span>
                    </div>
                    
                    <!-- Routing Details -->
                    <div style="display: flex; align-items: flex-start; gap: 12px;">
                        <div style="color: #2ed573; margin-top: 2px; font-size: 18px;">🟢</div>
                        <div style="font-size: 14px;"><b>Pickup</b><br><span style="opacity: 0.85;">${t.start}</span></div>
                    </div>
                    
                    <div style="display: flex; align-items: flex-start; gap: 12px; margin-top: 4px;">
                        <div style="color: #ff4757; margin-top: 2px; font-size: 18px;">📍</div>
                        <div style="font-size: 14px;"><b>Drop-off</b><br><span style="opacity: 0.85;">${t.end}</span></div>
                    </div>

                    <!-- Inject the photo if it exists -->
                    ${photoHtml}
                </li>
            `;
        });

        listContainer.innerHTML = html;

    } catch (err) {
        console.error(err);
        document.getElementById("list").innerHTML = `
            <div class="glass" style="text-align:center; color: #ff4757; padding: 20px;">
                ⚠️ Error loading records. Make sure your server is running.
            </div>`;
    }
}


window.onload = loadRecords;

function toggleDark() {
    document.body.classList.toggle("dark");
    const isDark = document.body.classList.contains("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light"); 
}

function logout() {
    localStorage.removeItem("token");
    window.location = "login.html";
}
