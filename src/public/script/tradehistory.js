function filterHistory() {
    const selected = document.getElementById('assetFilter').value;
    const rows = document.querySelectorAll('.log-row');
    rows.forEach(row => {
        if (selected === 'ALL' || row.dataset.symbol === selected) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}