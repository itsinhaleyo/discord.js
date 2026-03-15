const { Client, Message } = require('discord.js');
const db = require('../../database/db');
const cooldowns = new Set();

function getRandomXp(){
    min = Math.ceil(5);
    max = Math.floor(20);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 
 * @param {Client} client 
 * @param {Message} message 
 */

module.exports = async (client, message) => {
    if (!message.inGuild() || message.author.bot || cooldowns.has(message.author.id)) return;
    let xpToGive = getRandomXp();
    if (message.content.toLowerCase().includes('nigger')) {
        xpToGive *= 2;
    }
    try {
        let result = await db.query("SELECT * FROM users WHERE userid = ?", [message.author.id]);
        const user = result[0][0];
        if (user) {
            let newxp = Number(user.xp) + xpToGive;
            let oldxp = 100 * Number(user.level);
            if (newxp > oldxp) {
                let newbalance = Number(user.balance) + oldxp;
                let xpleft = newxp - oldxp;
                let newlevel = Number(user.level) + 1;
                db.query('UPDATE users SET level = ?, xp = ?, balance = ? WHERE userid = ?', [newlevel, xpleft, newbalance, message.author.id]);
                message.channel.send(`${message.member} you have leveled up to **level ${newlevel}**`);
            } else {
                db.query('UPDATE users SET xp = ? WHERE userid = ?', [newxp, message.author.id]);
            }
        } else {
            const currentDate = new Date().toDateString();
            db.query('INSERT INTO users VALUES(?, ?, ?, ?, ?)', [message.author.id, 25000, currentDate, xpToGive, 1]);
        }
        cooldowns.add(message.author.id);
        setTimeout(() => {
            cooldowns.delete(message.author.id);
        }, 10000);
    } catch (error) {
        console.log(`=-=ERROR=-= ${error}`);
    }
}