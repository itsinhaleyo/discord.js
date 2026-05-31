async function updateAllPrices() {
    const rows = document.querySelectorAll('.portfolio-row');
    const cashDisplay = document.getElementById('top-cash');
    const assetsDisplay = document.getElementById('top-assets');
    const globalPnlRender = document.getElementById('global-pnl-render');
    if (rows.length === 0) {
        if (globalPnlRender) globalPnlRender.innerText = "$0 (0.00%)";
        if (assetsDisplay) assetsDisplay.innerText = "📊 0";
        return;
    }
    let totalCurrentValue = 0;
    let totalInitialCost = 0;
    let latestUserBalance = null;
    const rowUpdates = Array.from(rows).map(async (row) => {
        const symbol = row.dataset.symbol;
        const network = row.dataset.network;
        const contract = row.dataset.contract;
        const shares = parseFloat(row.dataset.shares);
        const entryPrice = parseFloat(row.dataset.entry);
        const marginUsed = parseFloat(row.dataset.margin);
        const side = row.dataset.side;
        const pnlCell = row.querySelector('.pos-pnl');
        const cashValueEl = row.querySelector('.pnl-cash-value');
        const percentEl = row.querySelector('.pnl-percent');
        try {
            const response = await fetch(`/callback/update/${network}/${contract}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            const currentPrice = data.Price;
            if (data.Balance !== undefined) {
                latestUserBalance = data.Balance;
            }
            if (currentPrice) {
                const pnl = (side === 'SHORT') ? (entryPrice - currentPrice) * shares : (currentPrice - entryPrice) * shares;
                const pnlPercent = ((pnl / marginUsed) * 100).toFixed(2);
                const sign = pnl >= 0 ? '+' : '';
                const color = pnl >= 0 ? '#10b981' : '#ef4444';
                totalCurrentValue += (marginUsed + pnl);
                totalInitialCost += marginUsed;
                if (pnlCell && cashValueEl && percentEl) {
                    pnlCell.style.color = color;
                    cashValueEl.innerText = `${sign}💰${Math.round(pnl).toLocaleString()}`;
                    percentEl.innerText = `(${sign}${pnlPercent}%)`;
                }
            }
        } catch (err) {
            console.error(`Update failed for token context contract reference ${contract}:`, err);
        }
    });
    await Promise.all(rowUpdates);
    if (latestUserBalance !== null && cashDisplay) {
        cashDisplay.innerText = `💰 ${Number(latestUserBalance).toLocaleString()}`;
    }
    if (assetsDisplay) { 
        assetsDisplay.innerText = `📊 ${Math.round(totalCurrentValue).toLocaleString()}`; 
    }
    if (globalPnlRender && totalInitialCost > 0) {
        const totalPnl = totalCurrentValue - totalInitialCost;
        const totalPnlPercent = ((totalPnl / totalInitialCost) * 100).toFixed(2);
        const totalSign = totalPnl >= 0 ? '+' : '';
        const totalColor = totalPnl >= 0 ? '#10b981' : '#ef4444';
        globalPnlRender.style.color = totalColor;
        globalPnlRender.innerHTML = `${totalSign}$${Math.round(totalPnl).toLocaleString()} (${totalSign}${totalPnlPercent}%)`;
    }
}
document.addEventListener("DOMContentLoaded", () => {
    updateAllPrices();
    setInterval(updateAllPrices, 5000);
});