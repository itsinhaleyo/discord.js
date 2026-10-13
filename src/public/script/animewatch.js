document.addEventListener("DOMContentLoaded", () => {
    const embedPlayer = document.getElementById("rranime-embed-player");
    const toggleButtons = document.querySelectorAll(".audio-toggle");
    toggleButtons.forEach(button => {
        button.addEventListener("click", function() {
            toggleButtons.forEach(btn => btn.classList.remove("active"));
            this.classList.add("active");
            const selectedAudioMode = this.getAttribute("data-audio");
            const targetPlayerUrl = `https://zokoanime.video/stream/mal/<%= anime.mal_id %>/<%= currentEpisode %>/${selectedAudioMode}?color=ff3c20`;
            embedPlayer.src = targetPlayerUrl;
        });
    });
});