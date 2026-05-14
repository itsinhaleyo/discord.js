const modal = document.getElementById('logout-modal');
const logoutForm = document.querySelector('.logout-section form');
if (logoutForm) {
    logoutForm.addEventListener('submit', (event) => {
        event.preventDefault();
        openLogoutModal();
    });
}
function openLogoutModal() {
    modal.classList.add('modal-visible');
    document.body.style.overflow = 'hidden';
}
function closeLogoutModal() {
    modal.classList.remove('modal-visible');
    document.body.style.overflow = '';
}
window.addEventListener('click', (event) => {
    if (event.target === modal) {
        closeLogoutModal();
    }
});