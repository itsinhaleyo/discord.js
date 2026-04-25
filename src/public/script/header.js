document.addEventListener('DOMContentLoaded', () => {
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('nav-links');
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navLinks.classList.toggle('active');
        });
    }
    const closeSelectors = '.nav-links > .casino > a, .nav-links > .dropdown > .dropdown-content > a, .nav-user-avatar';
    document.querySelectorAll(closeSelectors).forEach(link => {
        link.addEventListener('click', () => {
            hamburger?.classList.remove('active');
            navLinks?.classList.remove('active');
            document.querySelectorAll('.dropdown-content, .dropbtn').forEach(el => {
                el.classList.remove('active');
            });
        });
    });
});
function toggleDropdown(event, button) {
    const isMobile = window.innerWidth <= 768;
    if (!isMobile) return;
    event.preventDefault();
    event.stopPropagation();
    const dropdown = button.parentElement;
    const content = dropdown.querySelector('.dropdown-content');
    document.querySelectorAll('.dropdown-content').forEach(c => {
        if (c !== content) c.classList.remove('active');
    });
    document.querySelectorAll('.dropbtn').forEach(b => {
        if (b !== button) b.classList.remove('active');
    });
    button.classList.toggle('active');
    content.classList.toggle('active');
    const navLinks = document.getElementById('nav-links');
    navLinks.style.maxHeight = '1000px'; 
}