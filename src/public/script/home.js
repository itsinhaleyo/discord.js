function updateTimer() {
    if (msLeft <= 0) {
        location.reload(); 
        return;
    }
    const hours = Math.floor(msLeft / 3600000);
    const minutes = Math.floor((msLeft % 3600000) / 60000);
    const seconds = Math.floor((msLeft % 60000) / 1000);

    document.getElementById('timer-text').innerText = 
        `${hours}h ${minutes}m ${seconds}s`;
    msLeft -= 1000;
}
if (hasClaimed) {
    const btn = document.getElementById('daily-btn');
    if(btn) {
        btn.disabled = true;
        btn.innerText = "✅ Claimed Today";
        btn.style.background = "rgba(255,255,255,0.05)";
        btn.style.color = "#94a3b8";
        document.getElementById('cooldown-timer').style.display = "block";
        setInterval(updateTimer, 1000);
        updateTimer();
    }
}
async function claimDaily() {
    const btn = document.getElementById('daily-btn');
    btn.disabled = true;
    btn.innerText = "Processing...";
    try {
        const response = await fetch('/claim-daily', { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            location.reload(); 
        } else {
            alert(data.message);
            btn.disabled = false;
            btn.innerText = "Claim Daily 💰 25,000";
        }
    } catch (err) {
        alert("Error connecting to server.");
    }
}