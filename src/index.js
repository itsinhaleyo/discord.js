require('dotenv').config();
const { REST, Routes, ActionRowBuilder, MessageFlags, ButtonBuilder, ButtonStyle, ComponentType, ActivityType, ApplicationCommandOptionType, Client, GatewayIntentBits, IntentsBitField, EmbedBuilder, AttachmentBuilder, Events } = require('discord.js');
const { VoiceConnectionStatus, joinVoiceChannel, createAudioPlayer, createAudioResource, getVoiceConnection, StreamType, AudioPlayerStatus, NoSubscriberBehavior } = require('@discordjs/voice');
const eventHandler = require('./handlers/eventHandler');
const { LeaderboardBuilder, RankCardBuilder, Font } = require('canvacord');
Font.loadDefault();
const { GoogleGenAI } = require("@google/genai");
const ytdl = require('youtube-dl-exec');
const fetch = require('isomorphic-unfetch');
const { getData, getTracks } = require('spotify-url-info')(fetch);
const { MusicCard } = require("./handlers/MusicCard.js");
const fs = require('fs');
const path = require('path');
const util = require('util');
const songsDir = path.join(__dirname, 'songs');

//Audio Player
const musictimers = new Map();
const musicqueues = new Map();

function createProgressBar(currentMs, totalMs, size = 15) {
    if (!totalMs || totalMs <= 0) return "▱".repeat(size) + " `[0%]`";
    const progress = Math.min(currentMs / totalMs, 1);
    const progressIndex = Math.round(size * progress);
    const bar = "▰".repeat(progressIndex) + "▱".repeat(size - progressIndex);
    const percentage = Math.round(progress * 100);
    return `**${bar}** \`[${percentage}%]\``;
}

async function playSong(guildId) {
    const serverQueue = musicqueues.get(guildId);
    if (!serverQueue || serverQueue.songs.length === 0) {
        if (serverQueue.lastMessage) serverQueue.lastMessage.delete().catch(() => {});
        const timer = setTimeout(() => {
            const conn = getVoiceConnection(guildId);
            if (conn) conn.destroy();
            musicqueues.delete(guildId);
        }, 900000);
        musictimers.set(guildId, timer);
        return;
    }
    serverQueue.page = 0;
    const song = serverQueue.songs[0];
    if (!song.url && song.isSpotify) {
        try {
            const output = await ytdl(song.title, { 
                dumpSingleJson: true, 
                defaultSearch: 'ytsearch1:', 
                noCheckCertificates: true, 
                jsRuntimes: 'node' 
            });
            const videoData = output.entries ? output.entries[0] : output;
            if (!videoData || (!videoData.webpage_url && !videoData.url)) {
                serverQueue.songs.shift();
                return playSong(guildId);
            }
            song.url = videoData.webpage_url || videoData.url;
        } catch (err) {
            serverQueue.songs.shift();
            return playSong(guildId);
        }
    }
    const videoIdMatch = song.url.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/watch\?.+&v=))([\w-]{11})/);
    const videoId = videoIdMatch ? videoIdMatch[1] : `temp_${Buffer.from(song.title).toString('base64').slice(0, 5)}`;
    const filePath = path.join(songsDir, `${videoId}.webm`);
    try {
        if (serverQueue.lastMessage) {
            try { await serverQueue.lastMessage.delete(); } catch (err) {}
        }
        if (!fs.existsSync(filePath)) {
            const downloadMsg = await serverQueue.textChannel.send(`Caching for **${song.title}**... ⏳`);
            try {
                await ytdl(song.url, {
                    format: 'bestaudio',
                    output: filePath,
                    noCheckCertificates: true,
                    jsRuntimes: 'node'
                });
                await downloadMsg.delete().catch(() => {});
            } catch (err) {
                await downloadMsg.delete().catch(() => {});
                console.error("Download Error:", err);
                serverQueue.songs.shift();
                return playSong(guildId);
            }
        }
        let output;
        if (song.url.includes('youtube.com') || song.url.includes('youtu.be')) {
            output = await ytdl(song.url, { dumpSingleJson: true, noCheckCertificates: true, jsRuntimes: 'node' });
        } else {
            output = { title: song.title, duration: 0, thumbnail: null };
        }
        const videoTitle = output.title || song.title;
        const totalMs = (output.duration || song.duration || 0) * 1000;
        const generateEmbed = () => {
            const start = 1 + (serverQueue.page * 5);
            const upcoming = serverQueue.songs.slice(start, start + 5);
            const queueList = upcoming.length > 0 ? upcoming.map((s, i) => `\`${start + i}.\` ${s.title}`).join('\n') : "No more songs.";
            const currentRes = serverQueue.player.state.resource;
            const volPercent = currentRes && currentRes.volume ? Math.round(currentRes.volume.volume * 100) : 100;
            const volIcon = volPercent === 0 ? "🔇" : volPercent < 50 ? "🔉" : "🔊";
            return new EmbedBuilder()
                .setTitle("Now Playing 🎶")
                .setDescription(`**[${song.displayTitle || videoTitle}](${song.url})**\n${createProgressBar(serverQueue.currentTimestamp, totalMs)}`)
                .setThumbnail(output.thumbnail || null)
                .addFields(
                    { name: 'Duration', value: `\`${formatTime(serverQueue.currentTimestamp)} / ${formatTime(totalMs)}\``, inline: true },
                    { name: 'Volume', value: `${volIcon} \`${volPercent}%\``, inline: true },
                    { name: 'Queue Size', value: `${serverQueue.songs.length} songs`, inline: true },
                    { name: `Upcoming (Page ${serverQueue.page + 1}):`, value: queueList }
                ).setColor("#00ff00");
        };
        const musicRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('pause_resume').setLabel('⏸️/▶️').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('skip_song').setLabel('⏭️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('stop_music').setLabel('🛑').setStyle(ButtonStyle.Danger),
        );
        const navRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('prev_page').setLabel('⬅️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('next_page').setLabel('➡️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('vol_up').setLabel('🔊⬆️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('vol_down').setLabel('🔉⬇️').setStyle(ButtonStyle.Secondary),
        );
        const sentMessage = await serverQueue.textChannel.send({ embeds: [generateEmbed()], components: [musicRow, navRow] });
        serverQueue.lastMessage = sentMessage;
        const resource = createAudioResource(filePath, { 
            inputType: StreamType.Arbitrary, 
            inlineVolume: true, 
            ffmpegOptions: ['-ss', String(Math.floor(serverQueue.currentTimestamp / 1000))]
        });
        serverQueue.player.play(resource);
        const collector = sentMessage.createMessageComponentCollector({ componentType: ComponentType.Button, time: 600000 });
        collector.on('collect', async i => {
            if (i.member.voice.channelId !== i.guild.members.me.voice.channelId) {
                return i.reply({ content: "Join the voice channel!", flags: [MessageFlags.Ephemeral] });
            }
            if (i.customId === 'next_page') {
                if ((serverQueue.page + 1) * 5 < serverQueue.songs.length - 1) {
                    serverQueue.page++;
                    await i.update({ embeds: [generateEmbed()] });
                } else { await i.reply({ content: "End of queue reached.", flags: [MessageFlags.Ephemeral] }); }
            } else if (i.customId === 'prev_page') {
                if (serverQueue.page > 0) {
                    serverQueue.page--;
                    await i.update({ embeds: [generateEmbed()] });
                } else { await i.reply({ content: "First page reached.", flags: [MessageFlags.Ephemeral] }); }
            } else if (i.customId === 'pause_resume') {
                if (serverQueue.player.state.status === AudioPlayerStatus.Playing) {
                    serverQueue.player.pause();
                    await i.reply({ content: "Paused ⏸️", flags: [MessageFlags.Ephemeral] });
                } else {
                    serverQueue.player.unpause();
                    await i.reply({ content: "Resumed ▶️", flags: [MessageFlags.Ephemeral] });
                }
            } else if (i.customId === 'skip_song') {
                serverQueue.isSkipping = true;
                serverQueue.currentTimestamp = 0; 
                serverQueue.player.stop();
                await i.reply({ content: "Skipped ⏭️", flags: [MessageFlags.Ephemeral] });
                collector.stop();
            } else if (i.customId === 'stop_music') {
                serverQueue.songs = [];
                serverQueue.isSkipping = true;
                serverQueue.currentTimestamp = 0;
                serverQueue.player.stop();
                await i.reply({ content: "Stopped 🛑", flags: [MessageFlags.Ephemeral] });
                collector.stop();
            } else if (i.customId === 'vol_up' || i.customId === 'vol_down') {
                const currentRes = serverQueue.player.state.resource;
                if (currentRes && currentRes.volume) {
                    let vol = currentRes.volume.volume;
                    vol = (i.customId === 'vol_up') ? Math.min(vol + 0.1, 2.0) : Math.max(vol - 0.1, 0.1);
                    currentRes.volume.setVolume(vol);
                    await i.reply({ content: `Volume: **${Math.round(vol * 100)}%**`, flags: [MessageFlags.Ephemeral] });
                }
            }
        });
        serverQueue.player.once(AudioPlayerStatus.Playing, () => {
            const timer = setInterval(async () => {
                if (serverQueue.player.state.status === AudioPlayerStatus.Playing) {
                    serverQueue.currentTimestamp += 1000;
                    if (serverQueue.currentTimestamp % 1000 === 0 && serverQueue.lastMessage) {
                        await serverQueue.lastMessage.edit({ embeds: [generateEmbed()] }).catch(() => {});
                    }
                } else { clearInterval(timer); }
            }, 1000);
        });
        serverQueue.player.once(AudioPlayerStatus.Idle, () => {
            if (serverQueue.currentTimestamp < 1000 && !serverQueue.isSkipping) {
                console.error(`[Playback Error] Song ended too quickly. Retrying...`);
                return playSong(guildId); 
            }
            if (serverQueue.isSkipping) {
                serverQueue.isSkipping = false;
                serverQueue.currentTimestamp = 0;
                serverQueue.songs.shift();
                processDownloadQueue(guildId); 
                return playSong(guildId);
            }
            serverQueue.currentTimestamp = 0;
            serverQueue.songs.shift();
            processDownloadQueue(guildId); 
            playSong(guildId);
        });
    } catch (error) {
        console.error("Playback Error:", error);
        serverQueue.songs.shift();
        playSong(guildId);
    }
}

async function processDownloadQueue(guildId) {
    const serverQueue = musicqueues.get(guildId);
    if (!serverQueue || serverQueue.songs.length === 0) return;
    const lookAheadLimit = 6; 
    const songsToCache = serverQueue.songs.slice(1, lookAheadLimit);
    for (const song of songsToCache) {
        if (!song.url) continue; 
        const videoIdMatch = song.url.match(/(?:https?:\/\/)?(?:www\.)?youtu(?:be\.com\/watch\?v=|\.be\/)([\w\-_]+)/);
        const videoId = videoIdMatch ? videoIdMatch[1] : `temp_${Math.random().toString(36).slice(2, 7)}`;
        const filePath = path.join(songsDir, `${videoId}.webm`);
        if (!fs.existsSync(filePath)) {
            try {
                await ytdl(song.url, {
                    format: 'bestaudio',
                    output: filePath,
                    noCheckCertificates: true,
                    jsRuntimes: 'node'
                });
                console.log(`Successfully cached: ${song.title}`);
            } catch (err) {
                console.error(`Background download failed for ${song.title}:`, err);
            }
        }
    }
}

