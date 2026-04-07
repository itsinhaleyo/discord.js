async function updateAllPrices() {
    const rows = document.querySelectorAll('.portfolio-row');
    const cashDisplay = document.getElementById('top-cash');
    const assetsDisplay = document.getElementById('top-assets');
    const totalPnlDisplay = document.getElementById('top-pnl');
    let totalCurrentValue = 0;
    let totalInitialCost = 0;
    for (const row of rows) {
        const network = row.dataset.network;
        const contract = row.dataset.contract;
        const shares = parseFloat(row.dataset.shares);
        const entryPrice = parseFloat(row.dataset.entry);
        const marginUsed = parseFloat(row.dataset.margin);
        const side = row.dataset.side;
        const pnlCell = row.querySelector('.pnl-cell');
        const pnlPercentDiv = row.querySelector('.pnl-percent');
        try {
            const response = await fetch(`/callback/update/${network}/${contract}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            const currentPrice = data.Price;
            if (data.Balance !== undefined && cashDisplay) {
                cashDisplay.innerText = `💰 ${Number(data.Balance).toLocaleString()}`;
            }
            if (currentPrice) {
                let pnl;
                if (side === 'SHORT') {
                    pnl = (entryPrice - currentPrice) * shares;
                } else {
                    pnl = (currentPrice - entryPrice) * shares;
                }
                const pnlPercent = ((pnl / marginUsed) * 100).toFixed(2);
                const sign = pnl >= 0 ? '+' : '';
                const color = pnl >= 0 ? '#10b981' : '#ef4444';
                totalCurrentValue += (marginUsed + pnl);
                totalInitialCost += marginUsed;
                if (pnlCell && pnlPercentDiv) {
                    pnlCell.style.color = color;
                    pnlCell.firstChild.textContent = `${sign}💰${Math.round(pnl).toLocaleString()} `;
                    pnlPercentDiv.innerText = `(${sign}${pnlPercent}%)`;
                }
            }
        } catch (err) { console.error(`Update failed for ${contract}:`, err);  }
    }
    if (assetsDisplay) { assetsDisplay.innerText = `📊 ${Math.round(totalCurrentValue).toLocaleString()}`; }
    if (totalPnlDisplay && totalInitialCost > 0) {
        const totalPnl = totalCurrentValue - totalInitialCost;
        const totalPnlPercent = ((totalPnl / totalInitialCost) * 100).toFixed(2);
        const totalSign = totalPnl >= 0 ? '+' : '';
        const totalColor = totalPnl >= 0 ? '#10b981' : '#ef4444';
        totalPnlDisplay.innerHTML = `<span style="color: ${totalColor}">${totalSign}${Math.round(totalPnl).toLocaleString()} (${totalSign}${totalPnlPercent}%)</span>`;
    }
}
updateAllPrices();
setInterval(updateAllPrices, 10000);