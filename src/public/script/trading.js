window.terminalMarketPrices = {};
async function trade(side) {
    const amountInput = document.getElementById('amount');
    const leverageInput = document.getElementById('leverage');
    const status = document.getElementById('trade-status');
    if (!amountInput || !status) return;
    const network = document.getElementById('network').value;
    const coinid = document.getElementById('coinid').value;
    const contract = document.getElementById('contract').value;
    const amount = amountInput.value;
    const leverage = parseInt(leverageInput.value) || 1;
    if (!amount || parseFloat(amount) <= 0) return alert("Please enter a valid amount");
    amountInput.disabled = true;
    if (leverageInput) leverageInput.disabled = true;
    status.innerText = `⏳ Opening ${side}...`;
    status.style.color = "white";
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
            amountInput.disabled = false;
            if (leverageInput) leverageInput.disabled = false;
        }
    } catch (err) { 
        console.error(err); 
        status.innerText = "❌ Connection error."; 
        amountInput.disabled = false;
        if (leverageInput) leverageInput.disabled = false;
    }
}
async function closePosition(symbol, network, contract, totalShares, side, leverage, isAuto = false) {
    if (!isAuto && !confirm(`Close your entire ${leverage}x ${side} ${symbol} position?`)) return;
    const status = document.getElementById('trade-status');
    if (status) {
        status.innerText = "⏳ Closing position...";
        status.style.color = "var(--text-muted)";
    }
    try {
        const response = await fetch(`/trade/sell`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                coinId: symbol,
                network: network,
                contract: contract,
                amount: parseFloat(totalShares),
                side: side,
                leverage: parseInt(leverage)
            })
        });
        const result = await response.json();
        if (result.success) {
            if (status) status.innerText = `✅ Closed ${symbol}`;
            setTimeout(() => location.reload(), 1000);
        }
    } catch (err) {
        console.error("Close Error:", err);
    }
}
async function updateLivePrice() {
    const networkEl = document.getElementById('network');
    const contractEl = document.getElementById('contract');
    const coinidEl = document.getElementById('coinid');
    if (!networkEl || !contractEl) return;
    const network = networkEl.value;
    const contract = contractEl.value;
    const currentSymbol = coinidEl ? coinidEl.value.toUpperCase() : null;
    const marketpriceDisplay = document.getElementById('marketprice');
    try {
        const response = await fetch(`/callback/update/${network}/${contract}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        if (data.Balance !== undefined) { 
            const balanceEl = document.getElementById('balance');
            if (balanceEl) balanceEl.innerText = `💰 ${data.Balance.toLocaleString()}`; 
        }
        if (data.Price) {
            if (marketpriceDisplay) marketpriceDisplay.innerText = `Market Price: ${data.Price.toFixed(2)}`;
            if (currentSymbol) {
                window.terminalMarketPrices[currentSymbol] = data.Price;
            }
            updatePositionsPnL();
        }
    } catch (err) {
        console.error("Price update failed:", err);
    }
}
function updatePositionsPnL() {
    const rows = document.querySelectorAll('.position-row');
    rows.forEach(row => {
        const symbol = row.dataset.symbol.toUpperCase();
        const currentPrice = window.terminalMarketPrices[symbol] || window.currentMarketPrice;
        if (!currentPrice) return;
        const entry = parseFloat(row.dataset.entry);
        const shares = parseFloat(row.dataset.shares);
        const margin = parseFloat(row.dataset.margin);
        const leverage = parseFloat(row.dataset.leverage);
        const side = row.dataset.side;
        const network = row.dataset.network || document.getElementById('network').value;
        const contract = row.dataset.contract || document.getElementById('contract').value;
        const tpValue = parseFloat(row.querySelector('.tp-field')?.value);
        const slValue = parseFloat(row.querySelector('.sl-field')?.value);
        const liqPrice = (side === 'LONG') ? entry * (1 - (0.8 / leverage)) : entry * (1 + (0.8 / leverage));
        const liqCell = row.querySelector('.pos-liq');
        if (liqCell) liqCell.innerText = `$${liqPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
        const pnl = (side === 'SHORT') ? (entry - currentPrice) * shares : (currentPrice - entry) * shares;
        const pnlPercent = ((pnl / margin) * 100).toFixed(2);
        const pnlCell = row.querySelector('.pos-pnl');
        const color = pnl >= 0 ? '#10b981' : '#ef4444';
        const sign = pnl >= 0 ? '+' : '';
        if (pnlCell) { 
            pnlCell.innerHTML = `<span style="color: ${color}">${sign}$${Math.round(pnl).toLocaleString()} (${sign}${pnlPercent}%)</span>`; 
        }
        const isTPHit = (side === 'LONG' && tpValue && currentPrice >= tpValue) || (side === 'SHORT' && tpValue && currentPrice <= tpValue);
        const isSLHit = (side === 'LONG' && slValue && currentPrice <= slValue) || (side === 'SHORT' && slValue && currentPrice >= slValue);
        const isLiqHit = (side === 'LONG' && currentPrice <= liqPrice) || (side === 'SHORT' && currentPrice >= liqPrice);
        if (isTPHit || isSLHit || isLiqHit) {
            closePosition(symbol, network, contract, shares, side, leverage, true);
        }
    });
}
async function updateLimits(symbol, value, type, btnElement, side, leverage) {
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
                type: type,
                side: side,
                leverage: parseInt(leverage)
            })
        });
        const data = await response.json();
        if (data.success) {
            btnElement.innerText = "✅";
            setTimeout(() => {
                btnElement.innerText = originalText;
                btnElement.disabled = false;
            }, 1500);
        } else {
            btnElement.innerText = "❌";
            setTimeout(() => { btnElement.innerText = originalText; btnElement.disabled = false; }, 2000);
        }
    } catch (err) {
        btnElement.innerText = "❌";
        setTimeout(() => { btnElement.innerText = originalText; btnElement.disabled = false; }, 2000);
    }
}
updateLivePrice();
setInterval(updateLivePrice, 5000);