// Format Time
function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Get User Data
async function getuser(userId) {
    let [rows] = await db.query("SELECT * FROM users WHERE userid = ?", [userId]);
    if (rows[0]) return rows[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await db.query('INSERT INTO users VALUES(?, ?, ?, ?, ?)', [userId, 25000, yesterday.toDateString(), 0, 1]);
    return { userid: userId, balance: 25000, daily: yesterday.toDateString(), xp: 0, level: 1 };
}

// Function to get a Random Number
function getRandomNumber(x, y) {
    const range = y - x + 1;
    const randomNumber = Math.floor(Math.random() * range);
    return randomNumber + x;
}

// Turn  Numbers to Emojis
function numtoemo(number) {
    if (number === undefined || number === null) return "0️⃣"; 
    const emojiMap = {'0': '0️⃣', '1': '1️⃣', '2': '2️⃣', '3': '3️⃣', '4': '4️⃣', '5': '5️⃣', '6': '6️⃣', '7': '7️⃣', '8': '8️⃣', '9': '9️⃣'};
    return number.toString().replace(/\d/g, digit => emojiMap[digit]);
}

// Function to Calculate Xp
async function giveXp(interaction) {
    const xpToGive = getRandomNumber(1, 5);
    try {
        const [[user]] = await db.query("SELECT * FROM users WHERE userid = ?", [interaction.member.id]);
        if (!user) return;
        let newXp = Number(user.xp) + xpToGive;
        let neededXp = 100 * Number(user.level);
        if (newXp >= neededXp) {
            const newLevel = Number(user.level) + 1;
            const xpLeft = newXp - neededXp;
            const bonusBalance = Number(user.balance) + neededXp;
            await db.query(
                'UPDATE users SET level = ?, xp = ?, balance = ? WHERE userid = ?', 
                [newLevel, xpLeft, bonusBalance, interaction.member.id]
            );
            const [[rankData]] = await db.query(
                `SELECT COUNT(*) + 1 AS \`rank\` FROM users 
                 WHERE (level > ?) OR (level = ? AND xp > ?)`, 
                [newLevel, newLevel, xpLeft]
            );
            const rankCard = new canvacord.Rank()
                .setAvatar(interaction.user.displayAvatarURL({ size: 256, extension: 'png' }))
                .setRank(rankData.rank)
                .setLevel(newLevel)
                .setCurrentXP(xpLeft)
                .setRequiredXP(100 * newLevel)
                .setProgressBar('#00FF00', 'COLOR')
                .setUsername(interaction.user.username)
                .setBackground("COLOR", "#23272A");
            const data = await rankCard.build();
            const attachment = new AttachmentBuilder(data, { name: 'levelup.png' });
            if (interaction.channel) {
                await interaction.channel.send({
                    content: `🎉 ${interaction.member} just leveled up while playing! **Level ${newLevel}** reached! +${neededXp}💵`,
                    files: [attachment]
                });
            }
        } else {
            await db.query('UPDATE users SET xp = ? WHERE userid = ?', [newXp, interaction.member.id]);
        }
    } catch (error) {
        console.error(`=-=GIVE=XP=ERROR=-= ${error}`);
    }
}

// High/Low Function
async function runHiLow(interaction, choice) {
    await interaction.deferReply();
    const userId = interaction.member.id;
    const bet = interaction.options.getNumber('bet-amount');
    try {
        let [userRows] = await db.query("SELECT * FROM users WHERE userid = ?", [userId]);
        let [gameRows] = await db.query("SELECT * FROM hilow WHERE userid = ?", [userId]);
        let user = userRows[0];
        let game = gameRows[0];
        if (!user) {
            await db.query('INSERT INTO users (userid, balance) VALUES(?, ?)', [userId, 25000]);
            user = { balance: 25000 };
        }
        if (!game) {
            await db.query('INSERT INTO hilow VALUES(?, ?)', [userId, 5]);
            game = { lastNumber: 5 };
        }
        if (!bet) {
            return await interaction.editReply(`Your Last Number is :${numtoemo(game.lastNumber)}`);
        }
        if (bet < 1 || user.balance < bet) {
            return interaction.editReply(`Invalid bet. Your balance: ${numtoemo(user.balance)}`);
        }
        if (bet >= 1000) giveXp(interaction);
        const nextNum = Math.floor(Math.random() * 11) + 1;
        const lastNum = Number(game.lastNumber);
        if (nextNum === lastNum) {
            return interaction.editReply(`➡️ **${nextNum}** ➡️\nIt's a tie! No money lost.`);
        }
        const isHighWin = (choice === 'high' && nextNum > lastNum);
        const isLowWin = (choice === 'low' && nextNum < lastNum);
        const didWin = isHighWin || isLowWin;
        const payout = didWin ? Math.floor(bet / 4) : -bet;
        const arrow = nextNum > lastNum ? '⬆️' : '⬇️';
        await db.query('UPDATE users SET balance = balance + ? WHERE userid = ?', [payout, userId]);
        await db.query('UPDATE hilow SET lastNumber = ? WHERE userid = ?', [nextNum, userId]);
        const embed = new EmbedBuilder()
            .setTitle(didWin ? '💰 You Won!' : '💀 You Lost')
            .setColor(didWin ? 'Green' : 'Red')
            .setDescription([
                `New Card: **${arrow} ${nextNum} ${arrow}**`,
                `Old Card: **${lastNum}**`,
                `Result: **${payout >= 0 ? '+' : ''}${payout} 💵**`
            ].join('\n'));
        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error(error);
        interaction.editReply("Something went wrong. Try again!");
    }
}

// Rock/Paper/Scissors Function
async function runRPS(interaction, choice) {
    await interaction.deferReply();
    const userId = interaction.member.id;
    const bet = interaction.options.getNumber('bet-amount');
    const gameData = {
        rock: { emoji: '🪨', beats: 'scissors', loseEmoji: '📜' },
        paper: { emoji: '📜', beats: 'rock', loseEmoji: '✂️' },
        scissors: { emoji: '✂️', beats: 'paper', loseEmoji: '🪨' }
    };
    try {
        const user = await getuser(userId);
        if (bet < 1 || user.balance < bet) {
            return interaction.editReply(`Balance too low! You have ${numtoemo(user.balance)} 💵`);
        }
        if (bet >= 1000) giveXp(interaction);
        const choices = ['rock', 'paper', 'scissors'];
        const botChoice = choices[Math.floor(Math.random() * 3)];
        let result, payout, color;
        if (choice === botChoice) {
            result = "It's a tie!";
            payout = 0;
            color = 'Yellow';
        } else if (gameData[choice].beats === botChoice) {
            result = `Win! ${gameData[choice].emoji} beats ${gameData[botChoice].emoji}`;
            payout = bet;
            color = 'Green';
        } else {
            result = `Lost! ${gameData[botChoice].emoji} beats ${gameData[choice].emoji}`;
            payout = -bet;
            color = 'Red';
        }
        await db.query('UPDATE users SET balance = balance + ? WHERE userid = ?', [payout, userId]);
        const [updatedUser] = await db.query("SELECT balance FROM users WHERE userid = ?", [userId]);
        const embed = new EmbedBuilder()
            .setTitle('Rock Paper Scissors')
            .setColor(color)
            .setDescription([
                `You: **${gameData[choice].emoji}** vs Bot: **${gameData[botChoice].emoji}**`,
                `**${result}**`,
                `Result: **${payout >= 0 ? '+' : ''}${payout} 💵**`,
                `New Balance: ${numtoemo(updatedUser[0].balance)} 💵`
            ].join('\n'));
        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error(error);
        interaction.editReply("Error running RPS.");
    }
}

// Get SlotMachine Spins
const slotConfig = {
    '🍒': { x3: 2,  x4: 5,   x5: 10,  grid9: 25,  label: 'Cherries' },
    '🍋': { x3: 5,  x4: 10,  x5: 20,  grid9: 50,  label: 'Lemons' },
    '🍇': { x3: 10, x4: 20,  x5: 40,  grid9: 100, label: 'Grapes' },
    '🔔': { x3: 20, x4: 40,  x5: 80,  grid9: 200, label: 'Bells' },
    '💎': { x3: 50, x4: 100, x5: 250, grid9: 500, label: 'DIAMONDS' },
    '7️⃣': { x3: 100, x4: 250, x5: 750, grid9: 1000, label: 'JACKPOT' }
};
const slotReels = Object.keys(slotConfig); 

async function onexthreespinWheel(interaction, user, bet, spin) {
    const results = Array.from({ length: 3 }, () => Math.floor(Math.random() * slotReels.length));
    const emojis = results.map(i => slotReels[i]);
    const isWin = (results[0] === results[1] && results[1] === results[2]);
    const multiplier = isWin ? slotConfig[emojis[0]].x3 : 0;
    const payout = isWin ? (bet * multiplier) : (spin === 1 ? 0 : -bet);
    let result = await db.query("SELECT * FROM users WHERE userid = ?", [interaction.member.id]);
    user = result[0][0];
    const newBalance = Number(user.balance) + payout;
    await db.query('UPDATE users SET balance = balance + ? WHERE userid = ?', [payout, interaction.member.id]);
    const embed = new EmbedBuilder()
        .setTitle(spin === 1 ? '🔥 FREE SPIN' : '🎰 Classic 1x3 Slots')
        .setColor(isWin ? 'Gold' : (spin === 1 ? 'Blue' : 'Red'))
        .setDescription(['```', '┌───────────────┐', `│ ${emojis[0]} | ${emojis[1]} | ${emojis[2]} │`, '└───────────────┘', '```', 
            isWin ? `**${slotConfig[emojis[0]].label} WIN!** ${multiplier}X!` : (spin === 1 ? 'No luck...' : 'Better luck next time!'),
            `**Result:** ${payout >= 0 ? '+' : ''}${payout} 💵`, `**Balance:** ${numtoemo(newBalance)} 💵`
        ].join('\n'));
    spin === 1 ? await interaction.followUp({ embeds: [embed] }) : await interaction.editReply({ embeds: [embed] });
    return isWin ? multiplier : 0;
}

async function onexfivespinWheel(interaction, user, bet, spin) {
    const results = Array.from({ length: 5 }, () => Math.floor(Math.random() * slotReels.length));
    const emojis = results.map(i => slotReels[i]);
    const counts = {};
    results.forEach(idx => counts[idx] = (counts[idx] || 0) + 1);
    const maxMatch = Math.max(...Object.values(counts));
    const winEmoji = slotReels[Object.keys(counts).find(key => counts[key] === maxMatch)];
    let multiplier = 0;
    if (maxMatch >= 3) {
        const data = slotConfig[winEmoji];
        multiplier = maxMatch === 5 ? data.x5 : (maxMatch === 4 ? data.x4 : data.x3);
    }
    const payout = multiplier > 0 ? (bet * multiplier) : (spin === 1 ? 0 : -bet);
    let result = await db.query("SELECT * FROM users WHERE userid = ?", [interaction.member.id]);
    user = result[0][0];
    const newBalance = Number(user.balance) + payout;
    await db.query('UPDATE users SET balance = balance + ? WHERE userid = ?', [payout, interaction.member.id]);
    const embed = new EmbedBuilder()
        .setTitle(spin === 1 ? '🔥 FREE SPIN' : '🎰 Deluxe 1x5 Slots')
        .setColor(multiplier > 0 ? 'Gold' : (spin === 1 ? 'Blue' : 'Red'))
        .setDescription(['```', '┌─────────────────────────┐', `│ ${emojis.join(' | ')} │`, '└─────────────────────────┘', '```',
            multiplier > 0 ? `**${maxMatch}-REEL ${slotConfig[winEmoji].label} WIN!**` : 'No match found.',
            `**Result:** ${payout >= 0 ? '+' : ''}${payout} 💵`, `**Balance:** ${numtoemo(newBalance)} 💵`
        ].join('\n'));
    spin === 1 ? await interaction.followUp({ embeds: [embed] }) : await interaction.editReply({ embeds: [embed] });
    return multiplier;
}

async function threexthreespinWheel(interaction, user, bet, spin) {
    const results = Array.from({ length: 9 }, () => Math.floor(Math.random() * slotReels.length));
    const emojis = results.map(i => slotReels[i]);
    const counts = {};
    results.forEach(idx => counts[idx] = (counts[idx] || 0) + 1);
    const maxMatch = Math.max(...Object.values(counts));
    const winEmoji = slotReels[Object.keys(counts).find(key => counts[key] === maxMatch)];
    let multiplier = 0;
    if (maxMatch >= 5) {
        const data = slotConfig[winEmoji];
        if (maxMatch === 9) multiplier = data.grid9;
        else if (maxMatch >= 7) multiplier = data.x5;
        else multiplier = data.x4;
    }
    const payout = multiplier > 0 ? (bet * multiplier) : (spin === 1 ? 0 : -bet);
    let result = await db.query("SELECT * FROM users WHERE userid = ?", [interaction.member.id]);
    user = result[0][0];
    const newBalance = Number(user.balance) + payout;
    await db.query('UPDATE users SET balance = balance + ? WHERE userid = ?', [payout, interaction.member.id]);
    const embed = new EmbedBuilder()
        .setTitle(spin === 1 ? '🔥 FREE SPIN' : '🎰 3x3 Royale Grid')
        .setColor(multiplier > 0 ? 'Gold' : (spin === 1 ? 'Blue' : 'Red'))
        .setDescription(['```', '┌───────────────┐', `│ ${emojis[0]} | ${emojis[1]} | ${emojis[2]} │`, `│ ${emojis[3]} | ${emojis[4]} | ${emojis[5]} │`, `│ ${emojis[6]} | ${emojis[7]} | ${emojis[8]} │`, '└───────────────┘', '```',
            multiplier > 0 ? `**${maxMatch}x ${slotConfig[winEmoji].label} MATCH!**` : 'Better luck next time!',
            `**Result:** ${payout >= 0 ? '+' : ''}${payout} 💵`, `**Balance:** ${numtoemo(newBalance)} 💵`
        ].join('\n'));
    spin === 1 ? await interaction.followUp({ embeds: [embed] }) : await interaction.editReply({ embeds: [embed] });
    return multiplier;
}

// Blackjack Score
function calculateScore(hand) {
    let score = 0;
    let aces = 0;
    for (const card of hand) {
        if (card === 'A') {
            aces += 1;
            score += 11;
        } else if (['J', 'Q', 'K'].includes(card)) {
            score += 10;
        } else {
            score += parseInt(card);
        }
    }
    while (score > 21 && aces > 0) {
        score -= 10;
        aces -= 1;
    }
    return score;
}

// Hishdice Functions
const diceChances = Array.from({ length: 19 }, (_, i) => ({
    name: `${(i + 1) * 5}% Chance`,
    value: i + 1
}));

// Roulette Command
const blackNumbers = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];
const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const mapToChoice = (num) => ({ name: `${num}`, value: num });

