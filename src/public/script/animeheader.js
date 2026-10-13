const searchInput = document.getElementById('anime-search-input');
const searchBar = document.getElementById('search-suggestions');
let debounceTimer;
searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const query = searchInput.value.trim();
    if (query.length < 2) {
        searchBar.innerHTML = '';
        searchBar.style.display = 'none';
        return;
    }
    debounceTimer = setTimeout(() => {
        fetchSuggestions(query);
    }, 300);
});
async function fetchSuggestions(query) {
    try {
        const response = await fetch(`https://rranime.online/api/anime-search?q=${encodeURIComponent(query)}`);
        const animeList = await response.json();
        if (animeList.length === 0) {
            searchBar.style.display = 'none';
            return;
        }
        searchBar.innerHTML = animeList.map(anime => `
            <div class="suggestion-item" data-title="${anime.title}">
                <img src="${anime.image_url}" alt="${anime.title}" class="suggestion-thumb">
                <div class="suggestion-info">
                    <span class="suggestion-title">${anime.title}</span>
                    <small class="suggestion-meta">${anime.type} • ⭐ ${anime.score || 'N/A'}</small>
                </div>
            </div>
        `).join('');
        searchBar.style.display = 'block';
    } catch (error) {
        console.error('Error fetching anime suggestions:', error);
    }
}
searchBar.addEventListener('click', (e) => {
    const item = e.target.closest('.suggestion-item');
    if (item) {
        searchInput.value = item.dataset.title;
        searchBar.style.display = 'none';
        item.closest('form').submit();
    }
});
document.addEventListener('click', (e) => {
    if (!e.target.closest('.drawer-search-wrapper')) {
        searchBar.style.display = 'none';
    }
});