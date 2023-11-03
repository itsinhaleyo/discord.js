// Required Imports
require('dotenv').config();
const { mongoose } = require('mongoose');
const { REST, Routes, ActivityType, ApplicationCommandOptionType, Client, IntentsBitField, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const eventHandler = require('./handlers/eventHandler');
const canvacord = require('canvacord');
const calculateLevelXp = require('./utils/calculateLevelXp');
const Level = require('./models/Level');
const { Web3 } = require('web3');
const web3 = new Web3(Web3.givenProvider || process.env.NODE_WEBSOCKET);
const calculateLevelXP = require('./utils/calculateLevelXp');
const User = require('./models/User');
const Cooldown = require('./models/Cooldown');
const Hilow = require('./models/Hilow');

// Function to get a Random Number
function getRandomNumber(x, y) {
    const range = y - x + 1;
    const randomNumber = Math.floor(Math.random() * range);
    return randomNumber + x;
}

// Turn  Numbers to Emojis
function numtoemo(numbers) {
    return numbers.toString().replace(/1/g, ':one:').replace(/2/g, ':two:').replace(/3/g, ':three:').replace(/4/g, ':four:').replace(/5/g, ':five:').replace(/6/g, ':six:').replace(/7/g, ':seven:').replace(/8/g, ':eight:').replace(/9/g, ':nine:').replace(/0/g, ':zero:');
}

// Function to Calculate Xp
async function giveXp(user, guild, interaction, range) {
    const xpToGive = getRandomNumber(5, range);

    const query = {
        userId: user,
        guildId: guild,
    };

    try {
        const level = await Level.findOne(query)

        if (level) {
            level.xp += xpToGive;

            if (level.xp > calculateLevelXP(level.level)) {
                let xpleft = level.xp - calculateLevelXP(level.level);
                level.xp = xpleft;
                level.level += 1;
                interaction.channel.send(`${interaction.member} you have leveled up to **level ${level.level}**`);
            }

            await level.save().catch((error) => {
                console.log(`=-=ERROR=-= ${error}`);
                return;
            });
        }
        // if (!level)
        else {
            //Create new level
            const newLevel = new Level({
                userId: user,
                guildId: guild,
                xp: xpToGive
            });

            await newLevel.save();
        }

    } catch (error) {
        console.log(`=-=GIVE=XP=ERROR=-= ${error}`);
    }
}

// Get SlotMachine Spins
function onexthreespinWheel(interaction, user, bet, spin) {
    const reels = [":yen:",":dollar:",":euro:",":pound:",":credit_card:"]
    const reel1 = Math.floor(Math.random()*reels.length);
    const reel2 = Math.floor(Math.random()*reels.length);
    const reel3 = Math.floor(Math.random()*reels.length);
    if (reel1 == reel2 && reel2 == reel3 && reel3 === 5) {
        if (spin === 1) {
            user.balance += bet * 50;
            user.save();
            interaction.followUp(`:fire:FREE SPIN:fire:\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n:stop_button:${reels[reel1]}${reels[reel2]}${reels[reel3]}:stop_button:\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n+${bet*50}:dollar:\n:fire:50X WIN:fire:\nYour new balance is\n${numtoemo(user.balance)}:dollar:`);
        } else {
            user.balance += bet * 50 - bet;
            user.save();
            interaction.editReply(`:stop_button::stop_button::stop_button::stop_button::stop_button:\n:stop_button:${reels[reel1]}${reels[reel2]}${reels[reel3]}:stop_button:\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n+${bet*50}:dollar:\n:fire:50X WIN:fire:\nYour new balance is\n${numtoemo(user.balance)}:dollar:`);
        }
        return 1;
    }
    if (reel1 == reel2 && reel2 == reel3 && reel3 === 4) {
        if (spin === 1) {
            user.balance += bet * 40;
            user.save();
            interaction.followUp(`:fire:FREE SPIN:fire:\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n:stop_button:${reels[reel1]}${reels[reel2]}${reels[reel3]}:stop_button:\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n+${bet*40}:dollar:\n:fire:40X WIN:fire:\nYour new balance is\n${numtoemo(user.balance)}:dollar:`);
        } else {
            user.balance += bet * 40 - bet;
            user.save();
            interaction.editReply(`:stop_button::stop_button::stop_button::stop_button::stop_button:\n:stop_button:${reels[reel1]}${reels[reel2]}${reels[reel3]}:stop_button:\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n+${bet*40}:dollar:\n:fire:40X WIN:fire:\nYour new balance is\n${numtoemo(user.balance)}:dollar:`);
        }
        return 2;
    }
    if (reel1 == reel2 && reel2 == reel3 && reel3 === 3) {
        if (spin === 1) {
            user.balance += bet * 30;
            user.save();
            interaction.followUp(`:fire:FREE SPIN:fire:\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n:stop_button:${reels[reel1]}${reels[reel2]}${reels[reel3]}:stop_button:\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n+${bet*30}:dollar:\n:fire:30X WIN:fire:\nYour new balance is\n${numtoemo(user.balance)}:dollar:`);
        } else {
            user.balance += bet * 30 - bet;
            user.save();
            interaction.editReply(`:stop_button::stop_button::stop_button::stop_button::stop_button:\n:stop_button:${reels[reel1]}${reels[reel2]}${reels[reel3]}:stop_button:\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n+${bet*30}:dollar:\n:fire:30X WIN:fire:\nYour new balance is\n${numtoemo(user.balance)}:dollar:`);
        }
        return 3;
    }
    if (reel1 == reel2 && reel2 == reel3 && reel3 === 2) {
        if (spin === 1) {
            user.balance += bet * 20;
            user.save();
            interaction.followUp(`:fire:FREE SPIN:fire:\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n:stop_button:${reels[reel1]}${reels[reel2]}${reels[reel3]}:stop_button:\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n+${bet*20}:dollar:\n:fire:20X WIN:fire:\nYour new balance is\n${numtoemo(user.balance)}:dollar:`);
        } else {
            user.balance += bet * 20 - bet;
            user.save();
            interaction.editReply(`:stop_button::stop_button::stop_button::stop_button::stop_button:\n:stop_button:${reels[reel1]}${reels[reel2]}${reels[reel3]}:stop_button:\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n+${bet*20}:dollar:\n:fire:20X WIN:fire:\nYour new balance is\n${numtoemo(user.balance)}:dollar:`);
        }
        return 4;
    }
    if (reel1 == reel2 && reel2 == reel3 && reel3 === 1) {
        if (spin === 1) {
            user.balance += bet * 10;
            user.save();
            interaction.followUp(`:fire:FREE SPIN:fire:\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n:stop_button:${reels[reel1]}${reels[reel2]}${reels[reel3]}:stop_button:\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n+${bet*10}:dollar:\n:fire:10X WIN:fire:\nYour new balance is\n${numtoemo(user.balance)}:dollar:`);
        } else {
            user.balance += bet * 10 - bet;
            user.save();
            interaction.editReply(`:stop_button::stop_button::stop_button::stop_button::stop_button:\n:stop_button:${reels[reel1]}${reels[reel2]}${reels[reel3]}:stop_button:\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n+${bet*10}:dollar:\n:fire:10X WIN:fire:\nYour new balance is\n${numtoemo(user.balance)}:dollar:`);
        }
        return 5;
    } else {
        if (spin === 1) {
            interaction.followUp(`:fire:FREE SPIN:fire:\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n:stop_button:${reels[reel1]}${reels[reel2]}${reels[reel3]}:stop_button:\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n-$0:dollar:\nYour new balance is\n${numtoemo(user.balance)}:dollar:`);
        } else {
            user.balance -= bet;
            user.save();
            interaction.editReply(`:stop_button::stop_button::stop_button::stop_button::stop_button:\n:stop_button:${reels[reel1]}${reels[reel2]}${reels[reel3]}:stop_button:\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n-${bet}:dollar:\nYour new balance is\n${numtoemo(user.balance)}:dollar:`);
        }
        return 0;
    }
}

function onexfivespinWheel(interaction, user, bet, spin) {
    const reels = [":money_with_wings:",":dollar:",":yen:",":euro:",":pound:",":credit_card:",":moneybag:"]
    const reel1 = Math.floor(Math.random()*reels.length);
    const reel2 = Math.floor(Math.random()*reels.length);
    const reel3 = Math.floor(Math.random()*reels.length);
    const reel4 = Math.floor(Math.random()*reels.length);
    const reel5 = Math.floor(Math.random()*reels.length);
    if (reel1 == reel2 && reel2 == reel3 && reel3 == reel4 && reel4 == reel5) {
        if (spin === 1) {
            user.balance += bet * 50;
            user.save();
            interaction.followUp(`:fire:FREE SPIN:fire:\n:stop_button::stop_button::stop_button::stop_button::stop_button::stop_button::stop_button:\n:stop_button:${reels[reel1]}${reels[reel2]}${reels[reel3]}${reels[reel4]}${reels[reel5]}:stop_button:\n:stop_button::stop_button::stop_button::stop_button::stop_button::stop_button::stop_button:\n+${bet*50}:dollar:\n:fire:50X WIN:fire:\nYour new balance is\n${numtoemo(user.balance)}:dollar:`);
        } else {
            user.balance += bet * 50 - bet;
            user.save();
            interaction.editReply(`:stop_button::stop_button::stop_button::stop_button::stop_button::stop_button::stop_button:\n:stop_button:${reels[reel1]}${reels[reel2]}${reels[reel3]}${reels[reel4]}${reels[reel5]}:stop_button:\n:stop_button::stop_button::stop_button::stop_button::stop_button::stop_button::stop_button:\n+${bet*50}:dollar:\n:fire:50X WIN:fire:\nYour new balance is\n${numtoemo(user.balance)}:dollar:`);
        }
        return 5;
    }
    if (reel1 == reel2 && reel2 == reel3 && reel3 == reel4 || reel1 == reel2 && reel2 == reel3 && reel3 == reel5 || reel1 == reel2 && reel2 == reel5 && reel5 == reel4 || reel5 == reel2 && reel2 == reel3 && reel3 == reel4 || reel1 == reel5 && reel5 == reel3 && reel3 == reel4) {
        if (spin === 1) {
            user.balance += bet * 25;
            user.save();
            interaction.followUp(`:fire:FREE SPIN:fire:\n:stop_button::stop_button::stop_button::stop_button::stop_button::stop_button::stop_button:\n:stop_button:${reels[reel1]}${reels[reel2]}${reels[reel3]}${reels[reel4]}${reels[reel5]}:stop_button:\n:stop_button::stop_button::stop_button::stop_button::stop_button::stop_button::stop_button:\n+${bet*25}:dollar:\n:fire:25X WIN:fire:\nYour new balance is\n${numtoemo(user.balance)}:dollar:`);
        } else {
            user.balance += bet * 25 - bet;
            user.save();
            interaction.editReply(`:stop_button::stop_button::stop_button::stop_button::stop_button::stop_button::stop_button:\n:stop_button:${reels[reel1]}${reels[reel2]}${reels[reel3]}${reels[reel4]}${reels[reel5]}:stop_button:\n:stop_button::stop_button::stop_button::stop_button::stop_button::stop_button::stop_button:\n+${bet*25}:dollar:\n:fire:25X WIN:fire:\nYour new balance is\n${numtoemo(user.balance)}:dollar:`);
        }
        return 3;
    }
    if (reel1 == reel2 && reel2 == reel3 || reel1 == reel2 && reel2 == reel4 || reel1 == reel2 && reel2 == reel5 || reel5 == reel2 && reel2 == reel4 || reel1 == reel4 && reel4 == reel5 || reel3 == reel2 && reel2 == reel5 || reel1 == reel5 && reel5 == reel3) {
        if (spin === 1) {
            user.balance += bet * 10;
            user.save();
            interaction.followUp(`:fire:FREE SPIN:fire:\n:stop_button::stop_button::stop_button::stop_button::stop_button::stop_button::stop_button:\n:stop_button:${reels[reel1]}${reels[reel2]}${reels[reel3]}${reels[reel4]}${reels[reel5]}:stop_button:\n:stop_button::stop_button::stop_button::stop_button::stop_button::stop_button::stop_button:\n+${bet*10}:dollar:\n:fire:10X WIN:fire:\nYour new balance is\n${numtoemo(user.balance)}:dollar:`);
        } else {
            user.balance += bet * 10 - bet;
            user.save();
            interaction.editReply(`:stop_button::stop_button::stop_button::stop_button::stop_button::stop_button::stop_button:\n:stop_button:${reels[reel1]}${reels[reel2]}${reels[reel3]}${reels[reel4]}${reels[reel5]}:stop_button:\n:stop_button::stop_button::stop_button::stop_button::stop_button::stop_button::stop_button:\n+${bet*10}:dollar:\n:fire:10X WIN:fire:\nYour new balance is\n${numtoemo(user.balance)}:dollar:`);
        }
        return 1;
    } else {
        if (spin === 1) {
            interaction.followUp(`:fire:FREE SPIN:fire:\n:stop_button::stop_button::stop_button::stop_button::stop_button::stop_button::stop_button:\n:stop_button:${reels[reel1]}${reels[reel2]}${reels[reel3]}${reels[reel4]}${reels[reel5]}:stop_button:\n:stop_button::stop_button::stop_button::stop_button::stop_button::stop_button::stop_button:\n-0:dollar:\nYour new balance is\n${numtoemo(user.balance)}:dollar:`);
        } else {
            user.balance -= bet;
            user.save();
            interaction.editReply(`:stop_button::stop_button::stop_button::stop_button::stop_button::stop_button::stop_button:\n:stop_button:${reels[reel1]}${reels[reel2]}${reels[reel3]}${reels[reel4]}${reels[reel5]}:stop_button:\n:stop_button::stop_button::stop_button::stop_button::stop_button::stop_button::stop_button:\n-${bet}:dollar:\nYour new balance is\n${numtoemo(user.balance)}:dollar:`);
        }
        return 0;
    }
}

function threexthreespinWheel(interaction, user, bet, spin) {
    const reels = [":flag_ca:",":flag_kp:",":flag_au:",":pirate_flag:",":flag_us:",":united_nations:",":flag_jm:",":flag_sj:",":england:",":scotland:",":flag_br:",":flag_gb:",":flag_cn:"]
    const reel1 = Math.floor(Math.random()*reels.length);
    const reel2 = Math.floor(Math.random()*reels.length);
    const reel3 = Math.floor(Math.random()*reels.length);
    const reel4 = Math.floor(Math.random()*reels.length);
    const reel5 = Math.floor(Math.random()*reels.length);
    const reel6 = Math.floor(Math.random()*reels.length);
    const reel7 = Math.floor(Math.random()*reels.length);
    const reel8 = Math.floor(Math.random()*reels.length);
    const reel9 = Math.floor(Math.random()*reels.length);
    if (reel1 == reel2 && reel2 == reel3 && reel3 == reel4 && reel4 == reel5 && reel5 == reel6 && reel6 == reel7 && reel7 == reel8 && reel8 == reel9 && reel9 == reels[3]) {
        if (spin === 1) {
            user.balance += bet * 100;
            user.save();
            interaction.followUp(`:fire:FREE SPIN:fire:\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n:stop_button:${reels[reel1]}${reels[reel2]}${reels[reel3]}:stop_button:\n:stop_button:${reels[reel4]}${reels[reel5]}${reels[reel6]}:stop_button:\n:stop_button:${reels[reel7]}${reels[reel8]}${reels[reel9]}:stop_button:\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n+${bet*100}:dollar:\n:fire:100X WIN:fire:\nYour new balance is\n${numtoemo(user.balance)}:dollar:`);
        } else {
            user.balance += bet * 100 - bet;
            user.save();
            interaction.editReply(`:stop_button::stop_button::stop_button::stop_button::stop_button:\n:stop_button:${reels[reel1]}${reels[reel2]}${reels[reel3]}:stop_button:\n:stop_button:${reels[reel4]}${reels[reel5]}${reels[reel6]}:stop_button:\n:stop_button:${reels[reel7]}${reels[reel8]}${reels[reel9]}:stop_button:\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n+${bet*100}:dollar:\n:fire:100X WIN:fire:\nYour new balance is\n${numtoemo(user.balance)}:dollar:`);
        }
        return 5;
    }
    if (reel1 == reel2 && reel2 == reel3 && reel3 == reel4 && reel4 == reel5 && reel5 == reel6 && reel6 == reel7 && reel7 == reel8 && reel8 == reel9 && reel9) {
        if (spin === 1) {
            user.balance += bet * 50;
            user.save();
            interaction.followUp(`:fire:FREE SPIN:fire:\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n:stop_button:${reels[reel1]}${reels[reel2]}${reels[reel3]}:stop_button:\n:stop_button:${reels[reel4]}${reels[reel5]}${reels[reel6]}:stop_button:\n:stop_button:${reels[reel7]}${reels[reel8]}${reels[reel9]}:stop_button:\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n+${bet*50}:dollar:\n:fire:50X WIN:fire:\nYour new balance is\n${numtoemo(user.balance)}:dollar:`);
        } else {
            user.balance += bet * 50 - bet;
            user.save();
            interaction.editReply(`:stop_button::stop_button::stop_button::stop_button::stop_button:\n:stop_button:${reels[reel1]}${reels[reel2]}${reels[reel3]}:stop_button:\n:stop_button:${reels[reel4]}${reels[reel5]}${reels[reel6]}:stop_button:\n:stop_button:${reels[reel7]}${reels[reel8]}${reels[reel9]}:stop_button:\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n+${bet*50}:dollar:\n:fire:50X WIN:fire:\nYour new balance is\n${numtoemo(user.balance)}:dollar:`);
        }
        return 5;
    }
    if (reel1 == reel2 && reel2 == reel3 && reel3 == reel4 && reel4 == reel6 && reel6 == reel7 && reel7 == reel8 && reel8 == reel9 && reel9 || reel1 == reel2 && reel2 == reel3 && reel3 == reel4 && reel4 == reel5 && reel5 == reel6 && reel6 == reel7 && reel7 == reel8 || reel1 == reel2 && reel2 == reel3 && reel3 == reel4 && reel4 == reel5 && reel5 == reel6 && reel6 == reel7 && reel7 == reel9 && reel9 || reel1 == reel2 && reel2 == reel3 && reel3 == reel4 && reel4 == reel5 && reel5 == reel6 && reel6 == reel8 && reel8 == reel9 && reel9 || reel1 == reel2 && reel2 == reel3 && reel3 == reel4 && reel4 == reel5 && reel5 == reel7 && reel7 == reel8 && reel8 == reel9 && reel9 || reel1 == reel2 && reel2 == reel3 && reel3 == reel5 && reel5 == reel6 && reel6 == reel7 && reel7 == reel8 && reel8 == reel9 && reel9 || reel1 == reel2 && reel3 == reel4 && reel4 == reel5 && reel5 == reel6 && reel6 == reel7 && reel7 == reel8 && reel8 == reel9 && reel9 || reel1 == reel3 && reel3 == reel4 && reel4 == reel5 && reel5 == reel6 && reel6 == reel7 && reel7 == reel8 && reel8 == reel9 && reel9 || reel2 == reel3 && reel3 == reel4 && reel4 == reel5 && reel5 == reel6 && reel6 == reel7 && reel7 == reel8 && reel8 == reel9 && reel9) {
        if (spin === 1) {
            user.balance += bet * 25;
            user.save();
            interaction.followUp(`:fire:FREE SPIN:fire:\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n:stop_button:${reels[reel1]}${reels[reel2]}${reels[reel3]}:stop_button:\n:stop_button:${reels[reel4]}${reels[reel5]}${reels[reel6]}:stop_button:\n:stop_button:${reels[reel7]}${reels[reel8]}${reels[reel9]}:stop_button:\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n+${bet*25}:dollar:\n:fire:25X WIN:fire:\nYour new balance is\n${numtoemo(user.balance)}:dollar:`);
        } else {
            user.balance += bet * 25 - bet;
            user.save();
            interaction.editReply(`:stop_button::stop_button::stop_button::stop_button::stop_button:\n:stop_button:${reels[reel1]}${reels[reel2]}${reels[reel3]}:stop_button:\n:stop_button:${reels[reel4]}${reels[reel5]}${reels[reel6]}:stop_button:\n:stop_button:${reels[reel7]}${reels[reel8]}${reels[reel9]}:stop_button:\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n+${bet*25}:dollar:\n:fire:25X WIN:fire:\nYour new balance is\n${numtoemo(user.balance)}:dollar:`);
        }
        return 4;
    }
    if (reel1 == reel2 && reel2 == reel3 && reel3 == reel4 && reel4 == reel5 && reel5 == reel6 && reel6 == reel7 || reel1 == reel2 && reel2 == reel3 && reel3 == reel4 && reel4 == reel5 && reel5 == reel6 && reel6 == reel8 || reel1 == reel2 && reel2 == reel3 && reel3 == reel4 && reel4 == reel5 && reel5 == reel6 && reel6 == reel9 || reel1 == reel2 && reel2 == reel3 && reel3 == reel4 && reel4 == reel5 && reel5 == reel6 && reel6 == reel7 || reel1 == reel2 && reel2 == reel3 && reel3 == reel4 && reel4 == reel5 && reel5 == reel6 && reel6 == reel8 || reel1 == reel2 && reel2 == reel3 && reel3 == reel4 && reel4 == reel5 && reel5 == reel6 && reel6 == reel9 || reel1 == reel2 && reel2 == reel4 && reel4 == reel5 && reel5 == reel7 && reel7 == reel8 && reel8 == reel9 || reel1 == reel2 && reel2 == reel4 && reel4 == reel5 && reel5 == reel7 && reel7 == reel8 && reel8 == reel6 || reel1 == reel2 && reel2 == reel4 && reel4 == reel5 && reel5 == reel7 && reel7 == reel8 && reel8 == reel3 || reel2 == reel3 && reel3 == reel5 && reel5 == reel6 && reel6 == reel8 && reel8 == reel9 && reel9 == reel1 || reel2 == reel3 && reel3 == reel5 && reel5 == reel6 && reel6 == reel8 && reel8 == reel9 && reel9 == reel4 || reel2 == reel3 && reel3 == reel5 && reel5 == reel6 && reel6 == reel8 && reel8 == reel9 && reel9 == reel7 || reel1 == reel2 && reel2 == reel3 && reel3 == reel4 && reel4 == reel6 && reel6 == reel7 && reel7 == reel9 || reel1 == reel2 && reel2 == reel3 && reel3 == reel4 && reel4 == reel7 && reel7 == reel8 && reel8 == reel9 || reel1 == reel2 && reel2 == reel3 && reel3 == reel6 && reel6 == reel7 && reel7 == reel8 && reel8 == reel9 || reel1 == reel3 && reel3 == reel4 && reel4 == reel6 && reel6 == reel7 && reel7 == reel8 && reel8 == reel9) {
        if (spin === 1) {
            user.balance += bet * 15;
            user.save();
            interaction.followUp(`:fire:FREE SPIN:fire:\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n:stop_button:${reels[reel1]}${reels[reel2]}${reels[reel3]}:stop_button:\n:stop_button:${reels[reel4]}${reels[reel5]}${reels[reel6]}:stop_button:\n:stop_button:${reels[reel7]}${reels[reel8]}${reels[reel9]}:stop_button:\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n+${bet*15}:dollar:\n:fire:15X WIN:fire:\nYour new balance is\n${numtoemo(user.balance)}:dollar:`);
        } else {
            user.balance += bet * 15 - bet;
            user.save();
            interaction.editReply(`:stop_button::stop_button::stop_button::stop_button::stop_button:\n:stop_button:${reels[reel1]}${reels[reel2]}${reels[reel3]}:stop_button:\n:stop_button:${reels[reel4]}${reels[reel5]}${reels[reel6]}:stop_button:\n:stop_button:${reels[reel7]}${reels[reel8]}${reels[reel9]}:stop_button:\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n+${bet*15}:dollar:\n:fire:15X WIN:fire:\nYour new balance is\n${numtoemo(user.balance)}:dollar:`);
        }
        return 3;
    }
    if (reel1 == reel2 && reel2 == reel3 && reel3 == reel4 && reel4 == reel5 && reel5 == reel6 || reel1 == reel2 && reel2 == reel3 && reel3 == reel7 && reel7 == reel8 && reel8 == reel9 || reel1 == reel2 && reel2 == reel3 && reel3 == reel6 && reel6 == reel9 || reel1 == reel2 && reel2 == reel3 && reel3 == reel5 && reel5 == reel8 || reel1 == reel2 && reel2 == reel3 && reel3 == reel7 && reel7 == reel4 || reel1 == reel3 && reel3 == reel4 && reel4 == reel6 && reel6 == reel7 && reel7 == reel9 || reel1 == reel2 && reel2 == reel4 && reel4 == reel5 && reel5 == reel7 && reel7 == reel8 || reel4 == reel5 && reel5 == reel6 && reel6 == reel7 && reel7 == reel8 && reel8 == reel9 || reel4 == reel5 && reel5 == reel6 && reel6 == reel1 && reel1 == reel7 || reel4 == reel5 && reel5 == reel6 && reel6 == reel2 && reel2 == reel8 || reel4 == reel5 && reel5 == reel6 && reel6 == reel9 && reel9 == reel3 || reel7 == reel8 && reel8 == reel9 && reel9 == reel1 && reel1 == reel4 || reel7 == reel8 && reel8 == reel9 && reel9 == reel2 && reel2 == reel5 || reel7 == reel8 && reel8 == reel9 && reel9 == reel3 && reel3 == reel6) {
        if (spin === 1) {
            user.balance += bet * 10;
            user.save();
            interaction.followUp(`:fire:FREE SPIN:fire:\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n:stop_button:${reels[reel1]}${reels[reel2]}${reels[reel3]}:stop_button:\n:stop_button:${reels[reel4]}${reels[reel5]}${reels[reel6]}:stop_button:\n:stop_button:${reels[reel7]}${reels[reel8]}${reels[reel9]}:stop_button:\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n+${bet*10}:dollar:\n:fire:10X WIN:fire:\nYour new balance is\n${numtoemo(user.balance)}:dollar:`);
        } else {
            user.balance += bet * 10 - bet;
            user.save();
            interaction.editReply(`:stop_button::stop_button::stop_button::stop_button::stop_button:\n:stop_button:${reels[reel1]}${reels[reel2]}${reels[reel3]}:stop_button:\n:stop_button:${reels[reel4]}${reels[reel5]}${reels[reel6]}:stop_button:\n:stop_button:${reels[reel7]}${reels[reel8]}${reels[reel9]}:stop_button:\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n+${bet*10}:dollar:\n:fire:10X WIN:fire:\nYour new balance is\n${numtoemo(user.balance)}:dollar:`);
        }
        return 2;
    }
    if (reel1 == reel2 && reel2 == reel3 || reel1 == reel5 && reel5 == reel9 || reel1 == reel4 && reel4 == reel7 || reel2 == reel5 && reel5 == reel8 || reel3 == reel5 && reel5 == reel7 || reel3 == reel6 && reel6 == reel9 || reel4 == reel5 && reel5 == reel6 || reel7 == reel8 && reel8 == reel9) {
        if (spin === 1) {
            user.balance += bet * 5;
            user.save();
            interaction.followUp(`:fire:FREE SPIN:fire:\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n:stop_button:${reels[reel1]}${reels[reel2]}${reels[reel3]}:stop_button:\n:stop_button:${reels[reel4]}${reels[reel5]}${reels[reel6]}:stop_button:\n:stop_button:${reels[reel7]}${reels[reel8]}${reels[reel9]}:stop_button:\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n+${bet*5}:dollar:\n:fire:5X WIN:fire:\nYour new balance is\n${numtoemo(user.balance)}:dollar:`);
        } else {
            user.balance += bet * 5 - bet;
            user.save();
            interaction.editReply(`:stop_button::stop_button::stop_button::stop_button::stop_button:\n:stop_button:${reels[reel1]}${reels[reel2]}${reels[reel3]}:stop_button:\n:stop_button:${reels[reel4]}${reels[reel5]}${reels[reel6]}:stop_button:\n:stop_button:${reels[reel7]}${reels[reel8]}${reels[reel9]}:stop_button:\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n+${bet*5}:dollar:\n:fire:5X WIN:fire:\nYour new balance is\n${numtoemo(user.balance)}:dollar:`);
        }
        return 1;
    } else {
        if (spin === 1) {
            interaction.followUp(`:fire:FREE SPIN:fire:\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n:stop_button:${reels[reel1]}${reels[reel2]}${reels[reel3]}:stop_button:\n:stop_button:${reels[reel4]}${reels[reel5]}${reels[reel6]}:stop_button:\n:stop_button:${reels[reel7]}${reels[reel8]}${reels[reel9]}:stop_button:\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n-$0:dollar:\nYour new balance is\n${numtoemo(user.balance)}:dollar:`);
        } else {
            user.balance -= bet;
            user.save();
            interaction.editReply(`:stop_button::stop_button::stop_button::stop_button::stop_button:\n:stop_button:${reels[reel1]}${reels[reel2]}${reels[reel3]}:stop_button:\n:stop_button:${reels[reel4]}${reels[reel5]}${reels[reel6]}:stop_button:\n:stop_button:${reels[reel7]}${reels[reel8]}${reels[reel9]}:stop_button:\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n-${bet}:dollar:\nYour new balance is\n${numtoemo(user.balance)}:dollar:`);
        }
        return 0;
    }
}

// Get HashDice Odds
function getOdds(hl, num) {
    if (hl === 1) {
        if (num === 1) {
            return ({
                win: 5,
                number: 950
            });
        }
        if (num === 2) {
            return ({
                win: 4,
                number: 900
            });
        }
        if (num === 3) {
            return ({
                win: 3,
                number: 850
            });
        }
        if (num === 4) {
            return ({
                win: 2,
                number: 800
            });
        }
        if (num === 5) {
            return ({
                win: 1.5,
                number: 750
            });
        }
        if (num === 6) {
            return ({
                win: 1.4,
                number: 700
            });
        }
        if (num === 7) {
            return ({
                win: 1.3,
                number: 650
            });
        }
        if (num === 8) {
            return ({
                win: 1.2,
                number: 600
            });
        }
        if (num === 9) {
            return ({
                win: 1.1,
                number: 550
            });
        }
        if (num === 10) {
            return ({
                win: 1,
                number: 500
            });
        }
        if (num === 11) {
            return ({
                win: 0.9,
                number: 450
            });
        }
        if (num === 12) {
            return ({
                win: 0.8,
                number: 400
            });
        }
        if (num === 13) {
            return ({
                win: 0.7,
                number: 350
            });
        }
        if (num === 14) {
            return ({
                win: 0.6,
                number: 300
            });
        }
        if (num === 15) {
            return ({
                win: 0.5,
                number: 250
            });
        }
        if (num === 16) {
            return ({
                win: 0.4,
                number: 200
            });
        }
        if (num === 17) {
            return ({
                win: 0.3,
                number: 150
            });
        }
        if (num === 18) {
            return ({
                win: 0.2,
                number: 100
            });
        }
        if (num === 19) {
            return ({
                win: 0.1,
                number: 50
            });
        }
    } else {
        if (num === 1) {
            return ({
                win: 5,
                number: 50
            });
        }
        if (num === 2) {
            return ({
                win: 4,
                number: 100
            });
        }
        if (num === 3) {
            return ({
                win: 3,
                number: 150
            });
        }
        if (num === 4) {
            return ({
                win: 2,
                number: 200
            });
        }
        if (num === 5) {
            return ({
                win: 1.5,
                number: 250
            });
        }
        if (num === 6) {
            return ({
                win: 1.4,
                number: 300
            });
        }
        if (num === 7) {
            return ({
                win: 1.3,
                number: 350
            });
        }
        if (num === 8) {
            return ({
                win: 1.2,
                number: 400
            });
        }
        if (num === 9) {
            return ({
                win: 1.1,
                number: 450
            });
        }
        if (num === 10) {
            return ({
                win: 1,
                number: 500
            });
        }
        if (num === 11) {
            return ({
                win: 0.9,
                number: 550
            });
        }
        if (num === 12) {
            return ({
                win: 0.8,
                number: 600
            });
        }
        if (num === 13) {
            return ({
                win: 0.7,
                number: 650
            });
        }
        if (num === 14) {
            return ({
                win: 0.6,
                number: 700
            });
        }
        if (num === 15) {
            return ({
                win: 0.5,
                number: 750
            });
        }
        if (num === 16) {
            return ({
                win: 0.4,
                number: 800
            });
        }
        if (num === 17) {
            return ({
                win: 0.3,
                number: 850
            });
        }
        if (num === 18) {
            return ({
                win: 0.2,
                number: 900
            });
        }
        if (num === 19) {
            return ({
                win: 0.1,
                number: 950
            });
        }
    }
}

// Slash Commands Name and Descriptions
const commands = [
    {
        name: 'help',
        description: 'Help Command'
    },
    {
        name: 'test',
        description: 'test',
        options: [
            {
                name: 'bet-amount',
                description: 'Choose how much to bet',
                type: ApplicationCommandOptionType.Number,
                required: true
            }
        ]
    },
    {
        name: 'test1',
        description: 'test1',
        options: [
            {
                name: 'txn-hash',
                description: 'Choose a TXN Hash to Lookup',
                type: ApplicationCommandOptionType.String,
                required: true
            }
        ]
    },
    {
        name: 'hashdice',
        description: "Choose your Odds in A Number Generator and get Paid Out Accordingly",
        options: [
            {
                name: 'bet-amount',
                description: 'Choose how much to bet',
                type: ApplicationCommandOptionType.Number,
                required: true
            },
            {
                name: 'number',
                description: 'Choose a Middle to Bet Against between 2-999 to Change your Odds',
                type: ApplicationCommandOptionType.Number,
                required: true,
                choices: [
                    {
                        name: '5% Chance',
                        value: 1,
                    },
                    {
                        name: '10% Chance',
                        value: 2,
                    },
                    {
                        name: '15% Chance',
                        value: 3,
                    },
                    {
                        name: '20% Chance',
                        value: 4,
                    },
                    {
                        name: '25% Chance',
                        value: 5,
                    },
                    {
                        name: '30% Chance',
                        value: 6,
                    },
                    {
                        name: '35% Chance',
                        value: 7,
                    },
                    {
                        name: '40% Chance',
                        value: 8,
                    },
                    {
                        name: '45% Chance',
                        value: 9,
                    },
                    {
                        name: '50% Chance',
                        value: 10,
                    },
                    {
                        name: '55% Chance',
                        value: 11,
                    },
                    {
                        name: '60% Chance',
                        value: 12,
                    },
                    {
                        name: '65% Chance',
                        value: 13,
                    },
                    {
                        name: '70% Chance',
                        value: 14,
                    },
                    {
                        name: '75% Chance',
                        value: 15,
                    },
                    {
                        name: '80% Chance',
                        value: 16,
                    },
                    {
                        name: '85% Chance',
                        value: 17,
                    },
                    {
                        name: '90% Chance',
                        value: 18,
                    },
                    {
                        name: '95% Chance',
                        value: 19,
                    }
                ]
            },
            {
                name: 'higher-lower',
                description: 'Choose to bet Higher than your number or Lower',
                type: ApplicationCommandOptionType.Number,
                required: true,
                choices: [
                    {
                        name: 'Higher',
                        value: 1,
                    },
                    {
                        name: 'Lower',
                        value: 2,
                    }
                ]
            }
        ]
    },
    {
        name: 'slot',
        description: "Spin a 1 Line SlotMachine",
        options: [
            {
                name: 'bet-amount',
                description: 'Choose how much to bet',
                type: ApplicationCommandOptionType.Number,
                required: true
            },
            {
                name: 'game',
                description: 'Choose a Game to Play',
                type: ApplicationCommandOptionType.Number,
                required: true,
                choices: [
                    {
                        name: "1 Line x 3 Long",
                        value: 1,
                    },
                    {
                        name: "1 Line x 5 Long",
                        value: 2,
                    },
                    {
                        name: "3 Lines x 3 Long",
                        value: 3,
                    }
                ]
            }
        ]
    },
    {
        name: 'roulette',
        description: 'Play a Game of Roulette',
        options: [
            {
                name: 'bet-amount',
                description: 'Choose your Bet Amount',
                type: ApplicationCommandOptionType.Number,
                required: true,
            },
            {
                name: 'black-numbers',
                description: 'Bet on a Black Number',
                type: ApplicationCommandOptionType.Number,
                choices: [
                    {
                        name: 'All Black',
                        value: 420,
                    },
                    {
                        name: '2',
                        value: 2,
                    },
                    {
                        name: '4',
                        value: 4,
                    },
                    {
                        name: '6',
                        value: 6,
                    },
                    {
                        name: '8',
                        value: 8,
                    },
                    {
                        name: '10',
                        value: 10,
                    },
                    {
                        name: '11',
                        value: 11,
                    },
                    {
                        name: '13',
                        value: 13,
                    },
                    {
                        name: '15',
                        value: 15,
                    },
                    {
                        name: '17',
                        value: 17,
                    },
                    {
                        name: '20',
                        value: 20,
                    },
                    {
                        name: '22',
                        value: 22,
                    },
                    {
                        name: '24',
                        value: 24,
                    },
                    {
                        name: '26',
                        value: 26,
                    },
                    {
                        name: '28',
                        value: 28,
                    },
                    {
                        name: '29',
                        value: 29,
                    },
                    {
                        name: '31',
                        value: 31,
                    },
                    {
                        name: '33',
                        value: 33,
                    },
                    {
                        name: '35',
                        value: 35,
                    }
                ]
            },
            {
                name: 'red-numbers',
                description: 'Bet on a Red Number',
                type: ApplicationCommandOptionType.Number,
                choices: [
                    {
                        name: 'All Red',
                        value: 420,
                    },
                    {
                        name: '1',
                        value: 1,
                    },
                    {
                        name: '3',
                        value: 3,
                    },
                    {
                        name: '5',
                        value: 5,
                    },
                    {
                        name: '7',
                        value: 7,
                    },
                    {
                        name: '9',
                        value: 9,
                    },
                    {
                        name: '12',
                        value: 12,
                    },
                    {
                        name: '14',
                        value: 14,
                    },
                    {
                        name: '16',
                        value: 16,
                    },
                    {
                        name: '18',
                        value: 18,
                    },
                    {
                        name: '19',
                        value: 19,
                    },
                    {
                        name: '21',
                        value: 21,
                    },
                    {
                        name: '23',
                        value: 23,
                    },
                    {
                        name: '25',
                        value: 25,
                    },
                    {
                        name: '27',
                        value: 27,
                    },
                    {
                        name: '30',
                        value: 30,
                    },
                    {
                        name: '32',
                        value: 32,
                    },
                    {
                        name: '34',
                        value: 34,
                    },
                    {
                        name: '36',
                        value: 36,
                    }
                ]
            }
        ]
    },
    {
        name: 'dig',
        description: '60% chance to Collect 1-15 every Minute'
    },
    {
        name: 'balance',
        description: 'See yours or someone elses balance',
        options: [
            {
                name: 'user',
                description: 'The user whose balance you want to get',
                type: ApplicationCommandOptionType.User,
            }
        ]
    },
    {
        name: 'heads',
        description: 'Play a Game of Heads or Tails',
        options: [
            {
                name: 'bet-amount',
                description: 'Choose how much to bet',
                type: ApplicationCommandOptionType.Number,
                required: true
            }
        ]
    },
    {
        name: 'high',
        description: 'Play a Game of High/Low',
        options: [
            {
                name: 'bet-amount',
                description: 'Choose how much to bet',
                type: ApplicationCommandOptionType.Number,
                required: true
            }
        ]
    },
    {
        name: 'low',
        description: 'Play a Game of High/Low',
        options: [
            {
                name: 'bet-amount',
                description: 'Choose how much to bet',
                type: ApplicationCommandOptionType.Number,
                required: true
            }
        ]
    },
    {
        name: 'tails',
        description: 'Play a Game of Heads or Tails',
        options: [
            {
                name: 'bet-amount',
                description: 'Choose how much to bet',
                type: ApplicationCommandOptionType.Number,
                required: true
            }
        ]
    },
    {
        name: 'rock',
        description: 'Play a Game of Rock/Paper/Scissors',
        options: [
            {
                name: 'bet-amount',
                description: 'Choose how much to bet',
                type: ApplicationCommandOptionType.Number,
                required: true
            }
        ]
    },
    {
        name: 'paper',
        description: 'Play a Game of Rock/Paper/Scissors',
        options: [
            {
                name: 'bet-amount',
                description: 'Choose how much to bet',
                type: ApplicationCommandOptionType.Number,
                required: true
            }
        ]
    },
    {
        name: 'scissors',
        description: 'Play a Game of Rock/Paper/Scissors',
        options: [
            {
                name: 'bet-amount',
                description: 'Choose how much to bet',
                type: ApplicationCommandOptionType.Number,
                required: true
            }
        ]
    },
    {
        name: 'daily',
        description: 'Collect 1000 Daily',
    },
    {
        name: 'level',
        description: "Shows Your/Someone's Level",
        options: [
            {
                name: 'target-user',
                description: 'The user whose level you want to see.',
                type: ApplicationCommandOptionType.Mentionable,
            },
        ],
    },
    {
        name: 'ping',
        description: 'Replies With the Bots Ping'
    }
];

// Defining REST Client
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

// Client Intentions
const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds, 
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent  
    ]
});

