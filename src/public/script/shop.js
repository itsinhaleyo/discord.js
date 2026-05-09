async function buyItem(itemPath) {
    if (!confirm("Are you sure you want to purchase this item?")) return;
    try {
        const response = await fetch(`/shop/${itemPath}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const result = await response.json();
        if (result.success) {
            alert(result.message);
        } else {
            alert(result.message);
        }
    } catch (error) {
        console.error("Purchase failed:", error);
        alert("Something went wrong with the request.");
    }
}