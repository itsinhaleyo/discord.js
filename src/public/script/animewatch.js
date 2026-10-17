document.addEventListener("DOMContentLoaded", () => {
    const theaterWrapper = document.querySelector(".video-theater-wrapper");
    const embedPlayer = document.getElementById("rranime-embed-player");
    if (!theaterWrapper || !embedPlayer) {
        console.warn("Required player components or streaming metadata fields were missing in the DOM.");
        return;
    }
    const malId = theaterWrapper.dataset.malId;
    const currentEpisode = theaterWrapper.dataset.currentEpisode;
    const audioToggleButtons = document.querySelectorAll(".audio-toggle");
    audioToggleButtons.forEach(button => {
        button.addEventListener("click", function() {
            audioToggleButtons.forEach(btn => btn.classList.remove("active"));
            this.classList.add("active");
            const selectedAudioMode = this.getAttribute("data-audio");
            const finalizedStreamUrl = `https://zokoanime.video/stream/mal/${malId}/${currentEpisode}/${selectedAudioMode}?color=ff3c20`;
            embedPlayer.src = finalizedStreamUrl;
        });
    });
    const theaterToggleButton = document.querySelector(".btn-theater-toggle");
    if (theaterToggleButton) {
        theaterToggleButton.addEventListener("click", () => {
            document.body.classList.toggle("theater-mode-dimmed");
            const lightbulbIcon = theaterToggleButton.querySelector("i");
            if (lightbulbIcon) {
                lightbulbIcon.classList.toggle("text-primary");
            }
        });
    }
});