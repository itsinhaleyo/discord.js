async function triggerManualDraw() {
    if (!confirm('Force lottery draw sequence immediately? Current pool tickets will be flushed!')) return;
    const res = await fetch('/api/admin/lottery/draw', { method: 'POST' });
    const data = await res.json();
    alert(data.message);
    if (data.success) window.location.reload();
}
async function clearHistoryLogs() {
    if (!confirm('CRITICAL: Clear ALL past lottery history records permanently? This cannot be undone!')) return;
    const res = await fetch('/api/admin/lottery/clear-history', { method: 'DELETE' });
    const data = await res.json();
    alert(data.message);
    if (data.success) window.location.reload();
}