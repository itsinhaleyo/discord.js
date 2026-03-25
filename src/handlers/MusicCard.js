const { JSX, Builder, loadImage } = require("canvacord");

class MusicCard extends Builder {
  constructor() {
    super(600, 800); 
    this.bootstrap({
      author: "",
      currentTime: "00:00",
      totalTime: "00:00",
      progress: 0,
      image: "",
      title: "",
    });
  }

  setImage(image) {
    this.options.set("image", image);
    return this;
  }

  setTitle(title) {
    this.options.set("title", title);
    return this;
  }

  setAuthor(author) {
    this.options.set("author", author);
    return this;
  }

  setCurrentTime(time) {
    this.options.set("currentTime", time);
    return this;
  }

  setTotalTime(time) {
    this.options.set("totalTime", time);
    return this;
  }

  setProgress(progress) {
    this.options.set("progress", progress);
    return this;
  }

  async render() {
    const { author, currentTime, image, progress, title, totalTime } =
      this.options.getOptions();
    
    const art = await loadImage(image);

    return JSX.createElement(
      "div",
      {
        style: {
          background: "linear-gradient(to bottom, #120C17, #010424)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          width: "100%",
          padding: "40px"
        },
      },
      JSX.createElement("img", {
        src: art.toDataURL(),
        style: {
          borderRadius: "50%",
          height: "300px",
          width: "300px",
          marginBottom: "40px",
          objectFit: "cover",
          border: "4px solid rgba(255, 255, 255, 0.1)"
        },
      }),
      JSX.createElement(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: "50px"
          },
        },
        JSX.createElement("div", { style: { fontSize: "42px", color: "white", fontWeight: "bold", display: "flex" } }, title),
        JSX.createElement("div", { style: { fontSize: "24px", color: "#AAAAAA", marginTop: "8px", display: "flex" } }, author)
      ),
      JSX.createElement(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            width: "90%"
          },
        },
        JSX.createElement(
          "div",
          {
            style: {
              height: "8px",
              width: "100%",
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              borderRadius: "4px",
              display: "flex",
              overflow: "hidden"
            },
          },
          JSX.createElement("div", {
            style: {
              height: "100%",
              width: `${progress}%`,
              backgroundColor: "#9333EA",
              display: "flex",
            },
          })
        ),
        JSX.createElement(
          "div",
          {
            style: {
              marginTop: "12px",
              display: "flex",
              justifyContent: "space-between",
              width: "100%",
              color: "#AAAAAA",
              fontSize: "18px"
            },
          },
          JSX.createElement("div", { style: { display: "flex" } }, currentTime),
          JSX.createElement("div", { style: { display: "flex" } }, totalTime)
        )
      )
    );
  }
}

module.exports = { MusicCard };