// Slash Commands Name and Descriptions
const commands = [
    { name: 'help', description: 'Help Command' },
    { name: 'dig', description: '60% chance to Collect 1-1000 every Minute' },
    { name: 'daily', description: 'Collect 25000 Daily' },
    { name: 'ping', description: 'Replies With the Bots Ping' },
    { name: 'queue', description: 'Displays the current music queue' },
    { name: 'test', description: 'Test Functtion'},
    { 
        name: 'eval', 
        description: 'run a line of code',
        options: [
            {
                name: 'code',
                description: 'A line of code',
                type: ApplicationCommandOptionType.String,
                required: true
            }
        ]
    },
    {
        name: 'leaderboard',
        description: 'View the server leaderboards',
        options: [
            {
                name: 'money',
                description: 'Top 10 richest users',
                type: ApplicationCommandOptionType.Subcommand
            },
            {
                name: 'rank',
                description: 'Top 10 highest level users',
                type: ApplicationCommandOptionType.Subcommand
            }
        ]
    },
    {
        name: 'play',
        description: 'Plays a Song',
        options: [
            {
                name: 'search',
                description: 'A Youtube/Spotify Link',
                type: ApplicationCommandOptionType.String,
                required: true
            },
        ]

    },
    {
        name: 'ai',
        description: 'Interact with Gemini AI',
        options: [
            {
                name: 'prompt',
                description: 'Give Gemini AI a Prompt',
                type: ApplicationCommandOptionType.String,
                required: true
            },
        ]
    },
    {
        name: 'bj',
        description: 'Play a Game of Blackjack',
        options: [
            {
                name: 'bet-amount',
                description: 'Choose how much to bet (if you havent already started a Game)',
                type: ApplicationCommandOptionType.Number,
                required: true,
                min_value: 1
            }
        ]
    },
    {
        name: 'plinko',
        description: 'Play a Game of Plinko',
        options: [
            {
                name: 'bet-amount',
                description: 'Choose how much to bet (if you havent already started a Game)',
                type: ApplicationCommandOptionType.Number,
                required: true,
                min_value: 1
            }
        ]
    },
    {
        name: "baccarat",
        description: 'Play a Game of Baccarat',
        options: [
            {
                name: 'bet-amount',
                description: 'Choose how much to bet (if you havent already started a Game)',
                type: ApplicationCommandOptionType.Number,
                required: true,
                min_value: 1
            }
        ]
    },
    {
        name: "blackjack",
        description: 'Play a Game of Blackjack',
        options: [
            {
                name: 'bet-amount',
                description: 'Choose how much to bet (if you havent already started a Game)',
                type: ApplicationCommandOptionType.Number,
                required: true,
                min_value: 1
            }
        ]
    },
    {
        name: 'towers',
        description: 'Play a Game of Towers',
        options: [
            {
                name: 'tower-choice',
                description: 'Choose Which tower you want to Advance to',
                type: ApplicationCommandOptionType.Number,
                choices: [
                    { name: "Option 1", value: 1 },
                    { name: "Option 2", value: 2 },
                    { name: "Option 3", value: 3 }
                ]
            },
            {
                name: 'bet-amount',
                description: 'Choose how much to bet (if you havent already started a Game)',
                type: ApplicationCommandOptionType.Number,
                min_value: 1
            },
            {
                name: 'game-end',
                description: 'Choose if you would like to end the game or not after this play.',
                type: ApplicationCommandOptionType.Number,
                choices: [
                    {
                        name: "END GAME",
                        value: 1 
                    }
                ]
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
                required: true,
                min_value: 1
            },
            {
                name: 'number',
                description: 'Choose a Middle to Bet Against between 2-999 to Change your Odds',
                type: ApplicationCommandOptionType.Number,
                required: true,
                choices: diceChances
            },
            {
                name: 'higher-lower',
                description: 'Choose to bet Higher than your number or Lower',
                type: ApplicationCommandOptionType.Number,
                required: true,
                choices: [
                    { name: 'Higher', value: 1, },
                    { name: 'Lower', value: 2, }
                ]
            }
        ]
    },
    {
        name: 'slot',
        description: "Spin a Selection of SlotMachines",
        options: [
            {
                name: 'bet-amount',
                description: 'Choose how much to bet',
                type: ApplicationCommandOptionType.Number,
                required: true,
                min_value: 1
            },
            {
                name: 'game',
                description: 'Choose a Game to Play',
                type: ApplicationCommandOptionType.Number,
                required: true,
                choices: [
                    { name: "1 Line x 3 Long", value: 1 },
                    { name: "1 Line x 5 Long", value: 2 },
                    { name: "3 Lines x 3 Long", value: 3 }
                ]
            }
        ]
    },
    {
        name: 'roulette',
        description: 'Play a Game of Roulette',
        options: [
            {
                name: 'bet',
                description: 'Amount to wager',
                type: ApplicationCommandOptionType.Integer,
                required: true,
                min_value: 1
            },
            {
                name: 'black',
                description: 'Bet on a black number or "All Black"',
                type: ApplicationCommandOptionType.Integer,
                choices: [
                    { name: '⬛ All Black (2x Payout)', value: 420 },
                    ...blackNumbers.map(mapToChoice)
                ]
            },
            {
                name: 'red',
                description: 'Bet on a red number or "All Red"',
                type: ApplicationCommandOptionType.Integer,
                choices: [
                    { name: '🟥 All Red (2x Payout)', value: 420 },
                    ...redNumbers.map(mapToChoice)
                ]
            },
            {
                name: 'green',
                description: 'Bet on the green zero',
                type: ApplicationCommandOptionType.Integer,
                choices: [{ name: '🟩 0 (35x Payout)', value: 0 }]
            }
        ]
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
        name: 'crash',
        description: 'Play a Game of crash',
        options: [
            {
                name: 'bet-amount',
                description: 'Choose how much to bet',
                type: ApplicationCommandOptionType.Number,
                min_value: 1,
                required: true
            }
        ]
    },
    {
        name: 'dice',
        description: 'Play a Game of crash',
        options: [
            {
                name: 'bet-amount',
                description: 'Choose how much to bet',
                type: ApplicationCommandOptionType.Number,
                min_value: 1,
                required: true
            },
            {
                name: 'guess',
                description: 'Choose how much to bet',
                type: ApplicationCommandOptionType.Number,
                required: true,
                choices: [
                    { 
                        name: '1', 
                        value: '1'
                    },
                    { 
                        name: '2', 
                        value: '2' 
                    },
                    { 
                        name: '3', 
                        value: '3' 
                    },
                    { 
                        name: '4', 
                        value: '4' 
                    },
                    { 
                        name: '5', 
                        value: '5' 
                    },
                    { 
                        name: '6', 
                        value: '6' 
                    }
                ]
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
                min_value: 1
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
                min_value: 1
            }
        ]
    },
    {
        name: 'coinflip',
        description: 'Play a Game of Heads or Tails',
        options: [
            {
                name: 'bet-amount',
                description: 'Choose how much to bet',
                type: ApplicationCommandOptionType.Number,
                required: true,
                min_value: 1
            },
            {
                name: 'side',
                description: 'Pick heads or tails',
                type: ApplicationCommandOptionType.String,
                required: true,
                choices: [
                    { 
                        name: 'Heads', 
                        value: 'heads'
                    },
                    { 
                        name: 'Tails', 
                        value: 'tails' 
                    }
                ]
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
                required: true,
                min_value: 1
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
                required: true,
                min_value: 1
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
                required: true,
                min_value: 1
            }
        ]
    },
    {
        name: 'level',
        description: "Shows Your/Someone's Level",
        options: [
            {
                name: 'user',
                description: 'The user whose balance you want to get',
                type: ApplicationCommandOptionType.User,
            }
        ]
    },
    {
        name: 'give',
        description: "Give 💵 to another User",
        options: [
            {
                name: 'user',
                description: 'The user whose balance you want to get',
                type: ApplicationCommandOptionType.User,
                required: true
            },
            {
                name: 'amount',
                description: 'The Amount you want to Give',
                type: ApplicationCommandOptionType.Number,
                required: true,
                min_value: 1
            }
        ]
    },
];

