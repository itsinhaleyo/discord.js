    async function closePosition(symbol, network, contract, totalShare, isAuto = false) {
    if (!confirm(`Close your entire ${symbol} position?`)) return;
    const status = document.getElementById('trade-status');
    status.innerText = "⏳ Closing position...";
    status.style.color = "var(--text-muted)";
    status.scrollIntoView({ behavior: 'smooth', block: 'center' });
    try {
        const response = await fetch(`/trade/sell`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                coinId: symbol,
                network: network,
                contract: contract,
                amount: totalShares,
                leverage: leverage
            })
        });
        const result = await response.json();
        if (result.success) {
            status.style.color = "#10b981";
            status.innerText = `✅ ${result.message}`;
            setTimeout(() => location.reload(), 1500);
        } else {
            status.style.color = "#ef4444";
            status.innerText = `❌ ${result.message}`;
        }
    } catch (err) {
        console.log("Close Error:", err);
        status.innerText = "❌ Connection error.";
    }
}
async function trade(side) {
    const network = document.getElementById('network').value;
    const coinid = document.getElementById('coinid').value;
    const contract = document.getElementById('contract').value;
    const amount = document.getElementById('amount').value;
    const leverage = parseInt(document.getElementById('leverage').value) || 1;
    const status = document.getElementById('trade-status');
    if(!amount || amount <= 0) return alert("Please enter a valid amount");
    status.innerText = `⏳ Opening ${side}...`;
    try {
        const response = await fetch(`/trade/buy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                coinId: coinid, network, contract, 
                amount: parseFloat(amount), leverage, side 
            })
        });
        const result = await response.json();
        if (result.success) {
            status.style.color = "#10b981";
            status.innerText = `✅ ${result.message}`;
            setTimeout(() => location.reload(), 1500);
        } else {
            status.style.color = "#ef4444";
            status.innerText = `❌ ${result.message}`;
        }
    } catch (err) { console.log(err); status.innerText = "❌ Connection error."; }
}
async function updateLivePrice() {
    const network = document.getElementById('network').value;
    const contract = document.getElementById('contract').value;
    const ownedShares = document.getElementById('display-shares').value;
    const userid = document.getElementById('userid') ? document.getElementById('userid').value : null;
    const valueDisplay = document.getElementById('live-value');
    const marketprice = document.getElementById('marketprice');
    try {
        const response = await fetch(`/callback/update/${network}/${contract}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        const price = data.Price, balance = data.Balance, leverage = data.Leverage, marginused = Number(data.Margin_used);
        if (balance !== undefined) { document.getElementById('balance').innerText = `💰 ${balance.toLocaleString()}`; }
        if (price && !isNaN(ownedShares) && !isNaN(marginused)) {
            marketprice.innerText = `Market Price: ${price.toFixed(2)}`;
            const currentTotalValue = price * ownedShares;
            const totalEntryCost = marginused * ownedShares;
            const pnl = currentTotalValue - totalEntryCost;
            const pnlPercent = ((pnl / marginused) * 100).toFixed(2);
            const pnlElement = document.getElementById('live-value');
            valueDisplay.innerText = `PnL: ${Math.round(pnl.toLocaleString())} (${pnlPercent}%)`;
            valueDisplay.style.color = pnl >= 0 ? '#00ff00' : '#ff0000';
        }
        window.currentMarketPrice = price;
        updatePositionsPnL(price);
    } catch (err) {
        console.error("Price update failed:", err);
        valueDisplay.innerText = "💰 Price Sync Error";
    }
}
function updatePositionsPnL(currentPrice) {
    const rows = document.querySelectorAll('.position-row');
    if (!currentPrice) return;
    rows.forEach(row => {
        const entry = parseFloat(row.dataset.entry);
        const shares = parseFloat(row.dataset.shares);
        const margin = parseFloat(row.dataset.margin);
        const leverage = parseFloat(row.dataset.leverage);
        const side = row.dataset.side;
        const symbol = row.dataset.symbol;
        const tpValue = parseFloat(row.querySelector('.tp-input')?.value);
        const slValue = parseFloat(row.querySelector('.sl-input')?.value);
        const liqPrice = (side === 'LONG') ? entry * (1 - (1 / leverage)) : entry * (1 + (1 / leverage));
        const liqCell = row.querySelector('.pos-liq');
        if (liqCell) liqCell.innerText = `$${liqPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
        const pnlVal = (side === 'SHORT') ? (entry - currentPrice) * shares : (currentPrice - entry) * shares;
        const currentPnlPercent = (pnlVal / margin) * 100;
        if (currentPnlPercent <= -75) {
            row.style.boxShadow = "inset 0 0 15px rgba(239, 68, 68, 0.4)";
            row.style.background = "rgba(239, 68, 68, 0.1)";
            if(liqCell) liqCell.style.color = "#ff4d4d";
        } else {
            row.style.boxShadow = "none";
            row.style.background = "transparent";
            if(liqCell) liqCell.style.color = "#f59e0b";
        }
        const pnl = (side === 'SHORT') ? (entry - currentPrice) * shares : (currentPrice - entry) * shares;
        const isTPHit = (side === 'LONG' && tpValue && currentPrice >= tpValue) || (side === 'SHORT' && tpValue && currentPrice <= tpValue);
        const isSLHit = (side === 'LONG' && slValue && currentPrice <= slValue) || (side === 'SHORT' && slValue && currentPrice >= slValue);
        if (isTPHit || isSLHit) {
            const reason = isTPHit ? "Take Profit" : "Stop Loss";
            console.log(`${reason} triggered for ${symbol}`);
            closePosition(symbol, document.getElementById('network').value, document.getElementById('contract').value, shares, true);
        }
        const pnlPercent = ((pnl / margin) * 100).toFixed(2);
        const color = pnl >= 0 ? '#10b981' : '#ef4444';
        const sign = pnl >= 0 ? '+' : '';
        row.querySelector('.pos-pnl').innerHTML = `<span style="color: ${color}">${sign}$${Math.round(pnl).toLocaleString()} (${sign}${pnlPercent}%)</span>`;
        if ((side === 'LONG' && currentPrice <= liqPrice) || (side === 'SHORT' && currentPrice >= liqPrice)) { closePosition(row.dataset.symbol, document.getElementById('network').value, document.getElementById('contract').value, shares);}
    });
}
async function updateLimits(symbol, value, type, btnElement) {
    const originalText = btnElement.innerText;
    btnElement.innerText = "⏳";
    btnElement.disabled = true;
    try {
        const response = await fetch('/trade/update-limits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                symbol: symbol, 
                value: value === "" ? null : parseFloat(value), 
                type: type 
            })
        });
        const data = await response.json();
        if (data.success) {
            btnElement.innerText = "✅";
            btnElement.style.borderColor = "#10b981";
            setTimeout(() => {
                btnElement.innerText = originalText;
                btnElement.style.borderColor = "rgba(255, 255, 255, 0.1)";
                btnElement.disabled = false;
            }, 1500);
        }
    } catch (err) {
        btnElement.innerText = "❌";
        setTimeout(() => { btnElement.innerText = originalText; btnElement.disabled = false; }, 2000);
    }
}
updateLivePrice();
setInterval(() => { updateLivePrice(); }, 5000);