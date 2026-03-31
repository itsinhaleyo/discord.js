const { JSX, Builder, loadImage } = require("canvacord");

class BalanceCard extends Builder {
    constructor() {
        super(800, 250);
        this.bootstrap({
            username: "",
            avatar: "",
            balance: "0",
            assetValue: "0",
        });
    }
    setUsername(val) { this.options.set("username", val); return this; }
    setAvatar(val) { this.options.set("avatar", val); return this; }
    setBalance(val) { this.options.set("balance", val); return this; }
    setAssetValue(val) { this.options.set("assetValue", val); return this; }
    async render() {
        const { username, avatar, balance, assetValue } = this.options.getOptions();
        const userAvatar = await loadImage(avatar || "https://cdn.discordapp.com");
        const watermark = await loadImage(`https://itsinhaleyo.online/images/bankofisrael.png`);

        return JSX.createElement(
            "div",
            { style: { display: "flex", position: "relative", alignItems: "center", padding: "40px", background: "linear-gradient(90deg, #1a1a2e 0%, #16213e 100%)", borderRadius: "20px", width: "100%", height: "100%", color: "white", overflow: "hidden" } },
            JSX.createElement("img", { src: watermark.toDataURL(), style: { position: "absolute", right: "-5px", top: "50%", transform: "translateY(-50%)", height: "300px", width: "300px", opacity: 0.2 } }),
            JSX.createElement("img", { src: userAvatar.toDataURL(), style: { width: "140px", height: "140px", borderRadius: "50%", border: "5px solid #f1c40f", marginRight: "40px" } }),
            JSX.createElement(
                "div",
                { style: { display: "flex", flexDirection: "column" } },
                JSX.createElement("div", { style: { fontSize: "32px", fontWeight: "bold", display: "flex" } }, username),
                JSX.createElement("div", { style: { fontSize: "22px", color: "#f1c40f", marginTop: "5px", display: "flex" } }, `💵 ${balance}`),
                JSX.createElement("div", { style: { fontSize: "22px", color: "#2ecc71", marginTop: "5px", display: "flex" } }, `📈 ${assetValue}`)
            )
        );
    }
}

module.exports = { BalanceCard };