const { AttachmentBuilder } = require('discord.js');
const { RankCardBuilder, Font } = require("canvacord");
const db = require('../../database/db');
const cooldowns = new Set();
Font.loadDefault();

function getRandomXp() {
    return Math.floor(Math.random() * (20 - 5 + 1)) + 5;
}

function numtoemo(number) {
    const emojiMap = {'0': '0️⃣', '1': '1️⃣', '2': '2️⃣', '3': '3️⃣', '4': '4️⃣', '5': '5️⃣', '6': '6️⃣', '7': '7️⃣', '8': '8️⃣', '9': '9️⃣'};
    return number.toString().replace(/\d/g, digit => emojiMap[digit]);
}

module.exports = async (client, message) => {
    if (!message.inGuild() || message.author.bot || cooldowns.has(message.author.id)) return;
    let xpToGive = getRandomXp();
    if (message.content.toLowerCase().includes('nigger')) { xpToGive *= 2 }
    try {
        const [rows] = await db.query("SELECT * FROM users WHERE userid = ?", [message.author.id]);
        let user = rows[0];
        if (user) {
            let newXp = Number(user.xp) + xpToGive;
            if (newXp >= (100 * Number(user.level))) {
                const newLevel = Number(user.level) + 1;
                const xpLeft = newXp - (100 * Number(user.level));
                const bonusBalance = Number(user.balance) + (100 * Number(user.level));
                await db.query(
                    'UPDATE users SET level = ?, xp = ?, balance = ? WHERE userid = ?', 
                    [newLevel, xpLeft, bonusBalance, message.author.id]
                );
                const [[rankData]] = await db.query(
                    `SELECT COUNT(*) + 1 AS \`rank\` FROM users 
                     WHERE (level > ?) OR (level = ? AND xp > ?)`, 
                    [newLevel, newLevel, xpLeft]
                );
                const rankCard = new RankCardBuilder()
                    .setAvatar(message.author.displayAvatarURL({ size: 256, extension: 'png' }))
                    .setRank(Number(rankData.rank))
                    .setLevel(newLevel)
                    .setCurrentXP(xpLeft)
                    .setRequiredXP(100 * newLevel)
                    .setUsername(message.author.username)
                    .setDisplayName(message.member.displayName || message.author.username)
                    .setBackground("#23272A")
                    .setStyles({
                        progressbar: {
                            thumb: {
                                style: {
                                    backgroundColor: "#00FF00",
                                },
                            },
                        },
                    });
                const data = await rankCard.build({ format: 'png' });
                const attachment = new AttachmentBuilder(data, { name: 'levelup.png' });
                message.channel.send({
                    content: `🎉 Congratulations ${message.member}! You reached **Level ${newLevel}** and earned **${numtoemo(100 * Number(user.level))}** 💵!`,
                    files: [attachment]
                });
            } else {
                await db.query('UPDATE users SET xp = ? WHERE userid = ?', [newXp, message.author.id]);
            }
        } else {
            const currentDate = new Date().toDateString();
            await db.query('INSERT INTO users (userid, balance, daily, xp, level) VALUES(?, ?, ?, ?, ?)', [message.author.id, 25000, currentDate, xpToGive, 1]);
        }
        cooldowns.add(message.author.id);
        setTimeout(() => cooldowns.delete(message.author.id), 10000);
    } catch (error) {
        console.error(`XP Error: ${error}`);
    }
};