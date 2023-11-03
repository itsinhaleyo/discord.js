const { Client, Message } = require('discord.js');
const Level = require('../../models/Level');
const calculateLevelXP = require('../../utils/calculateLevelXp');
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

    const xpToGive = getRandomXp();

    const query = {
        userId: message.author.id,
        guildId: message.guild.id,
    };

    try {
        const level = await Level.findOne(query)

        if (level) {
            level.xp += xpToGive;

            if (level.xp > calculateLevelXP(level.level)) {
                let xpleft = level.xp - calculateLevelXP(level.level);
                level.xp = xpleft;
                level.level += 1;

                message.channel.send(`${message.member} you have leveled up to **level ${level.level}**`);

            }

            await level.save().catch((error) => {
                console.log(`=-=ERROR=-= ${error}`);
                return;
            });
            cooldowns.add(message.author.id);
            setTimeout(() => {
                cooldowns.delete(message.author.id);
            }, 60000);
        }
        // if (!level)
        else {
            //Create new level
            const newLevel = new Level({
                userId: message.author.id,
                guildId: message.guild.id,
                xp: xpToGive
            });

            await newLevel.save();
        }

    } catch (error) {
        console.log(`=-=ERROR=-= ${error}`);
    }
}