// Connect to Database
(async () => {
    try {
        await mongoose.connect(process.env.DB_LINK);
        console.log("Connected to Database.");

        eventHandler(client);

        // Registering Slash Commands
        (async () => {
            try {
                await rest.put(
                    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                    { body: commands }
                )
                console.log('Slash Commands Registered.')
            } catch (error) {
                console.log(`=-=ERROR=-= ${error}`)
            }
        })();

        // Logging in the Bot
        client.login(process.env.TOKEN);
    } catch (error) {
        console.log(`=-=ERROR=-= ${error}`);
    }
})();

// Status Messages
let status = [
    {
        name: 'Porn',
        type: ActivityType.Watching
    },
    {
        name: 'VSCode',
        type: ActivityType.Playing
    },
    {
        name: 'Meth Cooking',
        type: ActivityType.Competing
    },
    {
        name: 'My Suicide',
        type: ActivityType.Streaming,
        link: "https://www.twitch.tv/itsinhaleyo"
    }
]

// Client OnReady
client.on('ready', (c) => {
    // Randomize Status Message Array
    setInterval(() => {
        let random = Math.floor(Math.random() * status.length)
        client.user.setActivity(status[random]);
    }, 15000);
});

// Slash Commands Functions
client.on('interactionCreate', async (interaction) => {
    const date = new Date(interaction.createdTimestamp);
    const timestamp = date.toLocaleDateString('en-US', { hour: 'numeric', minute: 'numeric', second: 'numeric' });
    if (!interaction.isChatInputCommand()) return;
    console.log(timestamp+" - "+interaction.user.username+" - "+interaction.commandName);

    if (interaction.commandName === 'help') {
        const embed = new EmbedBuilder()
            .setTitle('Commands List')
            .setColor('Random')
            .addFields(
                {
                    name: "/ping",
                    value: "Replies with the bots Ping",
                    inline: true
                },
                {
                    name: "/level",
                    value: "Shows your level for this bot in this server",
                    inline: true
                },
                {
                    name: "/balance",
                    value: "Shows your balance within this bot on this server",
                    inline: true
                },
                {
                    name: "/daily  /dig",
                    value: "Gets you 1000:dollar: Daily\n60% chance to get 1-15:dollar: every Minute",
                    inline: true
                },
                {
                    name: "/heads  /tails",
                    value: "Play a Game of Heads or Tails",
                    inline: true
                },
                {
                    name: "/rock  /paper  /scissors",
                    value: "Play a Game of Rock/Paper/Scissors",
                    inline: true
                },
                {
                    name: "/high  /low",
                    value: "Play a Game of High/Low",
                    inline: true
                },
                {
                    name: "/roulette",
                    value: "Play a Game of Roulette",
                    inline: true
                },
                {
                    name: "/slot",
                    value: "Spin a Selection of SlotMachines",
                    inline: true
                },
                {
                    name: "/hashdice",
                    value: "Choose your Odds in A Number Generator and get Paid Out Accordingly",
                    inline: true
                }
            )
        interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'ping') {
        await interaction.deferReply();
        const reply = await interaction.fetchReply();
        const ping = reply.createdTimestamp - interaction.createdTimestamp;
        interaction.editReply(`Client ${ping}ms | Websocket: ${client.ws.ping}ms`);
    }

    if (interaction.commandName === 'balance') {
        if (!interaction.inGuild()){
            interaction.reply({
                content: 'You can only run this command inside a server',
                ephemeral: true,
            })
            return;
        }

        const targetUserId = interaction.options.get('user')?.value || interaction.member.id;

        await interaction.deferReply();

        const user = await User.findOne({ userId: targetUserId, guildId: interaction.guild.id })

        if (!user) {
            interaction.editReply(`<@${targetUserId}> doesn't have a profile yet`);
            return;
        }

        interaction.editReply(
            targetUserId === interaction.member.id
                ? `Your balance is **${user.balance}:dollar:**`
                : `<@${targetUserId}'s balance is **${user.balance}:dollar:**>`
        );
    }

    if (interaction.commandName === 'heads') {
        if (!interaction.inGuild()) {
            interaction.reply({
              content: 'You can only run this command inside a server.',
              ephemeral: true,
            });
            return;
        } try {
            await interaction.deferReply();
      
            const query = {
              userId: interaction.member.id,
              guildId: interaction.guild.id,
            };
      
            let user = await User.findOne(query);
      
            if (!user) {
                user = new User({
                    ...query,
                    lastDaily: new Date(),
                });
            }
            const bet = interaction.options.get('bet-amount').value;
            if (bet > 50) {
                giveXp(interaction.member.id, interaction.guild.id, interaction, bet);
            }
            if (user.balance >= bet && bet >= 1) {
                const winAmount = bet * 2;
                const headsValue = getRandomNumber(1, 20);
                console.log(headsValue);
                user.balance -= bet;
                if (headsValue >= 10){
                    user.balance += winAmount;
                    await user.save();
                    interaction.editReply(`:fire:HEADS:fire: +${winAmount}:dollar:\nYour new balance is\n${numtoemo(user.balance)}`);
                } else {
                    await user.save();
                    interaction.editReply(`:sob:tails:sob: -${bet}:dollar:\nYour new balance is\n${numtoemo(user.balance)}`);
                }
            } else {
                interaction.editReply(`Your balance is ${user.balance}`);
            }
        } catch (error) {
            interaction.editReply(`Please try the Command Again`);
            console.log(`Error with /dig: ${error}`);
        }
    }

    if (interaction.commandName === 'tails') {
        if (!interaction.inGuild()) {
            interaction.reply({
              content: 'You can only run this command inside a server.',
              ephemeral: true,
            });
            return;
        } try {
            await interaction.deferReply();
      
            const query = {
              userId: interaction.member.id,
              guildId: interaction.guild.id,
            };
      
            let user = await User.findOne(query);
      
            if (!user) {
                user = new User({
                    ...query,
                    lastDaily: new Date(),
                });
            }
            const bet = interaction.options.get('bet-amount').value;
            if (bet > 50) {
                giveXp(interaction.member.id, interaction.guild.id, interaction, bet);
            }
            if (user.balance >= bet && bet >= 1) {
                const winAmount = bet * 2;
                const tailsValue = getRandomNumber(1, 20);
                console.log(tailsValue);
                user.balance -= bet;
                if (tailsValue >= 10){
                    user.balance += winAmount;
                    await user.save();
                    interaction.editReply(`:fire:TAILS:fire: +${winAmount}:dollar:\nYour new balance is\n${numtoemo(user.balance)}`);
                } else {
                    await user.save();
                    interaction.editReply(`:sob:Heads:sob: -${bet}:dollar:\nYour new balance is\n${numtoemo(user.balance)}`);
                }
            } else {
                interaction.editReply(`Your balance is ${user.balance}`);
            }
        } catch (error) {
            interaction.editReply(`Please try the Command Again`);
            console.log(`Error with /dig: ${error}`);
        }
    }

    if (interaction.commandName == 'rock') {
        if (!interaction.inGuild()) {
            interaction.reply({
              content: 'You can only run this command inside a server.',
              ephemeral: true,
            });
            return;
        } try {
            await interaction.deferReply();
      
            const query = {
              userId: interaction.member.id,
              guildId: interaction.guild.id,
            };

            let user = await User.findOne(query);

            if (!user) {
                user = new User({
                    ...query,
                    lastDaily: new Date(),
                });
            }

            const bet = interaction.options.get('bet-amount').value;
            if (bet > 50) {
                giveXp(interaction.member.id, interaction.guild.id, interaction, bet);
            }
            if (user.balance >= bet && bet >= 1) {
                const randonum = getRandomNumber(0, 100);
                if (randonum < 33) {
                    user.balance -= bet;
                    await user.save();
                    interaction.editReply(`:sob::paper::sob: -${bet}:dollar:\nYour new balance is\n${numtoemo(user.balance)}`);
                    return;
                }
                if (randonum < 66)  {
                    interaction.editReply(`:rock: -0:dollar:`);
                } else {
                    user.balance += bet;
                    await user.save();
                    interaction.editReply(`:fire::scissors:: +${bet}:dollar:\nYour new balance is\n${numtoemo(user.balance)}`);
                }
            } else {
                interaction.editReply(`Your balance is ${user.balance}:dollar:`);
            }
        } catch (error) {
            interaction.editReply(`Please try the Command Again`);
            console.log(`Error with /rock: ${error}`);
        }
    }

    if (interaction.commandName == 'paper') {
        if (!interaction.inGuild()) {
            interaction.reply({
              content: 'You can only run this command inside a server.',
              ephemeral: true,
            });
            return;
        } try {
            await interaction.deferReply();
      
            const query = {
              userId: interaction.member.id,
              guildId: interaction.guild.id,
            };

            let user = await User.findOne(query);

            if (!user) {
                user = new User({
                    ...query,
                    lastDaily: new Date(),
                });
            }

            const bet = interaction.options.get('bet-amount').value;
            if (bet > 50) {
                giveXp(interaction.member.id, interaction.guild.id, interaction, bet);
            }
            if (user.balance >= bet && bet >= 1) {
                const randonum = getRandomNumber(0, 100);
                if (randonum < 33) {
                    user.balance -= bet;
                    await user.save();
                    interaction.editReply(`:sob::scissors::sob: -${bet}:dollar:\nYour new balance is\n${numtoemo(user.balance)}`);
                    return;
                }
                if (randonum < 66)  {
                    interaction.editReply(`:paper: -0:dollar:`);
                } else {
                    user.balance += bet;
                    await user.save();
                    interaction.editReply(`:fire::rock::fire: +${bet}:dollar:\nYour new balance is\n${numtoemo(user.balance)}`);
                }
            } else {
                interaction.editReply(`Your balance is ${user.balance}:dollar:`);
            }
        } catch (error) {
            interaction.editReply(`Please try the Command Again`);
            console.log(`Error with /paper: ${error}`);
        }
    }

    if (interaction.commandName == 'scissors') {
        if (!interaction.inGuild()) {
            interaction.reply({
              content: 'You can only run this command inside a server.',
              ephemeral: true,
            });
            return;
        } try {
            await interaction.deferReply();
      
            const query = {
              userId: interaction.member.id,
              guildId: interaction.guild.id,
            };

            let user = await User.findOne(query);

            if (!user) {
                user = new User({
                    ...query,
                    lastDaily: new Date(),
                });
            }

            const bet = interaction.options.get('bet-amount').value;
            if (bet > 50) {
                giveXp(interaction.member.id, interaction.guild.id, interaction, bet);
            }
            if (user.balance >= bet && bet >= 1) {
                const randonum = getRandomNumber(0, 100);
                if (randonum < 33) {
                    user.balance -= bet;
                    await user.save();
                    interaction.editReply(`:sob::rock::sob: -${bet}:dollar:\nYour new balance is\n${numtoemo(user.balance)}`);
                    return;
                }
                if (randonum < 66)  {
                    interaction.editReply(`:scissors: -0:dollar:`);
                } else {
                    user.balance += bet;
                    await user.save();
                    interaction.editReply(`:fire::scroll::fire: +${bet}:dollar:\nYour new balance is\n${numtoemo(user.balance)}`);
                }
            } else {
                interaction.editReply(`Your balance is ${user.balance}:dollar:`);
            }
        } catch (error) {
            interaction.editReply(`Please try the Command Again`);
            console.log(`Error with /scissors: ${error}`);
        }
    }

    if (interaction.commandName === 'dig') {
        if (!interaction.inGuild()) {
            interaction.reply({
              content: 'You can only run this command inside a server.',
              ephemeral: true,
            });
            return;
        } try {
            await interaction.deferReply();
      
            const query = {
              userId: interaction.member.id,
              guildId: interaction.guild.id,
            };
            const query2 = {
                userId: interaction.member.id,
                commandName: 'dig',
            };
      
            let user = await User.findOne(query);
            let cooldown = await Cooldown.findOne(query2);
      
            if (!user) {
                user = new User({
                    ...query,
                    lastDaily: new Date(),
                });
            }
            if (!cooldown) {
                cooldown = new Cooldown({ userId, commandName })
            }
            if (Date.now() < cooldown.endsAt) {
                interaction.editReply({ content: `Try again in ${cooldown.endsAt-Date.now()} MiliSeconds`, ephemeral: true });
            } else {
                const digChance = getRandomNumber(0, 100);
                if (digChance < 40) {
                    interaction.editReply(`Nothing this time, Try again`);
                    cooldown.endsAt = Date.now() + 60000;
                    await cooldown.save();
                } else {
                    const digAmount = getRandomNumber(1,15);
                    user.balance += digAmount;
                    cooldown.endsAt = Date.now() + 60000;
                    await user.save();
                    await cooldown.save();
                    interaction.editReply({ content: `+${digAmount}:dollar:\nYour new balance is\n${numtoemo(user.balance)}`, ephemeral: true });
                }
            }
        } catch (error) {
            interaction.editReply(`Please try the Command Again`);
            console.log(`Error with /dig: ${error}`);
        }
    }

    if (interaction.commandName === 'daily') {
        if (!interaction.inGuild()) {
            interaction.reply({
              content: 'You can only run this command inside a server.',
              ephemeral: true,
            });
            return;
          }
      
          try {
            await interaction.deferReply();
      
            const query = {
              userId: interaction.member.id,
              guildId: interaction.guild.id,
            };
      
            let user = await User.findOne(query);
      
            if (user) {
              const lastDailyDate = user.lastDaily.toDateString();
              const currentDate = new Date().toDateString();
      
              if (lastDailyDate === currentDate) {
                interaction.editReply(
                  'You have already collected your dailies today. Come back tomorrow!'
                );
                return;
              }
              
              user.lastDaily = new Date();
            } else {
                user = new User({
                    ...query,
                    lastDaily: new Date(),
                });
            }
            user.balance += 1000;
            await user.save();
        
            interaction.editReply(
              `+$1000:dollar:\nYour new balance is\n${numtoemo(user.balance)}`
            );
          } catch (error) {
            interaction.editReply(`Please try the Command Again`);
            console.log(`Error with /daily: ${error}`);
          }
        }

    if (interaction.commandName === "level") {
        if (!interaction.inGuild()) {
            interaction.reply('You can only run this command inside a server.');
            return;
            }
            try {
            await interaction.deferReply();
        
            const mentionedUserId = interaction.options.get('target-user')?.value;
            const targetUserId = mentionedUserId || interaction.member.id;
            const targetUserObj = await interaction.guild.members.fetch(targetUserId);
        
            const fetchedLevel = await Level.findOne({
                userId: targetUserId,
                guildId: interaction.guild.id,
            });
        
            if (!fetchedLevel) {
                interaction.editReply(
                mentionedUserId
                    ? `${targetUserObj.user.tag} doesn't have any levels yet. Try again when they chat a little more.`
                    : "You don't have any levels yet. Chat a little more and try again."
                );
                return;
            }
        
            let allLevels = await Level.find({ guildId: interaction.guild.id }).select(
                '-_id userId level xp'
            );
        
            allLevels.sort((a, b) => {
                if (a.level === b.level) {
                return b.xp - a.xp;
                } else {
                return b.level - a.level;
                }
            });
        
            let currentRank = allLevels.findIndex((lvl) => lvl.userId === targetUserId) + 1;
        
            const rank = new canvacord.Rank()
                .setAvatar(targetUserObj.user.displayAvatarURL({ size: 256 }))
                .setRank(currentRank)
                .setLevel(fetchedLevel.level)
                .setCurrentXP(fetchedLevel.xp)
                .setRequiredXP(calculateLevelXp(fetchedLevel.level))
                .setProgressBar('#FF0069', 'COLOR')
                .setUsername(targetUserObj.user.username)
                .setDiscriminator(targetUserObj.user.discriminator);
        
            const data = await rank.build();
            const attachment = new AttachmentBuilder(data);
            interaction.editReply({ files: [attachment] });
            } catch (error) {
            interaction.editReply(`Please try the Command Again`);
            console.log(`=-=ERROR=-= ${error}`);
            }
        
    }

    if (interaction.commandName === "high") {
        if (!interaction.inGuild()) {
            interaction.reply({
                content: 'You can only run this command inside a server.',
                ephemeral: true,
            });
            return;
        } try {
            await interaction.deferReply();
        
            const query = {
                userId: interaction.member.id,
                guildId: interaction.guild.id,
            };
            const query2 = {
                userId: interaction.member.id
            };

            let user = await User.findOne(query);
            let game = await Hilow.findOne(query2);

            if (!user) {
                user = new User({
                    ...query,
                    lastDaily: new Date(),
                });
            }
            if (!game) {
                game = new Hilow({
                    ...query2,
                    lastNumber: 5,
                });
            }

            const bet = interaction.options.get('bet-amount').value;
            if (bet > 50) {
                giveXp(interaction.member.id, interaction.guild.id, interaction, bet);
            }
            if (user.balance >= bet && bet >= 1) {
                const randnum = getRandomNumber(1,11);
                if (randnum = game.lastNumber) {
                    await game.save();
                    interaction.editReply(`<${randnum}> -0:dollar:\n\nTry again to get Higher or Lower than ${randnum}!!!`);
                    return;
                }
                if (randnum < game.lastNumber) {
                    user.balance -= bet;
                    game.lastNumber = randnum;
                    await user.save();
                    await game.save();
                    interaction.editReply(`:sob:<${randnum}>:sob: -${bet}:dollar:\nYour new balance is\n${numtoemo(user.balance)}\n\nTry again to get Higher or Lower than ${randnum}!!!`);
                } else {
                    user.balance += bet;
                    game.lastNumber = randnum;
                    await user.save();
                    await game.save();
                    interaction.editReply(`:fire:<${randnum}>:fire: +${bet}:dollar:\nYour new balance is\n${numtoemo(user.balance)}\n\nBet again to get Higher or Lower than ${randnum}`);
                }
            } else {
                interaction.editReply(`Your balance is ${user.balance}`);
            }
        } catch (error) {
            interaction.editReply(`Please try the Command Again`);
            console.log(`Error with /high: ${error}`);
        }
    }

    if (interaction.commandName === "low") {
        if (!interaction.inGuild()) {
            interaction.reply({
                content: 'You can only run this command inside a server.',
                ephemeral: true,
            });
            return;
        } try {
            await interaction.deferReply();
        
            const query = {
                userId: interaction.member.id,
                guildId: interaction.guild.id,
            };
            const query2 = {
                userId: interaction.member.id
            };

            let user = await User.findOne(query);
            let game = await Hilow.findOne(query2);

            if (!user) {
                user = new User({
                    ...query,
                    lastDaily: new Date(),
                });
            }
            if (!game) {
                game = new Hilow({
                    ...query2,
                    lastNumber: 5,
                });
            }

            const bet = interaction.options.get('bet-amount').value;
            if (bet > 50) {
                giveXp(interaction.member.id, interaction.guild.id, interaction, bet);
            }
            if (user.balance >= bet && bet >= 1) {
                const randnum = getRandomNumber(1,11);
                if (randnum = game.lastNumber) {
                    await game.save();
                    interaction.editReply(`<${randnum}> -0:dollar:\n\nTry again to get Higher or Lower than ${randnum}!!!`);
                    return;
                }
                if (randnum > game.lastNumber) {
                    user.balance -= bet;
                    game.lastNumber = randnum;
                    await user.save();
                    await game.save();
                    interaction.editReply(`:sob:<${randnum}>:sob: -${bet}:dollar:\nYour new balance is\n${numtoemo(user.balance)}\n\nTry again to get Higher or Lower than ${randnum}!!!`);
                } else {
                    user.balance += bet;
                    game.lastNumber = randnum;
                    await user.save();
                    await game.save();
                    interaction.editReply(`:fire:<${randnum}>:fire: +${bet}:dollar:\nYour new balance is\n${numtoemo(user.balance)}\n\nBet again to get Higher or Lower than ${randnum}`);
                }
            } else {
                interaction.editReply(`Your balance is ${user.balance}`);
            }
        } catch (error) {
            interaction.editReply(`Please try the Command Again`);
            console.log(`Error with /low: ${error}`);
        }
    }

    if (interaction.commandName === "roulette") {
        if (!interaction.inGuild()) {
            interaction.reply({
                content: 'You can only run this command inside a server.',
                ephemeral: true,
            });
            return;
        } try {
            await interaction.deferReply();
        
            const query = {
                userId: interaction.member.id,
                guildId: interaction.guild.id,
            };

            let user = await User.findOne(query);

            if (!user) {
                user = new User({
                    ...query,
                    lastDaily: new Date(),
                });
            }
            const bet = interaction.options.get('bet-amount').value;
            if (bet > 50) {
                giveXp(interaction.member.id, interaction.guild.id, interaction, bet);
            }
            if (user.balance >= bet && bet >= 1) {
                const redAmount = interaction.options.get('red-numbers')?.value;
                const blackAmount = interaction.options.get('black-numbers')?.value;
                const spin = getRandomNumber(1,36);
                if (redAmount) {
                    if (blackAmount) {
                        interaction.editReply(`Please only choose one number`);
                    } else {
                        if (redAmount === 420) {
                            const redNumbers = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
                            const roulette = getRandomNumber(1,36);
                            if (redNumbers.includes(roulette)) {
                                user.balance += bet;
                                await user.save();
                                interaction.editReply(`:fire:<${roulette}>:fire: +${bet}:dollar:\nYour new balance is\n${numtoemo(user.balance)}`);
                            } else {
                                user.balance -= bet;
                                await user.save();
                                interaction.editReply(`:sob:<${roulette}>:sob: -${bet}:dollar:\nYour new balance is\n${numtoemo(user.balance)}`);
                            }
                        } else {
                            if (spin === redAmount) {
                                user.balance += bet * 11;
                                user.save();
                                interaction.editReply(`:fire:<${spin}>:fire: +${bet*11}:dollar:\nX11 WIN!!!\nYour new balance is\n${numtoemo(user.balance)}`);
                            } else {
                                user.balance -= bet;
                                user.save();
                                interaction.editReply(`:sob:<${spin}>:sob: -${bet}:dollar:\nBetter Luck Next Time!\nYour new balance is\n${numtoemo(user.balance)}`);
                            }
                        }
                    }
                } else {
                    if (blackAmount) {
                        if (blackAmount === 420) {
                            const blackNumbers = [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35];
                            const roulette = getRandomNumber(1,36);
                            if (blackNumbers.includes(roulette)) {
                                user.balance += bet;
                                await user.save();
                                interaction.editReply(`:fire:<${roulette}>:fire: +${bet}:dollar:\nYour new balance is\n${numtoemo(user.balance)}`);
                            } else {
                                user.balance -= bet;
                                await user.save();
                                interaction.editReply(`:sob:<${roulette}>:sob: -${bet}:dollar:\nYour new balance is\n${numtoemo(user.balance)}`);
                            }
                        } else {
                            if (spin === blackAmount) {
                                user.balance += bet * 11;
                                user.save();
                                interaction.editReply(`:fire:<${spin}>:fire: +${bet*11}:dollar:\nX11 WIN!!!\nYour new balance is\n${numtoemo(user.balance)}`);
                            } else {
                                user.balance -= bet;
                                user.save();
                                interaction.editReply(`:sob:<${spin}>:sob: -${bet}:dollar:\nBetter Luck Next Time!\nYour new balance is\n${numtoemo(user.balance)}`);
                            }
                        }
                    } else {
                        interaction.editReply(`Please choose a Black or Red Number`);
                    }
                }
            } else {
                interaction.editReply(`Your balance is ${user.balance}`);
            }
        } catch (error) {
            interaction.editReply(`Please try the Command Again`);
            console.log(`Error with /roulette: ${error}`);
        }
    }

    if (interaction.commandName === "slot") {
        if (!interaction.inGuild()) {
            interaction.reply({
                content: 'You can only run this command inside a server.',
                ephemeral: true,
            });
            return;
        } try {
            await interaction.deferReply();
        
            const query = {
                userId: interaction.member.id,
                guildId: interaction.guild.id,
            };

            let user = await User.findOne(query);

            if (!user) {
                user = new User({
                    ...query,
                    lastDaily: new Date(),
                });
            }
            const bet = interaction.options.get('bet-amount')?.value;
            const game = interaction.options.get('game')?.value;
            if (!bet) {
                interaction.editReply(`You have to bet to Spin the Wheel`);
                return;
            }
            if (!game) {
                interaction.editReply(`You have to choose a Game to Play`);
                return;
            }
            if (bet > 50) {
                giveXp(interaction.member.id, interaction.guild.id, interaction, bet);
            }
            if (user.balance >= bet && bet >= 1) {
                if (game === 1) {
                    let freespins = onexthreespinWheel(interaction, user, bet, 0);
                    if (freespins > 0) {
                        let delay = 1000;
                        for (x = 0; x < freespins; x++) {
                            setTimeout(function(){
                                onexthreespinWheel(interaction, user, bet, 1);
                            }, delay);
                            delay += 1000;
                        }
                    }
                }
                if (game === 2) {
                    let freespins = await onexfivespinWheel(interaction, user, bet, 0);
                    if (freespins > 0) {
                        let delay = 1000;
                        for (x = 0; x < freespins; x++) {
                            setTimeout(function(){
                                onexfivespinWheel(interaction, user, bet, 1);
                            }, delay);
                            delay += 1000;
                        }
                    }
                }
                if (game === 3) {
                    let freespins = await threexthreespinWheel(interaction, user, bet, 0);
                    if (freespins > 0) {
                        let delay = 1000;
                        for (x = 0; x < freespins; x++) {
                            setTimeout(function(){
                                threexthreespinWheel(interaction, user, bet, 1);
                            }, delay);
                            delay += 1000;
                        }
                    }
                }
            } else {
                interaction.editReply(`Your balance is ${user.balance}:dollar:`);
            }
        } catch (error) {
            interaction.editReply(`Please try the Command Again`);
            console.log(`Error with /slot: ${error}`);
        }
    }

    if (interaction.commandName === "hashdice") {
        if (!interaction.inGuild()) {
            interaction.reply({
                content: 'You can only run this command inside a server.',
                ephemeral: true,
            });
            return;
        } try {
            await interaction.deferReply();
        
            const query = {
                userId: interaction.member.id,
                guildId: interaction.guild.id,
            };

            let user = await User.findOne(query);

            if (!user) {
                user = new User({
                    ...query,
                    lastDaily: new Date(),
                });
            }
            const bet = interaction.options.get('bet-amount').value;
            if (!bet) {
                interaction.editReply(`Please choose a bet amount`);
                return;
            }
            const number = interaction.options.get('number').value;
            if (!number) {
                interaction.editReply(`Please choose a Middle Number to Change Your Odds`);
                return;
            }
            const hl = interaction.options.get('higher-lower').value;
            if (!hl) {
                interaction.editReply(`Please Choose to bet Higher or Lower than ${number}`);
                return;
            }
            if (bet > 50) {
                giveXp(interaction.member.id, interaction.guild.id, interaction, bet);
            }
            if (user.balance >= bet && bet >= 10) {
                const raNumber = getRandomNumber(1,1000);
                if (hl === 1) {
                    let odds = getOdds(hl, number);
                    interaction.editReply(`${odds}`);
                    if (raNumber === odds.number) {
                        interaction.editReply(`:stop_button::stop_button::stop_button::stop_button::stop_button:\n:stop_button:${numtoemo(raNumber)}:arrow_up:Higher\n:stop_button:${numtoemo(odds.number)}:arrow_left:Your Number\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n-0:dollar:`);
                        return;
                    }
                    if (raNumber < odds.number) {
                        user.balance += Math.trunc(bet*odds.win-bet);
                        user.save();
                        interaction.editReply(`:stop_button::stop_button::stop_button::stop_button::stop_button:\n:stop_button:${numtoemo(raNumber)}:arrow_up:Higher\n:stop_button:${numtoemo(odds.number)}:arrow_left:Your Number\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n:fire:+${Math.trunc(bet*odds.win-bet)}:dollar:\nYour new balance is\n${numtoemo(user.balance)}:dollar:`);
                    } else {
                        user.balance -= bet;
                        user.save();
                        interaction.editReply(`:stop_button::stop_button::stop_button::stop_button::stop_button:\n:stop_button:${numtoemo(raNumber)}:arrow_up:Higher\n:stop_button:${numtoemo(odds.number)}:arrow_left:Your Number\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n-${bet}:dollar:\nYour new balance is\n${numtoemo(user.balance)}:dollar:`);
                    }
                } else {
                    let odds = getOdds(hl ,number);
                    interaction.editReply(`${odds}`);
                    if (raNumber === odds.number) {
                        interaction.editReply(`:stop_button::stop_button::stop_button::stop_button::stop_button:\n:stop_button:${numtoemo(raNumber)}:arrow_down:Lower\n:stop_button:${numtoemo(odds.number)}:arrow_left:Your Number\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n-0:dollar:`);
                        return;
                    }
                    if (raNumber > odds.number) {
                        user.balance += Math.trunc(bet*odds.win-bet);
                        user.save();
                        interaction.editReply(`:stop_button::stop_button::stop_button::stop_button::stop_button:\n:stop_button:${numtoemo(raNumber)}:arrow_down:Lower\n:stop_button:${numtoemo(odds.number)}:arrow_left:Your Number\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n:fire:+${Math.trunc(bet*odds.win-bet)}:dollar:\nYour new balance is\n${numtoemo(user.balance)}:dollar:`);
                    } else {
                        user.balance -= bet;
                        user.save();
                        interaction.editReply(`:stop_button::stop_button::stop_button::stop_button::stop_button:\n:stop_button:${numtoemo(raNumber)}:arrow_down:Lower\n:stop_button:${numtoemo(odds.number)}:arrow_left:Your Number\n:stop_button::stop_button::stop_button::stop_button::stop_button:\n-${bet}:dollar:\nYour new balance is\n${numtoemo(user.balance)}:dollar:`);
                    }
                }
            } else {
                interaction.editReply(`Minimum bet of 10 for this Game\nYour balance is\n${numtoemo(user.balance)}:dollar:`);
            }
        } catch (error) {
            interaction.editReply(`Please try the Command Again`);
            console.log(`Error with /hashdice: ${error}`);
        }
    }

    if (interaction.commandName === "test") {
        if (interaction.member.id === process.env.DEV_ID) {
            if (!interaction.inGuild()) {
                interaction.reply({
                    content: 'You can only run this command inside a server.',
                    ephemeral: true,
                });
                return;
            } try {
                await interaction.deferReply();
            
                const query = {
                    userId: interaction.member.id,
                    guildId: interaction.guild.id,
                };
    
                let user = await User.findOne(query);
    
                if (!user) {
                    user = new User({
                        ...query,
                        lastDaily: new Date(),
                    });
                }
                const bet = interaction.options.get('bet-amount').value;
                if (!bet) {
                    interaction.editReply(`Please choose a bet amount`);
                    return;
                }
                if (bet > 50) {
                    giveXp(interaction.member.id, interaction.guild.id, interaction, bet);
                }
                if (user.balance >= bet && bet >= 1) {
    
                } else {
                    interaction.editReply(`Your balance is ${user.balance}:dollar:`);
                }
            } catch (error) {
                interaction.editReply(`Please try the Command Again`);
                console.log(`Error with /test: ${error}`);
            }
        } else {
            interaction.reply('Only my bot DEV can use this command');
        }
    }

    if (interaction.commandName === "test1") {
        if (interaction.member.id === process.env.DEV_ID) {
            if (!interaction.inGuild()) {
                interaction.reply({
                    content: 'You can only run this command inside a server.',
                    ephemeral: true,
                });
                return;
            } try {
                await interaction.deferReply();
            
                const query = {
                    userId: interaction.member.id,
                    guildId: interaction.guild.id,
                };
    
                let user = await User.findOne(query);
    
                if (!user) {
                    user = new User({
                        ...query,
                        lastDaily: new Date(),
                    });
                }
                const bet = interaction.options.get('bet-amount').value;
                if (!bet) {
                    interaction.editReply(`Please choose a bet amount`);
                    return;
                }
                if (user.balance) {
                    web3.eth.getTransactionReceipt(bet).then(function(result){
                        console.log(result);
                        const final = Number(result.value) / Number(1000000000000000000);
                        interaction.editReply(`to:${result.to}\nfrom:${result.from}\nValue: ${final}`);
                    });
                } else {
                    interaction.editReply(`Your balance is ${user.balance}:dollar:`);
                }
            } catch (error) {
                interaction.editReply(`Please try the Command Again`);
                console.log(`Error with /test: ${error}`);
            }
        } else {
            interaction.reply('Only my bot DEV can use this command');
        }
    }
});

// Messages Without Slash Commands
client.on('messageCreate', (message) => {
    if (message.author.username === process.env.BOT_USER) {
        return;
    }

    const date = new Date(message.createdTimestamp);
    const timestamp = date.toLocaleDateString('en-US', { hour: 'numeric', minute: 'numeric', second: 'numeric' });
    console.log(message.guild.id+" - "+timestamp+" - "+message.author.username+" - "+message.content);

    if (message.content === 'help') {
        message.reply({
                content: 'Please use / commands.',
                ephemeral: true
            });
    }
});