// Defining REST Client
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

// Client Intentions
const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds, 
        GatewayIntentBits.GuildVoiceStates,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ]
});

// Connect to Database, Connect to Google Gemini, Registering Slash Commands, Logging in the Bot
let db;
let ai;
(async () => {
    try {
        // Connect to Database
        db = require('./database/db');
        console.log("Connected to Database.");
        // Connecting to AI
        ai = new GoogleGenAI({});
        console.log("Google Gemini Online.");
        // Registering Slash Commands
        let [rows] = await db.query("SELECT guildid FROM guilds");
        const guildIdArray = rows.map(row => row.guildid);
        await Promise.all(guildIdArray.map(guildId => 
            rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
                { body: commands }
            )
        ));
        console.log(`Slash Commands Registered for ${guildIdArray.length} guilds.`);
        // Logging in the Bot
        eventHandler(client);
        client.login(process.env.TOKEN);
    } catch (error) {
        console.log(`=-=ERROR=-= ${error}`);
    }
})();

//Detect if bot joins a new guild
client.on('guildCreate', guild => {
    rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, guild.id),
        { body: commands }
    )
    db.query('INSERT INTO guilds VALUES(?)', [guild.id]);
    console.log(`Joined a new guild: ${guild.name}`);
});

//Detect if bot leaves a guild
client.on('guildDelete', (guild) => {
    db.query('DELETE FROM guilds WHERE guildid = ?', [guild.id]);
    console.log(`Bot was removed from: ${guild.name}`);
});

// Status Messages
let status = [
    {
        name: 'Porn',
        type: ActivityType.Streaming,
        url: "https://www.twitch.tv/itsinhaleyo"
    },
    {
        name: 'Meth Cooking',
        type: ActivityType.Streaming,
        url: "https://www.twitch.tv/itsinhaleyo"
    },
    {
        name: 'My Suicide',
        type: ActivityType.Streaming,
        url: "https://www.twitch.tv/itsinhaleyo"
    }
]

