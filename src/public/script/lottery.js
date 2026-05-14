async function buyTicket() {
    try {
        const response = await fetch('/shop/lottery-ticket', { method: 'POST' });
        const data = await response.json();
        alert(data.message);
        if (data.success) window.location.reload();
    } catch (err) {
        console.error("Ticket purchase execution error context:", err);
    }
}