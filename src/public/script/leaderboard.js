const searchInput = document.getElementById('lbSearch');
const tableRows = document.querySelectorAll('tbody tr');
searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    tableRows.forEach(row => {
        const username = row.cells[1].textContent.toLowerCase();
        if (username.includes(term)) { row.style.display = ""; } else { row.style.display = "none"; }
    });
});
function clearSearch() {
    searchInput.value = '';
    tableRows.forEach(row => row.style.display = "");
    searchInput.focus();
}