//Client Onready
client.once(Events.ClientReady, (c) => {
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

    if (interaction.commandName === "high") await runHiLow(interaction, 'high');
    if (interaction.commandName === "low") await runHiLow(interaction, 'low');
    if (interaction.commandName === 'rock') await runRPS(interaction, 'rock');
    if (interaction.commandName === 'paper') await runRPS(interaction, 'paper');
    if (interaction.commandName === 'scissors') await runRPS(interaction, 'scissors');

    if (interaction.commandName === 'help') {
        const embed = new EmbedBuilder()
            .setTitle('Commands List')
            .setColor('Blue')
            .setDescription(
                "### 🛠️ Utility\n" +
                "`/ping - Replies with the bot's latency`\n" +
                "`/level - Shows your server level`\n" +
                "`/leaderboard - Shows User Rankings`\n"+
                "`/ai - Generate a response from Gemini`\n" +
                "### 🎵 Music\n"+
                "`/play - Play a Song/Playlist from a Youtube or Spotify Link`\n"+
                "`/queue - View Current Music Queue`\n"+
                "### 💰 Economy\n" +
                "`/balance - View your wallet`\n" +
                "`/give - Give another User 💵`\n"+
                "`/daily - Claim your 25,000💵`\n" +
                "`/dig - Mine for rewards (every minute)`\n" +
                "### 🎲 Games\n" +
                "`/blackjack` • `/slots` • `/roulette`\n" +
                "`/coinflip` • `/rock/paper/scissors` • `/towers`\n" +
                "`/high/low` • `/crash` • `/dice`\n" +
                "`/baccarat` • `/plinko`"
            );
        interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'ping') {
        await interaction.deferReply();
        const reply = await interaction.fetchReply();
        const ping = reply.createdTimestamp - interaction.createdTimestamp;
        interaction.editReply(`Client ${ping}ms | Websocket: ${client.ws.ping}ms`);
    }

    if (interaction.commandName === 'balance') {
        try {
            await interaction.deferReply();
            const targetUser = interaction.options.getUser('user') || interaction.user;
            let user = await getuser(interaction.member.id);
            const balanceEmbed = new EmbedBuilder()
                .setAuthor({ 
                    name: `${targetUser.username}'s Wallet`, 
                    iconURL: targetUser.displayAvatarURL({ dynamic: true }) 
                })
                .setColor('Gold')
                .addFields(
                    { 
                        name: 'Balance', 
                        value: `💵**${numtoemo(user.balance)}**`, 
                        inline: false 
                    }
                )
                .setTimestamp()
            await interaction.editReply({ embeds: [balanceEmbed] });
        } catch (error) {
            console.error("Balance Error: " + error);
            interaction.editReply("Could not retrieve balance. Please try again.");
        }
    }

    if (interaction.commandName === "give") {
        if (!interaction.inGuild()) {
            return interaction.reply({
                content: 'You can only run this command inside a server.',
                flags: [MessageFlags.Ephemeral],
            });
        }
        try {
            await interaction.deferReply();
            const amount = interaction.options.getNumber('amount');
            const targetUser = interaction.options.getUser('user');
            if (targetUser.id === interaction.user.id) return interaction.editReply("You can't give money to yourself!");
            let sender = await getuser(interaction.member.id);
            let receiver = await getuser(targetUser.id);
            if (sender.balance < amount) {
                return interaction.editReply(`You don't have enough! Balance: **${numtoemo(sender?.balance || 0)}** 💵`);
            }
            const newSenderBalance = Number(sender.balance) - amount;
            let newReceiverBalance = Number(receiver.balance) + amount;
            await db.query('UPDATE users SET balance = ? WHERE userid = ?', [newReceiverBalance, targetUser.id]);
            await db.query('UPDATE users SET balance = ? WHERE userid = ?', [newSenderBalance, interaction.member.id]);
            const successEmbed = new EmbedBuilder()
                .setTitle('💸 Transfer Successful')
                .setColor('Green')
                .setThumbnail(targetUser.displayAvatarURL())
                .setDescription(`**${interaction.user.username}** sent **${amount}** 💵 to **${targetUser.username}**!`)
                .addFields(
                    { 
                        name: `${interaction.user.username}'s Wallet`, 
                        value: `${numtoemo(newSenderBalance)} 💵`, 
                        inline: true 
                    },
                    { 
                        name: `${targetUser.username}'s Wallet`, 
                        value: `${numtoemo(newReceiverBalance)} 💵`, 
                        inline: true 
                    }
                )
                .setFooter({ text: `Transaction ID: ${Date.now().toString().slice(-6)}` })
                .setTimestamp();
            await interaction.editReply({ embeds: [successEmbed] });
        } catch (error) {
            console.error(`Error with /give: ${error}`);
            interaction.editReply(`An error occurred.`);
        }
    }

    if (interaction.commandName === 'coinflip') {
        if (!interaction.inGuild()) {
            return interaction.reply({
                content: 'You can only run this command inside a server.',
                flags: [MessageFlags.Ephemeral],
            });
        }
        try {
            await interaction.deferReply();
            let user = await getuser(interaction.member.id);
            const bet = interaction.options.getNumber('bet-amount');
            const sideChosen = interaction.options.getString('side');
            if (user.balance < bet) {
                return interaction.editReply(`Insufficient funds! Balance: ${numtoemo(user.balance)} 💵`);
            }
            if (bet >= 1000) giveXp(interaction);
            const flipResult = Math.random() < 0.5 ? 'heads' : 'tails';
            const imagePath = path.join(__dirname, 'images', `${flipResult}.png`); 
            const file = new AttachmentBuilder(imagePath);
            const win = sideChosen === flipResult;
            const payout = win ? bet : -bet;
            const newBalance = Number(user.balance) + payout;
            await db.query('UPDATE users SET balance = ? WHERE userid = ?', [newBalance, interaction.member.id]);
            const embed = new EmbedBuilder()
                .setTitle(win ? '🪙 You Won!' : '🪙 You Lost!')
                .setColor(win ? 'Green' : 'Red')
                .setThumbnail(`attachment://${flipResult}.png`) 
                .setDescription([
                    `The coin landed on: **${flipResult.toUpperCase()}**`,
                    `You chose: **${sideChosen.toUpperCase()}**`,
                    '',
                    win ? `**Profit:** +${bet} 💵` : `**Loss:** -${bet} 💵`,
                    `**New Balance:** ${numtoemo(newBalance)} 💵`
                ].join('\n'))
                .setTimestamp();
            await interaction.editReply({ embeds: [embed], files: [file] });
        } catch (error) {
            console.error(`Error with /coinflip: ${error}`);
            interaction.editReply("Something went wrong with the coin toss!");
        }
    }

    if (interaction.commandName === 'dig') {
        if (!interaction.inGuild()) {
            return interaction.reply({
                content: 'You can only run this command inside a server.',
                flags: [MessageFlags.Ephemeral],
            });
        }
        try {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            const [[cooldown]] = await db.query("SELECT * FROM cooldown WHERE userid = ? AND command = 'dig'", [interaction.member.id]);
            let currentUser = await getuser(interaction.member.id);
            const now = Date.now();
            if (cooldown && now < cooldown.endsAt) {
                const timeLeft = Math.round((cooldown.endsAt - now) / 1000);
                const cooldownEmbed = new EmbedBuilder()
                    .setTitle('⏳ Cooling Down...')
                    .setDescription(`You're exhausted! Take a break for **${timeLeft}** more seconds.`)
                    .setColor('Yellow');
                return interaction.editReply({ embeds: [cooldownEmbed] });
            }
            const digChance = getRandomNumber(0, 100);
            const newCooldownTime = now + 60000;
            if (!cooldown) {
                await db.query('INSERT INTO cooldown VALUES(?, ?, ?)', [interaction.member.id, 'dig', newCooldownTime]);
            } else {
                await db.query('UPDATE cooldown SET endsAt = ? WHERE userid = ? AND command = "dig"', [newCooldownTime, interaction.member.id]);
            }
            const embed = new EmbedBuilder().setTimestamp();
            if (digChance < 40) {
                embed
                    .setTitle('⛏️ Better luck next time...')
                    .setDescription('You dug for a while but only found dirt.')
                    .setColor('Red');
                await interaction.editReply({ embeds: [embed] });
            } else {
                const digAmount = getRandomNumber(1, 1000);
                const newBalance = currentUser.balance + digAmount;
                await db.query('UPDATE users SET balance = ? WHERE userid = ?', [newBalance, interaction.member.id]);
                await giveXp(interaction);
                embed
                    .setTitle('⛏️ You found something!')
                    .setDescription(`You struck a small vein of gold!\n\n**Profit:** +${digAmount} 💵\n**New Balance:** ${numtoemo(newBalance)}`)
                    .setColor('Green')
                await interaction.editReply({ embeds: [embed] });
            }
        } catch (error) {
            console.error(`Error with /dig: ${error}`);
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Error')
                .setDescription('Something went wrong with the shovel. Try again!')
                .setColor('DarkRed');
            interaction.editReply({ embeds: [errorEmbed] });
        }
    }

    if (interaction.commandName === 'daily') {
        try {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            const currentDate = new Date().toDateString();
            const dailyAmount = 25000;
            let user = await getuser(interaction.member.id);
            if (user.daily === currentDate) {
                const waitEmbed = new EmbedBuilder()
                    .setTitle('⏳ Already Claimed')
                    .setDescription("You've already collected your daily reward today. Come back tomorrow!")
                    .setColor('Yellow');
                return interaction.editReply({ embeds: [waitEmbed] });
            }
            const newBalance = Number(user.balance) + dailyAmount;
            await db.query('UPDATE users SET balance = ?, daily = ? WHERE userid = ?', [newBalance, currentDate, interaction.member.id]);
            await giveXp(interaction);
            const successEmbed = new EmbedBuilder()
                .setTitle('💰 Daily Reward Claimed!')
                .setDescription(`You received your daily **${dailyAmount}** 💵!\n\n**New Balance:** ${numtoemo(newBalance)}`)
                .setColor('Gold')
                .setThumbnail(interaction.user.displayAvatarURL())
                .setTimestamp();
            await interaction.editReply({ embeds: [successEmbed] });
        } catch (error) {
            console.error(`Error with /daily: ${error}`);
            interaction.editReply(`An error occurred while claiming your daily reward.`);
        }
    }

    if (interaction.commandName === "level") {
        try {
            await interaction.deferReply();
            const targetUser = interaction.options.getUser('user') || interaction.user;
            let user = await getuser(targetUser.id); 
            const [[rankData]] = await db.query(
                `SELECT COUNT(*) + 1 AS \`rank\` FROM users 
                WHERE (level > ?) OR (level = ? AND xp > ?)`, 
                [user.level, user.level, user.xp]
            );
            const rank = new RankCardBuilder()
                .setAvatar(targetUser.displayAvatarURL({ size: 256, extension: 'png' }))
                .setRank(Number(rankData.rank))
                .setLevel(Number(user.level))
                .setCurrentXP(Number(user.xp))
                .setRequiredXP(100 * Number(user.level))
                .setUsername(targetUser.username)
                .setDisplayName(targetUser.globalName || targetUser.username)
                .setBackground("#23272A")
                .setStyles({
                    progressbar: {
                        thumb: {
                            style: {
                                backgroundColor: "#FF0069",
                            },
                        },
                    },
                });
            const data = await rank.build({ format: 'png' });
            const attachment = new AttachmentBuilder(data, { name: 'rank.png' });
            await interaction.editReply({ files: [attachment] });
        } catch (error) {
            console.error(`Rank Error: ${error}`);
            interaction.editReply(`Failed to load rank card. Please try again.`);
        }
    }

    if (interaction.commandName === 'leaderboard') {
        try {
            await interaction.deferReply();
            const subcommand = interaction.options.getSubcommand();
            const query = subcommand === 'money' 
                ? "SELECT userid, balance as xp, level FROM users ORDER BY balance DESC LIMIT 10"
                : "SELECT userid, level, xp FROM users ORDER BY level DESC, xp DESC LIMIT 10";
            const [allUsers] = await db.query(query);
            if (allUsers.length === 0) return interaction.editReply("No data found.");
            const players = await Promise.all(allUsers.map(async (u, index) => {
                let fetchedUser;
                try {
                    fetchedUser = await interaction.client.users.fetch(u.userid);
                } catch {
                    fetchedUser = { username: "Unknown", displayAvatarURL: () => "" };
                }
                return {
                    avatar: fetchedUser.displayAvatarURL({ extension: "png", size: 128 }),
                    username: fetchedUser.username,
                    displayName: fetchedUser.displayName || fetchedUser.username,
                    level: subcommand === 'money' ? null : Number(u.level),
                    xp: subcommand === 'money' ? Number(u.xp) : Number(u.xp),
                    rank: index + 1,
                };
            }));
            const lb = new LeaderboardBuilder()
                .setPlayers(players)
                .setVariant("default")
                .setTextStyles({
                    xp: subcommand === 'money' ? "" : "XP",
                    level: subcommand === 'money' ? "" : "Level" 
                });
            const image = await lb.build({ format: "png" });
            const attachment = new AttachmentBuilder(image, { name: 'leaderboard.png' });
            await interaction.editReply({ files: [attachment] });
        } catch (error) {
            console.error(`Leaderboard Error: ${error}`);
            interaction.editReply("Failed to load the leaderboard image.");
        }
    }

    if (interaction.commandName === "roulette") {
        if (!interaction.inGuild()) {
            return interaction.reply({
                content: 'You can only run this command inside a server.',
                flags: [MessageFlags.Ephemeral],
            });
        }
        try {
            await interaction.deferReply();
            let user = await getuser(interaction.member.id);
            const bet = interaction.options.getInteger('bet');
            const redChoice = interaction.options.getInteger('red');
            const blackChoice = interaction.options.getInteger('black');
            const greenChoice = interaction.options.getInteger('green');
            if (user.balance < bet) {
                return interaction.editReply(`You don't have enough money! Your balance is ${numtoemo(user.balance)}`);
            }
            const choices = [redChoice, blackChoice, greenChoice].filter(v => v !== null && v !== undefined);
            if (choices.length === 0) return interaction.editReply("You must pick a number or color to bet on!");
            if (choices.length > 1) return interaction.editReply("Please only choose **one** bet per spin.");
            if (bet >= 1000) giveXp(interaction);
            const spin = getRandomNumber(0, 36);
            let win = false;
            let payout = 0;
            const userChoice = choices[0];
            if (userChoice === 420) {
                const isRedBet = redChoice === 420;
                if (isRedBet && redNumbers.includes(spin)) win = true;
                if (!isRedBet && blackNumbers.includes(spin)) win = true;
                payout = bet;
            } else {
                if (spin === userChoice) win = true;
                payout = userChoice === 0 ? bet * 35 : bet * 11; 
            }
            const newBalance = win ? user.balance + payout : user.balance - bet;
            await db.query('UPDATE users SET balance = ? WHERE userid = ?', [newBalance, interaction.member.id]);
            const colorEmoji = spin === 0 ? '🟩' : (redNumbers.includes(spin) ? '🟥' : '⬛');
            const resultEmbed = new EmbedBuilder()
                .setTitle(win ? '🎉 Winner!' : '💀 Loser!')
                .setColor(win ? 'Green' : 'Red')
                .setDescription([
                    `The ball landed on: **${colorEmoji} ${spin}**`,
                    '',
                    win ? `**Profit:** +${payout} 💵` : `**Loss:** -${bet} 💵`,
                    `**New Balance:** ${numtoemo(newBalance)}`
                ].join('\n'))
                .setTimestamp();
            await interaction.editReply({ embeds: [resultEmbed] });
        } catch (error) {
            console.error(`Error with /roulette: ${error}`);
            interaction.editReply(`An error occurred. Please try again.`);
        }
    }

    if (interaction.commandName === "slot") {
        if (!interaction.inGuild()) {
            return interaction.reply({
                content: 'You can only run this command inside a server.',
                flags: [MessageFlags.Ephemeral],
            });
        }
        try {
            await interaction.deferReply();
            let user = await getuser(interaction.member.id);
            const bet = interaction.options.getNumber('bet-amount');
            const game = interaction.options.getNumber('game');
            if (!bet || bet < 1) return interaction.editReply("You must bet at least 1 💵.");
            if (user.balance < bet) return interaction.editReply(`You don't have enough! Balance: ${numtoemo(user.balance)} 💵`);
            if (bet >= 1000) giveXp(interaction);
            let freeSpinCount = 0;
            let gameFunction;
            if (game === 1) gameFunction = onexthreespinWheel;
            else if (game === 2) gameFunction = onexfivespinWheel;
            else if (game === 3) gameFunction = threexthreespinWheel;
            const multiplier = await gameFunction(interaction, user, bet, 0);
            freeSpinCount = Math.min(multiplier, 10); 
            if (freeSpinCount > 0) {
                const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
                for (let i = 0; i < freeSpinCount; i++) {
                    await wait(2000);
                    const [freshUser] = await db.query("SELECT balance FROM users WHERE userid = ?", [interaction.member.id]);
                    await gameFunction(interaction, freshUser[0], bet, 1);
                }
            }
        } catch (error) {
            console.error(`Error with /slot: ${error}`);
            if (interaction.deferred) interaction.editReply(`Error: ${error.message}`);
        }
    }

    if (interaction.commandName === "hashdice") {
        if (!interaction.inGuild()) {
            return interaction.reply({
                content: 'You can only run this command inside a server.',
                flags: [64],
            });
        }
        try {
            await interaction.deferReply();
            const bet = interaction.options.getNumber('bet-amount');
            const hl = interaction.options.getNumber('higher-lower');
            let user = await getuser(interaction.member.id);
            if (user.balance < bet) return interaction.editReply(`You don't have enough! Balance: ${numtoemo(user.balance)} 💵`);
            const targetNumber = getRandomNumber(1, 999);
            const raNumber = getRandomNumber(1, 1000);
            let winChance = (hl === 1) ? (1000 - targetNumber) / 10 : targetNumber / 10;
            if (winChance < 1) winChance = 1; 
            const multiplier = parseFloat((98 / winChance).toFixed(2));
            if (bet >= 1000) giveXp(interaction);
            let finalBalanceChange = 0;
            let resultTitle = "";
            let embedColor = 0x2f3136;
            if (raNumber === targetNumber) {
                resultTitle = "It's a Tie! 🤝";
                embedColor = 0xFFFF00;
            } else {
                const won = (hl === 1) ? (raNumber > targetNumber) : (raNumber < targetNumber);
                if (won) {
                    finalBalanceChange = Math.trunc(bet * multiplier);
                    await db.query('UPDATE users SET balance = balance + ? WHERE userid = ?', [finalBalanceChange, interaction.member.id]);
                    resultTitle = "You Won! 🔥";
                    embedColor = 0x00FF00;
                } else {
                    finalBalanceChange = -bet;
                    await db.query('UPDATE users SET balance = balance - ? WHERE userid = ?', [bet, interaction.member.id]);
                    resultTitle = "You Lost! 💀";
                    embedColor = 0xFF0000;
                }
            }
            const displayRoll = raNumber < 10 ? `0${raNumber}` : raNumber.toString();
            const displayTarget = targetNumber < 10 ? `0${targetNumber}` : targetNumber.toString();
            const rollSpace = raNumber < 100 ? "⏹️⏹️" : "⏹️";
            const targetSpace = targetNumber < 100 ? "⏹️⏹️" : "⏹️";
            const hlText = (hl === 1) ? "⬆️Higher" : "⬇️Lower";
            const diceDisplay = [
                `⏹️⏹️⏹️⏹️⏹️`,
                `${rollSpace}${numtoemo(displayRoll)} ${hlText}`,
                `${targetSpace}${numtoemo(displayTarget)} ⬅️ Target`,
                `⏹️⏹️⏹️⏹️⏹️`
            ].join('\n');
            const embed = new EmbedBuilder()
                .setTitle(resultTitle)
                .setColor(embedColor)
                .setDescription(diceDisplay)
                .addFields(
                    { name: 'Target', value: `**${targetNumber}**`, inline: true },
                    { name: 'Multiplier', value: `**x${multiplier}**`, inline: true },
                    { name: 'Payout', value: `${finalBalanceChange >= 0 ? '+' : ''}${finalBalanceChange} 💵`, inline: true },
                    { name: 'New Balance', value: `${numtoemo(user.balance + finalBalanceChange)} 💵`, inline: false }
                )
                .setFooter({ text: `Win Chance: ${winChance.toFixed(1)}%` })
                .setTimestamp();
            return await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error(`Error with /hashdice:`, error);
            return interaction.editReply(`Something went wrong. Please try again!`);
        }
    }

    if (interaction.commandName === "towers") {
        if (!interaction.inGuild()) {
            return interaction.reply({
                content: 'You can only run this command inside a server.',
                flags: [MessageFlags.Ephemeral],
            })
        };
        await interaction.deferReply();
        const result = await db.query("SELECT * FROM towers WHERE userid = ?", [interaction.member.id]);
        const game = result[0][0];
        let user = await getuser(interaction.member.id);
        if (!game) {
            await db.query('INSERT INTO towers VALUES(?, 0, 0, 1, 1, 1, 1, 1)', [userId]);
            game = { userid: interaction.member.id, status: 0, bet: 0, item1: 1, item2: 1, item3: 1, item4: 1, item5: 1 };
        }
        const multipliers = { 1: 1.2, 2: 1.5, 3: 2, 4: 3.0, 5: 5.0, 6: 10 };
        const colors = { win: "#00ff00", loss: "#ff0000", progress: "#ffff00", cashout: "#00ffff" };
        const getRow = (level, bombPos) => {
            const mult = multipliers[level] ? `[${multipliers[level]}x]` : "";
            const row = ["⭕", "⭕", "⭕"].map((circle, i) => (i + 1) === Number(bombPos) ? "❌" : circle).join("");
            return `| ${row} | \`${mult}\``;
        };
        const tower = interaction.options.getNumber('tower-choice');
        const bet = interaction.options.getNumber('bet-amount');
        const endGame = interaction.options.getNumber('game-end') === 1; 
        const embed = new EmbedBuilder().setAuthor({ name: `${interaction.user.username}'s Tower`, iconURL: interaction.user.displayAvatarURL() });
        if (endGame && game.status >= 1) {
            const winAmount = Math.floor(game.bet * (multipliers[game.status - 1] || 1));
            const newBal = Number(user.balance) + winAmount;
            await db.query('UPDATE users SET balance = ? WHERE userid = ?', [newBal, interaction.member.id]);
            await db.query('UPDATE towers SET status = 0, bet = 0 WHERE userid = ?', [interaction.member.id]);
            embed.setTitle("💰 Cash Out Success!")
                .setColor(colors.cashout)
                .setDescription(`You reached **Level ${game.status - 1}** safely.\n\n**Winnings:** ${numtoemo(winAmount)}\n**New Balance:** ${numtoemo(newBal)}`);
            return interaction.editReply({ embeds: [embed] });
        }
        if (!tower) {
            return interaction.editReply("Please choose a tower to proceed with.");
        }
        const currentLevel = Number(game.status) === 0 ? 1 : Number(game.status);
        if (Number(game.status) === 0) {
            if (!bet || Number(bet) < 1) return interaction.editReply("Enter a valid bet.");
            if (Number(user.balance) < Number(bet)) return interaction.editReply(`Low balance: ${user.balance}💵`);
            const r = Array.from({ length: 5 }, () => Math.floor(Math.random() * 3) + 1);
            await db.query('UPDATE towers SET item1 = ?, item2 = ?, item3 = ?, item4 = ?, item5 = ?, bet = ?, status = 1 WHERE userid = ?', [r[0], r[1], r[2], r[3], r[4], Number(bet), interaction.member.id]);
            game.item1 = r[0]; game.item2 = r[1]; game.item3 = r[2]; 
            game.item4 = r[3]; game.item5 = r[4]; 
            game.bet = Number(bet);
            game.status = 1;
        }
        const bombPosition = game[`item${currentLevel}`];
        let boardArray = [];
        for (let i = 1; i <= currentLevel; i++) {
            boardArray.unshift(getRow(i, game[`item${i}`]));
        }
        if (tower === bombPosition) {
            const newBal = Number(user.balance) - Number(game.bet);
            await db.query('UPDATE towers SET status = 0, bet = 0 WHERE userid = ?', [interaction.member.id]);
            await db.query('UPDATE users SET balance = ? WHERE userid = ?', [newBal, interaction.member.id]);
            embed.setTitle("💥 BOMB! Game Over")
                .setColor(colors.loss)
                .setDescription(`${boardArray.join("\n")}\n\nYou lost **${game.bet}**.\n**Balance:** ${numtoemo(newBal)}`);
        } else {
            const nextStatus = currentLevel + 1;
            let title = `✅ Level ${currentLevel} Passed`;
            let desc = `${boardArray.join("\n")}\n\nNext Multiplier: **${multipliers[nextStatus] || '10.0'}x**`;
            let color = colors.progress;
            if (currentLevel === 5) {
                title = "🔥 DOUBLE OR NOTHING UNLOCKED!";
                desc = `${boardArray.join("\n")}\n\n**Level 5 Cleared!** You are currently at **5.0x**.\nDo you dare try the **Level 6 Bonus?**\n\n⚠️ **WARNING:** Level 6 has **2 BOMBS** and pays **10.0x**!`;
                color = "#ffaa00";
            } else if (currentLevel === 6) {
                const nextStatus = currentLevel - 1;
                title = "👑 THE ULTIMATE CHAMPION!";
                desc = `${boardArray.join("\n")}\n\n**You cleared the Bonus Round!**\nMultiplier: **10.0x**!! Cash out now!`;
                color = "#ff00ff";
            }
            await db.query('UPDATE towers SET status = ? WHERE userid = ?', [nextStatus, user.userid]);
            embed.setTitle(title)
                .setColor(color)
                .setDescription(desc)
                .setFooter({ text: `Current Bet: ${numtoemo(game.bet)}` });
        }
        return interaction.editReply({ embeds: [embed] });
    }

    if (interaction.commandName === "bj" || interaction.commandName == "blackjack") {
        if (!interaction.inGuild()) {
            return interaction.reply({
                content: 'You can only run this command inside a server.',
                flags: [64],
            });
        }
        await interaction.deferReply();
        let user = await getuser(interaction.member.id);
        const bet = interaction.options.getNumber('bet-amount');
        if (!bet || bet < 1) return interaction.editReply("Enter a valid bet.");
        if (Number(user.balance) < bet) return interaction.editReply(`Low balance: ${user.balance}💵`);
        await db.query("UPDATE users SET balance = balance - ? WHERE userid = ?", [bet, interaction.user.id]);
        let deck = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
        let playerHand = [deck[Math.floor(Math.random() * deck.length)], deck[Math.floor(Math.random() * deck.length)]];
        let dealerHand = [deck[Math.floor(Math.random() * deck.length)]];
        const generateEmbed = (title, showDealerCard = false) => {
            const pScore = calculateScore(playerHand);
            const dScore = calculateScore(dealerHand);
            return new EmbedBuilder()
                .setTitle(title)
                .setColor(0xFF0069)
                .addFields(
                    { name: 'Your Hand', value: `${playerHand.join(', ')} (**${pScore}**)`, inline: true },
                    { name: 'Dealer Hand', value: showDealerCard ? `${dealerHand.join(', ')} (**${dScore}**)` : `${dealerHand[0]}, ?`, inline: true }
                )
                .setFooter({ text: pScore > 21 ? 'Busted!' : 'React with 👊 to Hit or ✋ to Stand' });
        };
        const playerHasBJ = calculateScore(playerHand) === 21;
        if (playerHasBJ) {
            const bjPayout = Math.floor(bet * 2.5);
            await db.query("UPDATE users SET balance = balance + ? WHERE userid = ?", [bjPayout, interaction.user.id]);
            const bjEmbed = generateEmbed("BLACKJACK! 🃏", true, 0x00FF00)
                .setDescription(`Natural 21!\nYou won **+${bjPayout - bet}**!\nNew Balance: **${user.balance - bet + bjPayout}**`);
            return await interaction.editReply({ embeds: [bjEmbed] });
        }
        const gameMessage = await interaction.editReply({ 
            embeds: [generateEmbed(`${interaction.user.username}'s Blackjack`)], 
            fetchReply: true 
        });
        await gameMessage.react('👊');
        await gameMessage.react('✋');
        const filter = (reaction, user) => ['👊', '✋'].includes(reaction.emoji.name) && user.id === interaction.user.id;
        const collector = gameMessage.createReactionCollector({ filter, time: 60000 });
        collector.on('collect', async (reaction, user) => {
            await reaction.users.remove(user.id).catch(() => null);
            if (reaction.emoji.name === '👊') {
                playerHand.push(deck[Math.floor(Math.random() * deck.length)]);
                if (calculateScore(playerHand) > 21) {
                    return collector.stop('bust');
                }
                await interaction.editReply({ embeds: [generateEmbed(`${interaction.user.username}'s Blackjack`)] });
            } else {
                collector.stop('stand');
            }
        });
        collector.on('end', async (collected, reason) => {
            let finalTitle = "";
            let payout = 0;
            let winLossMessage = "";
            if (reason === 'bust') {
                embedColor = 0xFF0000;
                finalTitle = "You Busted! 💥 Dealer Wins.";
            } else if (reason === 'stand') {
                while (calculateScore(dealerHand) < 17) {
                    dealerHand.push(deck[Math.floor(Math.random() * deck.length)]);
                }
                const pScore = calculateScore(playerHand);
                const dScore = calculateScore(dealerHand);
                if (dScore > 21) {
                    embedColor = 0x00FF00;
                    payout = bet * 2;
                    finalTitle = "Dealer Busted! You Win! 🎉";
                    winLossMessage = `+${numtoemo(bet)}`;
                } else if (pScore > dScore) {
                    embedColor = 0x00FF00;
                    payout = bet * 2;
                    finalTitle = "You Win! 🎉";
                    winLossMessage = `+${numtoemo(bet)}`;
                } else if (dScore > pScore) {
                    embedColor = 0xFF0000;
                    finalTitle = "Dealer Wins! 🏠";
                    winLossMessage = `-${numtoemo(bet)}`;
                } else {
                    embedColor = 0xFFFF00;
                    payout = bet;
                    finalTitle = "It's a Tie! 🤝";
                    winLossMessage = `Your ${numtoemo(bet)} was returned.`;
                }; 
            } else {
                embedColor = 0x2f3136;
                finalTitle = "Game Timed Out! ⏰";
            }
            if (payout > 0) {
                await db.query("UPDATE users SET balance = balance + ? WHERE userid = ?", [payout, interaction.user.id]);
            }
            const finalEmbed = generateEmbed(finalTitle, true)
                .setColor(embedColor)
                .setFooter(null)
                .setDescription(`${winLossMessage}\nYour new balance: ${numtoemo(Number(user.balance) - bet + payout)}`);
            await interaction.editReply({ embeds: [finalEmbed] });
            await gameMessage.reactions.removeAll().catch(() => null);
        });
    }

    if (interaction.commandName === "crash") {
        await interaction.deferReply();
        const bet = interaction.options.getNumber('bet-amount');
        let user = await getuser(interaction.member.id);
        if (user.balance < bet) {
            return interaction.editReply(`You don't have enough! Balance: ${numtoemo(user.balance)} 💵`);
        }
        let currentMultiplier = 1.00;
        const crashPoint = (0.99 / (1 - Math.random())).toFixed(2);
        let gameEnded = false;
        let cashedOut = false;
        const cashOutBtn = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('cashout').setLabel('🚀 CASH OUT').setStyle(ButtonStyle.Success)
        );
        const generateEmbed = (status, color) => {
            const progress = Math.min(Math.floor((currentMultiplier / 5) * 20), 20);
            const bar = '🟩'.repeat(progress) + '⬜'.repeat(20 - progress);
            return new EmbedBuilder()
                .setTitle('💫 CRASH GAME')
                .setColor(color)
                .addFields(
                    { name: 'Bet Amount', value: `\`${bet.toLocaleString()}\``, inline: true },
                    { name: 'Multiplier', value: `\`${currentMultiplier.toFixed(2)}x\``, inline: true },
                    { name: 'Profit', value: `\`+${Math.floor(bet * currentMultiplier - bet).toLocaleString()}\``, inline: true },
                    { name: 'Final Progress', value: `\`${bar}\`` }
                )
                .setDescription(status);
        };
        const msg = await interaction.editReply({ 
            embeds: [generateEmbed('🚀 Rocket is flying...', 'Yellow')], 
            components: [cashOutBtn] 
        });
        const collector = msg.createMessageComponentCollector({ time: 60000 });
        collector.on('collect', async i => {
            if (i.user.id !== interaction.member.id) return i.reply({ content: "This isn't your game!", flags: [MessageFlags.Ephemeral] });
            if (i.customId === 'cashout' && !gameEnded) {
                cashedOut = true;
                gameEnded = true;
                const profit = Math.floor(bet * currentMultiplier - bet);
                await db.query('UPDATE users SET balance = balance + ? WHERE userid = ?', [profit, interaction.member.id]);
                await i.update({ 
                    embeds: [generateEmbed(`💰 **CASHED OUT!**\nYou won **${profit.toLocaleString()}** 💵\nNew Balance: ${numtoemo(user.balance+profit)}💵`, 'Green')], 
                    components: [] 
                });
                collector.stop();
            }
        });
        const gameLoop = setInterval(async () => {
            if (cashedOut) return clearInterval(gameLoop);
            currentMultiplier += 0.10 + (currentMultiplier * 0.05);
            if (currentMultiplier >= crashPoint) {
                gameEnded = true;
                clearInterval(gameLoop);
                collector.stop();
                await db.query('UPDATE users SET balance = balance - ? WHERE userid = ?', [bet, interaction.member.id]);
                return interaction.editReply({ 
                    embeds: [generateEmbed(`💥 **ROCKET CRASHED!**\nYou lost **${bet.toLocaleString()}** 💵\nCrash Point: **${crashPoint}x**\nNew Balance: ${numtoemo(user.balance-bet)}💵`, 'Red')], 
                    components: [] 
                });
            }
            await interaction.editReply({ embeds: [generateEmbed('🚀 Rocket is flying...', 'Yellow')] }).catch(() => clearInterval(gameLoop));
        }, 1500);
    }

    if (interaction.commandName === "dice") {
        await interaction.deferReply();
        const bet = interaction.options.getNumber('bet-amount');
        const guess = interaction.options.getNumber('guess');
        try {
            let user = await getuser(interaction.member.id);
            if (user.balance < bet) {
                return interaction.editReply(`Insufficient funds! Balance: ${numtoemo(user.balance)} 💵`);
            }
            const roll = Math.floor(Math.random() * 5) + 1;
            const didWin = (roll === guess);
            const payout = didWin ? (bet * 4) : -bet; 
            const totalWinAmount = bet * 5;
            await db.query('UPDATE users SET balance = balance + ? WHERE userid = ?', [payout, interaction.member.id]);
            const embed = new EmbedBuilder()
                .setTitle(didWin ? '🎲 Dice - Winner!!' : '🎲 Dice - Better Luck Next Time')
                .setColor(didWin ? '#2ecc71' : '#e74c3c')
                .setDescription([
                    `<@${interaction.member.id}> rolled the dice, hoping for **${guess}**...`,
                    '',
                    didWin 
                        ? `*The dice landed perfectly on **${roll}**!*` 
                        : `*The dice landed on **${roll}**. So close!*`,
                    '',
                    didWin 
                        ? `Their perfect match earned them **$${totalWinAmount.toLocaleString()}** ✨`
                        : `Better luck next time, you lost **$${bet.toLocaleString()}** 💵`,
                    `New Balance ${numtoemo(user.balance+payout)}💵`
                ].join('\n'));
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            interaction.editReply("Something went wrong with the dice roll.");
        }
    }

    if (interaction.commandName === "baccarat") {
        await interaction.deferReply();
        const bet = interaction.options.getNumber('bet-amount');
        const user = await getuser(interaction.member.id);
        if (user.balance < bet) {
            return interaction.editReply(`Insufficient funds! Balance: ${numtoemo(user.balance)} 💵`);
        }
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('player').setLabel('👤 Player (1:1)').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('banker').setLabel('🏦 Banker (1:0.95)').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('tie').setLabel('👔 Tie (8:1)').setStyle(ButtonStyle.Success)
        );
        const embed = new EmbedBuilder()
            .setTitle('🃏 Baccarat Table')
            .setColor('Blue')
            .setDescription(`Place your bet of **${bet.toLocaleString()} 💵** on who will win!`)
            .setFooter({ text: 'Tens/Faces = 0 | Closest to 9 wins' });
        const msg = await interaction.editReply({ embeds: [embed], components: [row] });
        const collector = msg.createMessageComponentCollector({ time: 30000 });
        collector.on('collect', async i => {
            if (i.user.id !== interaction.member.id) return i.reply({ content: "Start your own game!", flags: [MessageFlags.Ephemeral] });
            await i.deferUpdate();
            const choice = i.customId;
            const pHand = [Math.floor(Math.random() * 10), Math.floor(Math.random() * 10)];
            const bHand = [Math.floor(Math.random() * 10), Math.floor(Math.random() * 10)];
            const pScore = (pHand[0] + pHand[1]) % 10;
            const bScore = (bHand[0] + bHand[1]) % 10;
            let result = '';
            let payout = -bet;
            let color = 'Red';
            if (pScore > bScore) {
                result = 'player';
                if (choice === 'player') { payout = bet; color = 'Green'; }
            } else if (bScore > pScore) {
                result = 'banker';
                if (choice === 'banker') { payout = Math.floor(bet * 0.95); color = 'Green'; }
            } else {
                result = 'tie';
                if (choice === 'tie') { payout = bet * 8; color = 'Green'; }
            }
            await db.query('UPDATE users SET balance = balance + ? WHERE userid = ?', [payout, interaction.member.id]); 
            const resultEmbed = new EmbedBuilder()
                .setTitle(payout >= 0 ? '💰 Winner!' : '💀 House Wins')
                .setColor(color)
                .addFields(
                    { name: 'Player Hand', value: `\`${pHand.join(' | ')}\` (Total: **${pScore}**)`, inline: true },
                    { name: 'Banker Hand', value: `\`${bHand.join(' | ')}\` (Total: **${bScore}**)`, inline: true },
                    { name: 'Your Bet', value: `**${bet}**`, inline: false },
                    { name: 'Result', value: `**${payout >= 0 ? '+' : ''}${payout.toLocaleString()} 💵**` },
                    { name: 'New Balance', value: `${numtoemo(user.balance+payout)} 💵` }
                );
            await interaction.editReply({ embeds: [resultEmbed], components: [] });
            collector.stop();
        });
    }

    if (interaction.commandName === "plinko") {
        await interaction.deferReply();
        const bet = interaction.options.getNumber('bet-amount');
        const user = await getuser(interaction.member.id);
        if (user.balance < bet) {
            return interaction.editReply(`Insufficient funds! Balance: ${numtoemo(user.balance)} 💵`);
        }
        const multipliers = [10, 4, 2, 1.2, 0.5, 0.5, 1.2, 2, 4, 10];
        const rows = 10;
        let ballPos = 5; 
        const wait = (ms) => new Promise(res => setTimeout(res, ms));
        for (let i = 0; i < rows; i++) {
            const move = Math.random() < 0.5 ? -0.5 : 0.5;
            ballPos += move;
            let currentBoard = "";
            for (let j = 0; j < rows; j++) {
                const indent = " ".repeat(rows - j);
                if (j === i) {
                    const ballIdx = Math.round((ballPos / 10) * j);
                    let rowStr = "";
                    for (let p = 0; p <= j; p++) {
                        rowStr += (p === ballIdx) ? "🔴" : "· ";
                    }
                    currentBoard += `${indent}${rowStr}\n`;
                } else {
                    currentBoard += `${indent}${"· ".repeat(j + 1)}\n`;
                }
            }
            const animEmbed = new EmbedBuilder()
                .setTitle('🔴 Plinko Drop...')
                .setColor('Yellow')
                .setDescription(`\`\`\`\n${currentBoard}\n\`\`\``);
            await interaction.editReply({ embeds: [animEmbed] });
            await wait(200);
        }
        const finalIndex = Math.max(0, Math.min(Math.round(ballPos), multipliers.length - 1));
        const winMult = multipliers[finalIndex];
        const payout = Math.floor(bet * winMult) - bet;
        let finalBoard = "";
        for (let i = 0; i < rows; i++) {
            const indent = " ".repeat(rows - i);
            let rowStr = "";
            if (i === rows - 1) {
                for (let p = 0; p <= i; p++) {
                    rowStr += (p === finalIndex) ? "🔴" : "· ";
                }
            } else {
                rowStr = "· ".repeat(i + 1);
            }
            finalBoard += `${indent}${rowStr}\n`;
        }
        await db.query('UPDATE users SET balance = balance + ? WHERE userid = ?', [payout, interaction.member.id]);
        const finalEmbed = new EmbedBuilder()
            .setTitle('🔴 Plinko Result')
            .setColor(winMult >= 1 ? 'Green' : 'Red')
            .setDescription([
                '```',
                finalBoard,
                '```',
                `The ball landed on a **${winMult}x** slot!`,
                `**Result:** ${payout >= 0 ? '+' : ''}${payout.toLocaleString()} 💵`,
                `**New Balance:** ${numtoemo(user.balance+payout)} 💵`
            ].join('\n'))
            .setFooter({ text: 'High risk at the edges, low risk in the middle!' });
        await interaction.editReply({ embeds: [finalEmbed] });
    }

    if (interaction.commandName === "ai") {
        await interaction.deferReply();
        try {
            const prompt = interaction.options.get('prompt')?.value;
            const result = await ai.models.generateContent({
                model: "gemini-3.1-flash-lite-preview",
                contents: prompt
            });
            const aiEmbed = new EmbedBuilder()
                .setAuthor({ name: 'Gemini AI', iconURL: 'https://mir-s3-cdn-cf.behance.net/projects/404/994157188450701.Y3JvcCwxNjE2LDEyNjQsMCww.png' })
                .setColor('#4285F4')
                .setDescription(result.text.substring(0, 2000))
                .setFooter({ text: `Prompt: ${prompt}...` })
                .setTimestamp();
            await interaction.editReply({ embeds: [aiEmbed] });
        } catch (error) {
            console.error("AI Error:", error);
            await interaction.editReply(`❌ **Error:** ${error.message || "An unexpected error occurred."}`);
        }
    }

    if (interaction.commandName === "play") {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        const query = interaction.options.getString('search');
        const guildId = interaction.guildId;
        let songsToAdd = [];
        let serverQueue = musicqueues.get(guildId); 
        const existingTimer = musictimers.get(guildId);
        if (existingTimer) { clearTimeout(existingTimer); musictimers.delete(guildId); }
        try {
            const voiceChannel = interaction.member.voice.channel;
            if (!voiceChannel) {
                return interaction.editReply("You need to be in a voice channel to play music!");
            }
            let connection = getVoiceConnection(guildId);
            if (!connection) {
                connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: guildId,
                    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                });
                connection.on('stateChange', (oldS, newS) => {
                    if (oldS.status === VoiceConnectionStatus.Ready && newS.status === VoiceConnectionStatus.Connecting) {
                        connection.configureNetworking();
                    }
                });
            }
            if (query.includes('spotify.com')) {
                try {
                    const cleanURL = query.split('?')[0];
                    if (cleanURL.includes('/playlist/') || cleanURL.includes('/album/')) {
                        const tracks = await getTracks(cleanURL);
                        songsToAdd = tracks.map(t => ({
                            title: `${t.name} ${t.artists?.[0]?.name || t.artist || "Unknown Artist"}`,
                            displayTitle: t.name,
                            displayArtist: t.artists?.[0]?.name || t.artist || "Unknown Artist",
                            duration: t.duration_ms ? t.duration_ms / 1000 : 0,
                            url: null,
                            isSpotify: true
                        }));
                        await interaction.editReply(`✅ Added **${songsToAdd.length}** tracks from Spotify!`);
                    } else {
                        try {
                            const data = await getData(cleanURL);
                            const trackName = data.name || data.title;
                            const artistName = data.artists ? data.artists[0].name : (data.artist || "Unknown Artist");
                            const durationMs = data.duration_ms || data.duration || 0;
                            songsToAdd.push({ 
                                title: `${trackName} ${artistName}`,
                                displayTitle: trackName,
                                displayArtist: artistName,
                                duration: durationMs / 1000, 
                                url: null, 
                                isSpotify: true 
                            });
                            await interaction.editReply(`✅ Added **${trackName}** to the queue!`);
                        } catch (err) {
                            console.error("Spotify getData Error:", err);
                            return interaction.editReply("❌ I couldn't parse that Spotify track. Is the link valid and public?");
                        }
                    }
                } catch (err) {
                    console.error("Spotify Error:", err);
                    return interaction.editReply("❌ I couldn't load that Spotify link. Is it public?");
                }
            } else {
                const output = await ytdl(query, { 
                    dumpSingleJson: true, 
                    flatPlaylist: true, 
                    format: 'bestaudio', 
                    defaultSearch: 'ytsearch1:',
                    noCheckCertificates: true,
                    jsRuntimes: 'node'
                });
                if (output.entries && output.entries.length > 0) {
                    songsToAdd = output.entries.map(e => ({ 
                        title: e.title, 
                        url: e.url || e.webpage_url || e.original_url, 
                        duration: e.duration || 0
                    }));
                } else {
                    songsToAdd.push({ 
                        title: output.title, 
                        url: output.url || output.webpage_url || output.original_url, 
                        duration: output.duration || 0
                    });
                }
            }
            if (songsToAdd.length === 0) return interaction.editReply({ content: "Could not find any songs.", flags: [MessageFlags.Ephemeral] });
            if (!serverQueue) {
                const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
                const connection = getVoiceConnection(guildId);
                if (connection) {
                    connection.subscribe(player);
                    connection.on('stateChange', (oldS, newS) => {
                        if (oldS.status === VoiceConnectionStatus.Ready && newS.status === VoiceConnectionStatus.Connecting) connection.configureNetworking();
                    });
                }
                serverQueue = { songs: songsToAdd, player, textChannel: interaction.channel, lastMessage: null, currentTimestamp: 0, isSkipping: false, retries: 0, page: 0 };
                musicqueues.set(guildId, serverQueue);
                playSong(guildId);
            } else {
                serverQueue.songs.push(...songsToAdd);
                if (serverQueue.player.state.status === AudioPlayerStatus.Idle) {
                    const conn = getVoiceConnection(guildId);
                    if (conn) conn.subscribe(serverQueue.player);
                    playSong(guildId);
                }
            }
            processDownloadQueue(guildId); 
            const msg = songsToAdd.length > 1 ? `Added **${songsToAdd.length}** songs.` : `Added **${songsToAdd[0].title}** to queue.`;
            await interaction.editReply({ content: msg, flags: [MessageFlags.Ephemeral]});
        } catch (e) {
            console.error(e);
            await interaction.editReply("Error loading music, Make Sure Playlist isnt Private.");
        }
    }

    if (interaction.commandName === "queue") {
        const serverQueue = musicqueues.get(interaction.guildId);
        if (!serverQueue || serverQueue.songs.length === 0) {
            return interaction.reply({ content: "The queue is currently empty.", flags: [MessageFlags.Ephemeral] });
        }
        const songsPerPage = 10;
        const totalPages = Math.ceil(serverQueue.songs.length / songsPerPage);
        let currentPage = 0;
        const generateQueueEmbed = (page) => {
            const start = page * songsPerPage;
            const end = start + songsPerPage;
            const currentSongs = serverQueue.songs.slice(start, end);
            const embed = new EmbedBuilder()
                .setTitle(`Queue for ${interaction.guild.name}`)
                .setColor('#0099ff')
                .setFooter({ text: `Page ${page + 1} of ${totalPages} • Total Songs: ${serverQueue.songs.length}` });
            const list = currentSongs.map((song, index) => {
                const overallIndex = start + index;
                return `${overallIndex === 0 ? '🎶' : `**${overallIndex}.**`} ${song.title}`;
            }).join('\n');
            embed.setDescription(list);
            return embed;
        };
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('prev').setLabel('⬅️ Back').setStyle(ButtonStyle.Primary).setDisabled(true),
            new ButtonBuilder().setCustomId('next').setLabel('Next ➡️').setStyle(ButtonStyle.Primary).setDisabled(totalPages === 1)
        );
        const response = await interaction.reply({
            embeds: [generateQueueEmbed(0)],
            components: totalPages > 1 ? [row] : [],
            flags: [MessageFlags.Ephemeral],
            fetchReply: true
        });
        if (totalPages === 1) return;
        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000
        });
        collector.on('collect', async (i) => {
            if (i.customId === 'prev') currentPage--;
            if (i.customId === 'next') currentPage++;
            row.components[0].setDisabled(currentPage === 0);
            row.components[1].setDisabled(currentPage === totalPages - 1);
            await i.update({
                embeds: [generateQueueEmbed(currentPage)],
                components: [row]
            });
        });
        collector.on('end', () => {
            row.components.forEach(btn => btn.setDisabled(true));
            interaction.editReply({ components: [row] }).catch(() => null);
        });
    }

    if (interaction.commandName === "eval") {
        if (interaction.user.id !== process.env.DEV_ID) {
            return interaction.reply({ content: 'Only my developer can use this.', flags: [MessageFlags.Ephemeral] });
        }
        try {
            await interaction.deferReply();
            const code = interaction.options.getString('code');
            let evaluated = eval(code);
            if (evaluated instanceof Promise) evaluated = await evaluated;
            let output = util.inspect(evaluated, { depth: 0 });
            if (output.length > 1900) output = output.slice(0, 1900) + '...';
            const embed = new EmbedBuilder()
                .setColor('Blurple')
                .setDescription(`**Input:**\n\`\`\`js\n${code}\n\`\`\`\n**Output:**\n\`\`\`js\n${output}\n\`\`\``)
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error(`Eval Error: ${error}`);
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Eval Error')
                .setColor('Red')
                .setDescription(`\`\`\`js\n${error.message}\n\`\`\``);
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }

    if (interaction.commandName === "test") {
        if (interaction.member.id === process.env.DEV_ID) {
            if (!interaction.inGuild()) {
                interaction.reply({
                    content: 'You can only run this command inside a server.',
                    flags: [MessageFlags.Ephemeral],
                });
                return;
            } try {
                await interaction.deferReply();
                try {
                    const card = new MusicCard()
                        .setAuthor("JVKE")
                        .setTitle("Golden Hour")
                        .setImage("https://lh3.googleusercontent.com/i1qCCS4BbP6z11E08FkQg6fN-83Uj4fQg4bmBsD2E6SvGQ3RW7nXxpQ3hmcSlI5Ipek10H7R4BjV5mAY=w544-h544-l90-rj")
                        .setProgress(39)
                        .setCurrentTime("01:58")
                        .setTotalTime("02:59");
                    const image = await card.build();
                    const attachment = new AttachmentBuilder(image, { name: 'music-card.png' });
                    await interaction.editReply({ files: [attachment] });
                } catch(error) {
                    console.error(error);
                    await interaction.editReply(`Error running test:\n\`\`\`${error.message}\`\`\``);
                }
            } catch(error) {
                interaction.reply(`Please try the Command Again\n`+error);
                console.log(error);
            }
        } else {
            interaction.reply('Only my bot DEV can use this command');
        }
    }
});

