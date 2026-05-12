async function markAllAsRead() {
    try {
        const response = await fetch('/notifications/read-all', { method: 'POST' });
        if (response.ok) {
            window.location.reload();
        }
    } catch (err) {
        console.error('Failed to mark notifications as read', err);
    }
}
async function deleteNotification(event, notifId) {
    event.stopPropagation();
    if (!confirm('Are you sure you want to delete this notification?')) return;
    try {
        const response = await fetch(`/notifications/delete/${notifId}`, { method: 'DELETE' });
        if (response.ok) {
            const element = document.getElementById(`notif-${notifId}`);
            if (element) {
                element.style.opacity = '0';
                element.style.transform = 'translateY(10px)';
                setTimeout(() => {
                    element.remove();
                    if (document.querySelectorAll('.notification-item').length === 0) {
                        window.location.reload();
                    }
                }, 300);
            }
        }
    } catch (err) {
        console.error('Failed to delete notification', err);
    }
}