// Messages Without Slash Commands
client.on('messageCreate', async (message) => {
    if (message.author.username === process.env.BOT_USER) {
        return;
    }
    const date = new Date(message.createdTimestamp);
    const timestamp = date.toLocaleDateString('en-US', { hour: 'numeric', minute: 'numeric', second: 'numeric' });
    console.log(message.guild.id+" - "+timestamp+" - "+message.author.username+" - "+message.content);

    if (message.content === 'help') {
        message.reply({
                content: 'Please use / commands.',
                flags: [MessageFlags.Ephemeral]
            });
    }

    if (message.content.includes("x.com") || message.content.includes("twitter.com")) {
        if (message.author.bot) return;
        try {
            if (message.content.includes("fxtwitter.com")) return;
            let replacement = message.content
                .replace("x.com", "fixupx.com")
                .replace("twitter.com", "fxtwitter.com");
            await message.reply({
                content: `${replacement}`,
                allowedMentions: { repliedUser: false }
            });
            await message.delete().catch(err => {
                if (err.code !== 10008) console.error('Delete failed:', err);
            });
        } catch (error) {
            console.error("X-fixer Error:", error);
        }
    }

    if (message.content.includes("instagram.com")) {
        if (message.author.id === client.user.id) return;
        try {
            const replacement = message.content.replace("instagram.com", "eeinstagram.com");
            await message.reply({
                content: `${replacement}`,
                allowedMentions: { repliedUser: false }
            });
            await message.delete().catch(err => {
                if (err.code !== 10008) console.error('Delete failed:', err);
            });
        } catch (error) {
            console.error("Link Conversion Error:", error);
        }
    }

    if (message.content.includes("reddit.com")) {
        if (message.author.bot) return;
        try {
            const replacement = message.content.replace("reddit.com", "rxddit.com");
            await message.reply({
                content: `${replacement}`,
                allowedMentions: { repliedUser: false } 
            });
            await message.delete().catch(err => {
                if (err.code !== 10008) console.error('Delete failed:', err);
            });
        } catch (error) {
            console.error("Reddit-fixer Error:", error);
        }
    }

    if (message.content.includes("facebook.com")) {
        if (message.author.bot) return;
        try {
            const replacement = message.content.replace("facebook.com", "facebed.com");
            await message.reply({
                content: `${replacement}`,
                allowedMentions: { repliedUser: false } 
            });
            await message.delete().catch(err => {
                if (err.code !== 10008) console.error('Delete failed:', err);
            });
        } catch (error) {
            console.error("Facebook-fixer Error:", error);
        }
    }

});
