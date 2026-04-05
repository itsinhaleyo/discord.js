require('dotenv').config();
const { REST, Routes, ActionRowBuilder, MessageFlags, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle, ComponentType, ActivityType, ApplicationCommandOptionType, Client, GatewayIntentBits, IntentsBitField, EmbedBuilder, AttachmentBuilder, Events } = require('discord.js'),
      { VoiceConnectionStatus, joinVoiceChannel, createAudioPlayer, createAudioResource, getVoiceConnection, StreamType, AudioPlayerStatus, NoSubscriberBehavior } = require('@discordjs/voice'),
      { LeaderboardBuilder, RankCardBuilder, Font } = require('canvacord'), express = require('express'), session = require('express-session'), MySQLStore = require('express-mysql-session')(session),
      { GoogleGenAI } = require("@google/genai"), axios = require('axios'), passport = require('passport'), DiscordStrategy = require('passport-discord').Strategy,
      { getData, getTracks } = require('spotify-url-info')(require('isomorphic-unfetch')),
      { MusicCard } = require("./handlers/MusicCard.js"), { BalanceCard } = require("./handlers/BalanceCard.js"),
      fs = require('fs'), path = require('path'), util = require('util'),
      ytdl = require('youtube-dl-exec'), eventHandler = require('./handlers/eventHandler'),
      songsDir = path.join(__dirname, 'songs'), torrentDir = path.join(__dirname, 'torrents');
Font.loadDefault();
const priceCache = {};

//Audio Player
const musictimers = new Map(), musicqueues = new Map();

async function createMusicCardImage(song, serverQueue, totalMs) {
    const progress = Math.min(Math.round((serverQueue.currentTimestamp / totalMs) * 100), 100);
    const card = new MusicCard()
        .setAuthor(song.author)
        .setTitle(song.displayTitle || song.title)
        .setImage(song.thumbnail)
        .setProgress(progress)
        .setCurrentTime(formatTime(serverQueue.currentTimestamp))
        .setTotalTime(formatTime(totalMs));
    const buffer = await card.build();
    return new AttachmentBuilder(buffer, { name: `card.png` });
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
        const totalMs = (output.duration || song.duration || 0) * 1000;
        let thumb = output.thumbnail || (output.thumbnails && output.thumbnails[0]?.url) || song.thumbnail;
        if (thumb && typeof thumb === 'string') {
            thumb = thumb.replace(/\.webp($|\?)/, '.jpg$1');
            if (thumb.includes('?')) {
                thumb = thumb.split('?')[0];
            }
        }
        song.thumbnail = thumb || "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";
        const videoAuthor = output.uploader || output.channel || output.artist || song.author || "Unknown Artist";
        song.author = videoAuthor;
        const attachment = await createMusicCardImage(song, serverQueue, totalMs);
        const generateEmbed = (attachment) => {
            const start = 1 + (serverQueue.page * 5);
            const upcoming = serverQueue.songs.slice(start, start + 5);
            const queueList = upcoming.length > 0 
                ? upcoming.map((s, i) => `\`${start + i}.\` ${s.title}`).join('\n') 
                : "No more songs in queue.";
            return new EmbedBuilder()
                .setImage('attachment://card.png') 
                .addFields(
                    { name: 'Queue Size', value: `\`${serverQueue.songs.length} songs\``, inline: true },
                    { name: 'Volume', value: `\`${Math.round((serverQueue.player.state.resource?.volume?.volume || 1) * 100)}%\``, inline: true },
                    { name: `Upcoming (Page ${serverQueue.page + 1}):`, value: queueList }
                )
                .setColor("#9333EA");
        };
        const embed = generateEmbed(attachment);
        const musicRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('pause_resume').setLabel('⏸️/▶️').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('skip_song').setLabel('Skip⏭️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('stop_music').setLabel('🛑').setStyle(ButtonStyle.Danger),
        );
        const navRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('prev_page').setLabel('⬅️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('next_page').setLabel('➡️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('vol_up').setLabel('🔊⬆️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('vol_down').setLabel('🔉⬇️').setStyle(ButtonStyle.Secondary),
        );
        const sentMessage = await serverQueue.textChannel.send({ embeds: [embed], files: [attachment], components: [musicRow, navRow] });
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
                if (serverQueue.currentTimestamp % 10000 === 0 && serverQueue.lastMessage) {
                const newAttachment = await createMusicCardImage(song, serverQueue, totalMs);
                const newEmbed = generateEmbed(newAttachment);
                await serverQueue.lastMessage.edit({ 
                    embeds: [newEmbed], 
                    files: [newAttachment] 
                }).catch(() => {});
            }
            } else { 
                clearInterval(timer); 
            }
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
function formatTime(ms) { const totalSeconds = Math.floor(ms / 1000); const minutes = Math.floor(totalSeconds / 60); const seconds = totalSeconds % 60; return `${minutes}:${seconds.toString().padStart(2, '0')}`;}

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
function getRandomNumber(x, y) { const range = y - x + 1; const randomNumber = Math.floor(Math.random() * range); return randomNumber + x;}

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
const diceChances = Array.from({ length: 19 }, (_, i) => ({ name: `${(i + 1) * 5}% Chance`, value: i + 1 }));

// Roulette Command
const blackNumbers = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35], redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const mapToChoice = (num) => ({ name: `${num}`, value: num });

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

// Slash Commands Name and Descriptions
const commands = [
    { name: 'help', description: 'Help Command' },
    { name: 'claim', description: '60% chance to Collect 1-1000 every Minute' },
    { name: 'daily', description: 'Collect 25000 Daily' },
    { name: 'ping', description: 'Replies With the Bots Ping' },
    { name: 'queue', description: 'Displays the current music queue' },
    { 
        name: 'test', 
        description: 'Test Functtion',
        options: [
            {
                name: 'symbol',
                description: `the stock symbol`,
                type: ApplicationCommandOptionType.String,
                required: true
            }
        ]
    },
    { 
        name: 'say', 
        description: `Makes ${process.env.BOTUSER} Say Something`,
        options: [
            {
                name: 'response',
                description: `The Response ${process.env.BOTUSER} Will Say`,
                type: ApplicationCommandOptionType.String,
                required: true
            }
        ]
    },
    { 
        name: 'torrent', 
        description: `Downloads a Torrent File`,
        options: [
            {
                name: 'magnet',
                description: `the magnet link`,
                type: ApplicationCommandOptionType.String,
                required: true
            }
        ]
    },
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
                name: 'assets',
                description: 'Top 10 asset holders',
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

// Connect to Database, Connect to Google Gemini, Registering Slash Commands, Logging in the Bot
let db, ai, tor;
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
        // Setting up Webtorrent
        const { default: WebTorrent } = await import('webtorrent');
        tor = new WebTorrent();
        console.log("WebTorrent initialized.");
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
    if (interaction.commandName === "high") { if (!interaction.inGuild()) { return interaction.reply({ content: 'You can only run this command inside a server.', flags: [MessageFlags.Ephemeral],}); } await runHiLow(interaction, 'high');}
    if (interaction.commandName === "low") { if (!interaction.inGuild()) { return interaction.reply({ content: 'You can only run this command inside a server.', flags: [MessageFlags.Ephemeral],}); } await runHiLow(interaction, 'low')}
    if (interaction.commandName === 'rock') { if (!interaction.inGuild()) { return interaction.reply({ content: 'You can only run this command inside a server.', flags: [MessageFlags.Ephemeral],}); } await runRPS(interaction, 'rock')}
    if (interaction.commandName === 'paper') { if (!interaction.inGuild()) { return interaction.reply({ content: 'You can only run this command inside a server.', flags: [MessageFlags.Ephemeral],}); } await runRPS(interaction, 'paper')}
    if (interaction.commandName === 'scissors') { if (!interaction.inGuild()) { return interaction.reply({ content: 'You can only run this command inside a server.', flags: [MessageFlags.Ephemeral],}); } await runRPS(interaction, 'scissors')}

    if (interaction.commandName === 'help') {
        if (!interaction.inGuild()) { return interaction.reply({ content: 'You can only run this command inside a server.', flags: [MessageFlags.Ephemeral],}); } 
        const embed = new EmbedBuilder()
            .setTitle('Commands List')
            .setColor('Blue')
            .setDescription(
                "### 🛠️ Utility\n" +
                "`/ping - Replies with the bot's latency`\n" +
                "`/level - Shows your server level`\n" +
                "`/leaderboard - Shows Rankings`\n"+
                "`/ai - Generate a response from Gemini`\n" +
                "### 🎵 Music\n"+
                "`/play - Play a Song/Playlist from a Youtube or Spotify Link`\n"+
                "`/queue - View Current Music Queue`\n"+
                "### 💰 Economy\n" +
                "`/balance` • `/give` • `/daily`\n" +
                "`/claim`\n" +
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
        const reply = await interaction.fetchReply(), ping = reply.createdTimestamp - interaction.createdTimestamp;
        interaction.editReply(`Client ${ping}ms | Websocket: ${client.ws.ping}ms`);
    }

    if (interaction.commandName === 'balance') {
        try {
            await interaction.deferReply();
            const targetUser = interaction.options.getUser('user') || interaction.user;
            let user = await getuser(targetUser.id);
            const [holdings] = await db.query('SELECT symbol, shares FROM portfolios WHERE userid = ?', [targetUser.id]);
            let totalAssetValue = 0;
            if (holdings.length > 0) {
                const coinIds = holdings.map(h => h.symbol.toLowerCase()).join(',');
                const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
                    params: {
                        ids: coinIds,
                        vs_currencies: 'usd'
                    },
                    headers: { 'x-cg-demo-api-key': process.env.CG_API_KEY }
                });
                for (const stock of holdings) {
                    const currentPrice = response.data[stock.symbol.toLowerCase()]?.usd || 0;
                    totalAssetValue += (currentPrice * stock.shares);
                }
            }
            const card = new BalanceCard()
                .setUsername(targetUser.username)
                .setAvatar(targetUser.displayAvatarURL({ extension: 'png', size: 256 }))
                .setBalance(user.balance.toLocaleString())
                .setAssetValue(Math.round(totalAssetValue).toLocaleString());
            const image = await card.build();
            const attachment = new AttachmentBuilder(image, { name: 'balance.png' });
            await interaction.editReply({ files: [attachment] });
        } catch (error) {
            console.error("Balance Error: ", error);
            await interaction.editReply("Could not retrieve balance image.");
        }
    }

    if (interaction.commandName === "give") {
        if (!interaction.inGuild()) { return interaction.reply({ content: 'You can only run this command inside a server.', flags: [MessageFlags.Ephemeral],}); } 
        try {
            await interaction.deferReply();
            const amount = interaction.options.getNumber('amount');
            const targetUser = interaction.options.getUser('user');
            if (targetUser.id === interaction.member.id) return interaction.editReply("You can't give money to yourself!");
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
        if (!interaction.inGuild()) { return interaction.reply({ content: 'You can only run this command inside a server.', flags: [MessageFlags.Ephemeral],}); } 
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
            const file = new AttachmentBuilder(imagePath);
            const win = sideChosen === flipResult;
            const payout = win ? bet : -bet;
            const newBalance = Number(user.balance) + payout;
            await db.query('UPDATE users SET balance = ? WHERE userid = ?', [newBalance, interaction.member.id]);
            const embed = new EmbedBuilder()
                .setTitle(win ? '🪙 You Won!' : '🪙 You Lost!')
                .setColor(win ? 'Green' : 'Red')
                .setThumbnail(`${process.env.DOMAIN}/images/${flipResult}.png`) 
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

    if (interaction.commandName === 'claim') {
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
        if (!interaction.inGuild()) { return interaction.reply({ content: 'You can only run this command inside a server.', flags: [MessageFlags.Ephemeral],}); } 
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
        if (!interaction.inGuild()) return interaction.reply({ content: 'Server only.', flags: [MessageFlags.Ephemeral] });
        try {
            await interaction.deferReply();
            const subcommand = interaction.options.getSubcommand();
            let players = [];
            if (subcommand === 'assets') {
                const [allHoldings] = await db.query("SELECT userid, symbol, shares FROM portfolios WHERE shares > 0");
                if (allHoldings.length === 0) return interaction.editReply("No one owns any stocks yet!");
                const uniqueSymbols = [...new Set(allHoldings.map(h => h.symbol.toLowerCase()))].join(',');
                const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
                    params: { ids: uniqueSymbols, vs_currencies: 'usd' },
                    headers: { 'x-cg-demo-api-key': process.env.CG_API_KEY }
                });
                const prices = response.data;
                const userTotals = {};
                allHoldings.forEach(h => {
                    const price = prices[h.symbol.toLowerCase()]?.usd || 0;
                    userTotals[h.userid] = (userTotals[h.userid] || 0) + (price * h.shares);
                });
                const sortedUsers = Object.entries(userTotals)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 10);
                players = await Promise.all(sortedUsers.map(async ([userid, total], index) => {
                    const fetchedUser = await interaction.client.users.fetch(userid).catch(() => ({ username: "Unknown" }));
                    return {
                        avatar: fetchedUser.displayAvatarURL ? fetchedUser.displayAvatarURL({ extension: "png" }) : "",
                        username: fetchedUser.username,
                        xp: Math.round(total),
                        rank: index + 1,
                    };
                }));
            } else {
                const query = subcommand === 'money' 
                    ? "SELECT userid, balance, level FROM users ORDER BY balance DESC LIMIT 10"
                    : "SELECT userid, level, xp FROM users ORDER BY level DESC, xp DESC LIMIT 10";
                const [allUsers] = await db.query(query);
                if (allUsers.length === 0) return interaction.editReply("No data found.");
                players = await Promise.all(allUsers.map(async (u, index) => {
                    let fetchedUser;
                    try { fetchedUser = await interaction.client.users.fetch(u.userid); } catch { fetchedUser = { username: "Unknown", displayAvatarURL: () => "" }; }
                    return {
                        avatar: fetchedUser.displayAvatarURL ? fetchedUser.displayAvatarURL({ extension: "png", size: 128 }) : "",
                        username: fetchedUser.username,
                        displayName: fetchedUser.displayName || fetchedUser.username,
                        level: subcommand === 'money' ? null : Number(u.level),
                        xp: subcommand === 'money' ? Number(u.balance) : Number(u.xp),
                        rank: index + 1,
                    };
                }));
            }
            const lb = new LeaderboardBuilder()
                .setPlayers(players)
                .setVariant("default")
                .setTextStyles({
                    xp: subcommand === 'assets' ? "" : (subcommand === 'money' ? "" : "XP"),
                    level: subcommand === 'assets' || subcommand === 'money' ? "" : "Level"
                });
            const image = await lb.build({ format: "png" });
            const attachment = new AttachmentBuilder(image, { name: 'leaderboard.png' });
            await interaction.editReply({ files: [attachment] });
        } catch (error) {
            console.error(`Leaderboard Error: ${error}`);
            if (!interaction.replied) interaction.editReply("Failed to load the leaderboard image.");
        }
    }

    if (interaction.commandName === "roulette") {
        if (!interaction.inGuild()) { return interaction.reply({ content: 'You can only run this command inside a server.', flags: [MessageFlags.Ephemeral],}); } 
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
        if (!interaction.inGuild()) { return interaction.reply({ content: 'You can only run this command inside a server.', flags: [MessageFlags.Ephemeral],}); } 
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
        if (!interaction.inGuild()) { return interaction.reply({ content: 'You can only run this command inside a server.', flags: [MessageFlags.Ephemeral],}); } 
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
        if (!interaction.inGuild()) { return interaction.reply({ content: 'You can only run this command inside a server.', flags: [MessageFlags.Ephemeral],}); } 
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
        if (!interaction.inGuild()) { return interaction.reply({ content: 'You can only run this command inside a server.', flags: [MessageFlags.Ephemeral],}); } 
        await interaction.deferReply();
        let user = await getuser(interaction.member.id);
        const bet = interaction.options.getNumber('bet-amount');
        if (!bet || bet < 1) return interaction.editReply("Enter a valid bet.");
        if (Number(user.balance) < bet) return interaction.editReply(`Low balance: ${user.balance}💵`);
        await db.query("UPDATE users SET balance = balance - ? WHERE userid = ?", [bet, interaction.member.id]);
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
            await db.query("UPDATE users SET balance = balance + ? WHERE userid = ?", [bjPayout, interaction.member.id]);
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
        const filter = (reaction, user) => ['👊', '✋'].includes(reaction.emoji.name) && user.id === interaction.member.id;
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
                await db.query("UPDATE users SET balance = balance + ? WHERE userid = ?", [payout, interaction.member.id]);
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
        if (!interaction.inGuild()) { return interaction.reply({ content: 'You can only run this command inside a server.', flags: [MessageFlags.Ephemeral],}); } 
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
        if (!interaction.inGuild()) { return interaction.reply({ content: 'You can only run this command inside a server.', flags: [MessageFlags.Ephemeral],}); } 
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
        if (!interaction.inGuild()) { return interaction.reply({ content: 'You can only run this command inside a server.', flags: [MessageFlags.Ephemeral],}); } 
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
        if (!interaction.inGuild()) { return interaction.reply({ content: 'You can only run this command inside a server.', flags: [MessageFlags.Ephemeral],}); } 
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
        if (!interaction.inGuild()) { return interaction.reply({ content: 'You can only run this command inside a server.', flags: [MessageFlags.Ephemeral],}); } 
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
        if (!interaction.inGuild()) { return interaction.reply({ content: 'You can only run this command inside a server.', flags: [MessageFlags.Ephemeral],}); } 
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
        if (!interaction.inGuild()) { return interaction.reply({ content: 'You can only run this command inside a server.', flags: [MessageFlags.Ephemeral],}); } 
        const serverQueue = musicqueues.get(interaction.guildId);
        if (!serverQueue || serverQueue.songs.length === 0) { return interaction.reply({ content: "The queue is currently empty.", flags: [MessageFlags.Ephemeral] }); }
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
        if (interaction.member.id !== process.env.DEV_ID) { return interaction.reply('Only my bot DEV can use this command'); }
        if (!interaction.inGuild()) { return interaction.reply({ content: 'You can only run this command inside a server.', flags: [MessageFlags.Ephemeral],}); } 
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
    
    if (interaction.commandName === "torrent") {
        if (interaction.member.id !== process.env.DEV_ID) { return interaction.reply('Only my bot DEV can use this command'); }
        if (!interaction.inGuild()) { return interaction.reply({ content: 'You can only run this command inside a server.', flags: [MessageFlags.Ephemeral],}); } 
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        try {
            const magnet = interaction.options.getString('magnet');
            tor.add(magnet, { path: torrentDir }, (torrent) => {
                const progressInterval = setInterval(async () => {
                    const progress = (torrent.progress * 100).toFixed(1);
                    const downloadSpeed = (torrent.downloadSpeed / 1024 / 1024).toFixed(2);
                    await interaction.editReply({ content: `⏳ Downloading: **${torrent.name}**\n` + `Progress: \`${progress}%\` | Speed: \`${downloadSpeed} MB/s\` | Peers: \`${torrent.numPeers}\``} ).catch(() => {});
                }, 5000);
                torrent.on('done', async () => {
                    clearInterval(progressInterval);
                    await interaction.editReply(`✅ Downloaded: **${torrent.name}**`);
                });
                torrent.on('error', async (err) => {
                    clearInterval(progressInterval);
                    await interaction.editReply(`❌ Torrent Error: ${err.message}`);
                });
            });
        } catch(error) {
            console.error(error);
            await interaction.editReply(`Error:\n\`\`\`${error.message}\`\`\``);
        }
    }

    if (interaction.commandName === "say") {
        if (interaction.member.id !== process.env.DEV_ID) { return interaction.reply('Only my bot DEV can use this command'); }
        if (!interaction.inGuild()) { return interaction.reply({ content: 'You can only run this command inside a server.', flags: [MessageFlags.Ephemeral],}); } 
        try {
            await interaction.deferReply();
            try {
                const response = interaction.options.getString('resp');
                await interaction.editReply(response);
            } catch(error) {
                console.error(error);
                await interaction.editReply(`Error:\n\`\`\`${error.message}\`\`\``);
            }
        } catch(error) {
            interaction.reply(`Please try the Command Again\n`+error);
            console.log(error);
        }
    }

    if (interaction.commandName === "test") {
        if (interaction.member.id !== process.env.DEV_ID) { return interaction.reply('Only my bot DEV can use this command'); }
        if (!interaction.inGuild()) { return interaction.reply({ content: 'You can only run this command inside a server.', flags: [MessageFlags.Ephemeral],}); }
        try {
            await interaction.deferReply();
            const symbol = interaction.options.getString('symbol');
            let data = await getCryptoData(symbol);
            const response = data 
                ? `Stock data for ${symbol}: \`\`\`json\n${JSON.stringify(data[0], null, 2)}\`\`\``
                : "No data found.";
            await interaction.editReply(response);
        } catch(error) {
            const errorMsg = error?.message || "An unknown error occurred";
            await interaction.editReply(`Error:\n\`\`\`${errorMsg}\`\`\``);
            console.error("Full Error Object:", error);
        }
    }
});

// Messages Without Slash Commands
client.on('messageCreate', async (message) => {
    if (message.author.username === process.env.BOT_USER) { return; }
    const date = new Date(message.createdTimestamp);
    const timestamp = date.toLocaleDateString('en-US', { hour: 'numeric', minute: 'numeric', second: 'numeric' });
    console.log(message.guild.id+" - "+timestamp+" - "+message.author.username+" - "+message.content);

    if (message.content === 'help') { message.reply({ content: 'Please use / commands.', flags: [MessageFlags.Ephemeral] }); }

    if (message.content.includes("x.com") || message.content.includes("twitter.com")) {
        if (message.author.bot) return;
        try {
            if (message.content.includes("fxtwitter.com")) return;
            let replacement = message.content.replace("x.com", "fixupx.com").replace("twitter.com", "fxtwitter.com");
            await message.reply({ content: `${replacement}`, allowedMentions: { repliedUser: false } });
            await message.delete().catch(err => { if (err.code !== 10008) console.error('Delete failed:', err); });
        } catch (error) { console.error("X-fixer Error:", error); }
    }

    if (message.content.includes("instagram.com")) {
        if (message.author.id === client.user.id) return;
        try {
            const replacement = message.content.replace("instagram.com", "eeinstagram.com");
            await message.reply({ content: `${replacement}`, allowedMentions: { repliedUser: false } });
            await message.delete().catch(err => { if (err.code !== 10008) console.error('Delete failed:', err); });
        } catch (error) { console.error("Instagram fixer Error:", error); }
    }

    if (message.content.includes("reddit.com")) {
        if (message.author.bot) return;
        try {
            const replacement = message.content.replace("reddit.com", "rxddit.com");
            await message.reply({ content: `${replacement}`, allowedMentions: { repliedUser: false } });
            await message.delete().catch(err => { if (err.code !== 10008) console.error('Delete failed:', err); });
        } catch (error) { console.error("Reddit Fixer Error:", error); }
    }

    if (message.content.includes("facebook.com")) {
        if (message.author.bot) return;
        try {
            const replacement = message.content.replace("facebook.com", "facebed.com");
            await message.reply({ content: `${replacement}`, allowedMentions: { repliedUser: false } });
            await message.delete().catch(err => { if (err.code !== 10008) console.error('Delete failed:', err); });
        } catch (error) { console.error("Facebook fixer Error:", error); }
    }

});

// Website Coding
const web = express();
web.use(express.urlencoded({ extended: false }));
web.use(express.json());
web.use(express.static(path.join(__dirname, 'public')));
const port = process.env.PORT;
const sessionStore = new MySQLStore({}, db);
web.set('trust proxy', 1);
web.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    proxy: true,
    cookie: { 
        maxAge: 1000 * 60 * 60 * 24,
        secure: true
    }
}));
web.use(passport.initialize());
web.use(passport.session());
passport.use(new DiscordStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: `${process.env.DOMAIN}/auth/discord/callback`,
    scope: ['identify', 'email'],
    proxy: true
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE userid = ?', [profile.id]);
        let user = rows[0];
        if (!user) {
            await db.query(
                `INSERT INTO users (userid, balance, daily, xp, level, username, avatar) 
                 VALUES (?, 0, '0', 1, 1, ?, ?, ?)`,
                [profile.id, profile.username, profile.avatar]
            );
            const [newRows] = await db.query('SELECT * FROM users WHERE userid = ?', [profile.id]);
            user = newRows[0];
        } else {
            await db.query(
                'UPDATE users SET username = ?, avatar = ? WHERE userid = ?',
                [profile.username, profile.avatar, profile.id]
            );
            user.username = profile.username;
            user.avatar = profile.avatar;
        }
        return done(null, user);
    } catch (err) {
        return done(err);
    }
}));
passport.serializeUser((user, done) => { done(null, user.userid); });
passport.deserializeUser(async (id, done) => {
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE userid = ?', [id]);
        const user = rows[0];
        if (!user) { return done(null, false); }
        done(null, user);
    } catch (err) {
        done(err);
    }
});

const getAvatar = (id, hash) => { return `https://cdn.discordapp.com/avatars/${id}/${hash}.png`;};

web.post('/login', passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login'
}));

web.post('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) { return next(err); }
        res.redirect('/login');
    });
});

const checkAuth = (req, res, next) => req.isAuthenticated() ? next() : res.redirect('/login');

web.post('/claim-daily', checkAuth, async (req, res) => {
    try {
        const currentDate = new Date().toDateString();
        const dailyAmount = 25000;
        const [rows] = await db.query('SELECT * FROM users WHERE userid = ?', [req.user.userid]);
        const user = rows[0];
        if (user.daily === currentDate) { return res.json({ success: false, message: "You've already collected your reward today!" }); }
        const newBalance = Number(user.balance) + dailyAmount;
        await db.query('UPDATE users SET balance = ?, daily = ? WHERE userid = ?', [newBalance, currentDate, req.user.userid]);
        res.json({ 
            success: true, 
            message: `Successfully claimed 💰 ${dailyAmount.toLocaleString()}!`,
            newBalance: newBalance.toLocaleString() 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error occurred." });
    }
});

web.get('/', async (req, res) => {
    try {
        const [[{ count: userCount }]] = await db.query('SELECT COUNT(*) as count FROM users');
        const serverCount = client.guilds.cache.size || 0;
        let html = fs.readFileSync(path.join(__dirname, 'public', 'home.html'), 'utf8');
        if (req.isAuthenticated()) {
            const user = req.user;
            const currentDate = new Date().toDateString();
            const hasClaimed = (user.daily === currentDate);
            const now = new Date();
            const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            const msUntilMidnight = midnight - now;
            html = html.replace('{{hasClaimed}}', hasClaimed)
                       .replace('{{msUntilMidnight}}', msUntilMidnight)
                       .replace('{{balance}}', (user.balance || 0).toLocaleString())
                       .replace('{{level}}', user.level || 1);
            html = html.replaceAll('{{avatarurl}}', getAvatar(user.userid, user.avatar));
        } else {
            html = html.replace('{{hasClaimed}}', 'false')
                       .replace('{{msUntilMidnight}}', '0')
                       .replace('{{balance}}', '0')
                       .replace('{{level}}', '1');
            const loginToClaim = `<a href="/auth/discord" class="btn-discord" style="text-align:center;">Login to Claim Daily</a>`;
            html = html.replace('<button onclick="claimDaily()" id="daily-btn"', '<!--')
                       .replace('Claim Daily 💰 25,000\n        </button>', '--> ' + loginToClaim);
        }
        html = html.replace('{{userCount}}', userCount.toLocaleString())
                   .replace('{{serverCount}}', serverCount.toLocaleString());
        res.send(html);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error loading home");
    }
});

web.get('/profile', checkAuth, async (req, res) => {
    try {
        const user = req.user;
        let html = fs.readFileSync(path.join(__dirname, 'public', 'profile.html'), 'utf8');
        html = html.replace('User', user.username || 'Member')
                   .replace('{{balance}}', user.balance.toLocaleString())
                   .replace('{{level}}', user.level)
                   .replaceAll('{{avatarurl}}', getAvatar(user.userid, user.avatar));
        res.send(html);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error loading home");
    }
});

web.get('/portfolio', checkAuth, async (req, res) => {
    try {
        const user = req.user;
        const [holdings] = await db.query( 'SELECT * FROM portfolios WHERE userid = ?', [user.userid] );
        let totalValue = 0;
        let totalCostBasis = 0;
        const list = await Promise.all(holdings.map(async (stock) => {
            let currentPrice = await getContract(stock.network, stock.contract);
            if (!currentPrice || currentPrice === 0) { currentPrice = Number(stock.average_price); }
            const costBasis = Number(stock.average_price) * Number(stock.shares);
            const currentValue = currentPrice * Number(stock.shares);
            totalCostBasis += costBasis;
            totalValue += currentValue;
            const pnl = currentValue - costBasis;
            const pnlPercent = costBasis > 0 ? ((pnl / costBasis) * 100).toFixed(2) : "0.00";
            return {
                symbol: stock.symbol.toUpperCase(),
                shares: stock.shares,
                pnl,
                pnlPercent,
                isUp: pnl >= 0
            };
        }));
        const totalPnlAmount = totalValue - totalCostBasis;
        const totalPnlPercent = totalCostBasis > 0 ? ((totalPnlAmount / totalCostBasis) * 100).toFixed(2) : "0.00";
        const pnlColor = totalPnlAmount >= 0 ? '#10b981' : '#ef4444';
        const pnlSign = totalPnlAmount >= 0 ? '+' : '';
        const tableRows = list.map((item, index) => {
            const stock = holdings[index]; 
            const itemSign = item.pnl >= 0 ? '+' : '';
            return `
                <tr class="portfolio-row" 
                    data-network="${stock.network}" 
                    data-contract="${stock.contract}" 
                    data-shares="${stock.shares}" 
                    data-entry="${stock.average_price}">
                    <td>${item.symbol}</td>
                    <td>${Number(item.shares).toLocaleString()}</td>
                    <td class="pnl-cell" style="color: ${item.pnl >= 0 ? '#10b981' : '#ef4444'}">
                        ${itemSign}💰${Math.round(item.pnl).toLocaleString()}
                        <div class="pnl-percent" style="font-size: 0.7rem; opacity: 0.8;">(${item.pnlPercent}%)</div>
                    </td>
                </tr>
            `;
        }).join('');
        let html = fs.readFileSync(path.join(__dirname, 'public', 'portfolio.html'), 'utf8');
        html = html.replace('{{rows}}', tableRows || '<tr><td colspan="3">No holdings found</td></tr>')
                   .replace('{{cash}}', Number(user.balance).toLocaleString())
                   .replace('{{assetValue}}', Math.round(totalValue).toLocaleString())
                   .replace('{{totalPnl}}', `<span style="color: ${pnlColor}">${pnlSign}${Math.round(totalPnlAmount).toLocaleString()} (${totalPnlPercent}%)</span>`)
                   .replaceAll('{{avatarurl}}', getAvatar(user.userid, user.avatar));
        res.send(html);
    } catch (err) {
        console.error("Portfolio Error:", err);
        res.status(500).send("Portfolio Error\n" + err.message);
    }
});

web.get('/casino', checkAuth, (req, res) => {
    try {
        const games = [
            { name: "Plinko", symbol: "plinko", icon: `${process.env.DOMAIN}/games/plinko/favicon.ico` },
        ];
        let html = fs.readFileSync(path.join(__dirname, 'public', 'casino.html'), 'utf8');
        const marketButtons = games.map(game => `
            <div class="market-card" onclick="location.href='/casino/${game.symbol.toLowerCase()}'">
                <div class="market-icon">
                    <img src="${game.icon}" style="width: 32px; height: 32px; object-fit: contain;">
                </div>
                <div class="market-info">
                    <h3>${game.name}</h3>
                </div>
                <div class="market-arrow">➜</div>
            </div>
        `).join('');
        html = html.replace('{{marketButtons}}', marketButtons)
                   .replaceAll('{{avatarurl}}', getAvatar(req.user.userid, req.user.avatar));
        res.send(html);
    } catch (err) {
        res.status(500).send("Trading Hub Error: " + err.message);
    }
});

web.get('/casino/plinko', checkAuth, (req, res) => {
    try {
        let html = fs.readFileSync(path.join(__dirname, 'public', 'plinko.html'), 'utf8');
        html = html.replaceAll('{{userid}}', req.user.userid)
                   .replaceAll('{{avatarurl}}', getAvatar(req.user.userid, req.user.avatar));
        res.send(html);
    } catch (err) {
        res.status(500).send("Plinko Error: " + err.message);
    }
});

web.post('/callback/init', checkAuth, async (req, res, next) => {
    const [[user]] = await db.query(`SELECT * FROM users WHERE userid = ?`, [req.user.userid]);
    res.json({ Balance: user.balance });
});

web.post('/callback/playercheck', async (req, res, next) => {
    const user = await db.query(`SELECT * FROM playercheck WHERE userid = ?`, [req.body.userid]);
    const nonce = getnonce();
    if (!user) { await db.query(`INSERT INTO playercheck (userid, nonce) VALUES (?, ?)`, [req.body.userid, nonce]); }
    await db.query(`UPDATE playercheck SET nonce = ? WHERE userid = ?`, [nonce, req.body.userid]);
    res.json({ Data: nonce });
});

web.post('/callback/plinko/win', async (req, res, next) => {
    const user = await db.query(`SELECT * FROM playercheck WHERE userid = ?`, [req.body.userid]);
    const nonce = await db.query('SELECT * FROM nonce WHERE userid = ?', [req.body.userid]);
    if (req.body.nonce !== nonce.nonce) { return res.status(400).json({ message: "Invalid nonce" }); }
    db.query(`UPDATE users SET balance = balance + ? WHERE userid = ?`, [req.body.win, req.body.userid]);
    res.json({ Data: newNonce });
});

web.get('/casino/slots', checkAuth, (req, res) => {
    try {
        let html = fs.readFileSync(path.join(__dirname, 'public', 'game.html'), 'utf8');
        res.send(html);
    } catch (err) {
        res.status(500).send("Slots Error: " + err.message);
    }
});

web.get('/trading', checkAuth, (req, res) => {
    try {
        const markets = [
            { name: "Bitcoin", symbol: "btc", icon: `${process.env.DOMAIN}/images/btcicon.png` },
            { name: "Ethereum", symbol: "eth", icon: `${process.env.DOMAIN}/images/ethicon.png` },
            { name: "Ethereum Classic", symbol: "etc", icon: `${process.env.DOMAIN}/images/etcicon.png` },
            { name: "Solana", symbol: "sol", icon: `${process.env.DOMAIN}/images/solicon.png` },
            { name: "Zcash", symbol: "zec", icon: `${process.env.DOMAIN}/images/zecicon.png` },
            { name: "Dogecoin", symbol: "doge", icon: `${process.env.DOMAIN}/images/dogeicon.png` },
            { name: "Tron", symbol: "trx", icon: `${process.env.DOMAIN}/images/trxicon.png` },
            { name: "Cardano", symbol: "ada", icon: `${process.env.DOMAIN}/images/adaicon.png` },
            { name: "Litecoin", symbol: "ltc", icon: `${process.env.DOMAIN}/images/ltcicon.png` },
            { name: "Wrapped BNB", symbol: "wbnb", icon: `${process.env.DOMAIN}/images/wbnbicon.png` },
            { name: "Avalanche", symbol: "avax", icon: `${process.env.DOMAIN}/images/avaxicon.png` },
            { name: "Chainlink", symbol: "link", icon: `${process.env.DOMAIN}/images/linkicon.png` },
            { name: "Uniswap", symbol: "uni", icon: `${process.env.DOMAIN}/images/uniicon.png` },
            { name: "Aave", symbol: "aave", icon: `${process.env.DOMAIN}/images/aaveicon.png` },
            { name: "Monero", symbol: "xmr", icon: `${process.env.DOMAIN}/images/xmricon.png` },
        ];
        let html = fs.readFileSync(path.join(__dirname, 'public', 'trading_hub.html'), 'utf8');
        const marketButtons = markets.map(coin => `
            <div class="market-card" onclick="location.href='/trading/${coin.symbol.toLowerCase()}'">
                <div class="market-icon">
                    <img src="${coin.icon}" style="width: 32px; height: 32px; object-fit: contain;">
                </div>
                <div class="market-info">
                    <h3>${coin.name}</h3>
                    <p>Trade ${coin.symbol.toUpperCase()}/USD</p>
                </div>
                <div class="market-arrow">➜</div>
            </div>
        `).join('');
        html = html.replace('{{marketButtons}}', marketButtons)
                   .replaceAll('{{avatarurl}}', getAvatar(req.user.userid, req.user.avatar));
        res.send(html);
    } catch (err) {
        res.status(500).send("Trading Hub Error: " + err.message);
    }
});

web.get('/trading/:symbol', checkAuth, async (req, res) => {
    try {
        const user = req.user;
        const requestedSymbol = req.params.symbol.toUpperCase();
        const coinConfig = {
            'BTC': { network: "avax", contract: "0x8fef4fe4970a5d6bfa7c65871a2ebfd0f42aa822" },
            'ETH': { network: "bsc",  contract: "0xd0e226f674bbf064f54ab47f42473ff80db98cba" },
            'ETC': { network: "solana", contract: "Sx3ec3k2tef4Gs2iaozgfx16jPMPBdcaWamePY3BZLp" },
            'SOL': { network: "base", contract: "0xb30540172f1b37d1ee1d109e49f883e935e69219" },
            'ZEC': { network: "near", contract: "refv1-6065" },
            'DOGE': { network: "bsc", contract: "0xce6160bb594fc055c943f59de92cee30b8c6b32c" },
            'TRX': { network: "solana", contract: "DNspJcdhQzaptzbRR2yx1QxbUJV5JdcqJL65xrkkxx9Y" },
            'ADA': { network: "bsc", contract: "0x29c5ba7dbb67a4af999a28cc380ad234fe7c1b86" },
            'LTC': { network: "bsc", contract: "0xe3cbe4dd1bd2f7101f17d586f44bab944091d383" },
            'WBNB': { network: "bsc", contract: "0x58f876857a02d6762e0101bb5c46a8c1ed44dc16" },
            'AVAX': { network: "avax", contract: "0xf01449c0ba930b6e2caca3def3ccbd7a3e589534" },
            'LINK': { network: "eth", contract: "0xa6cc3c2531fdaa6ae1a3ca84c2855806728693e8" },
            'UNI': { network: "eth", contract: "0x1d42064fc4beb5f8aaf85f4617ae8b3b5b8bd801" },
            'AAVE': { network: "eth", contract: "0x5ab53ee1d50eef2c1dd3d5402789cd27bb52c1bb" },
            'XMR': { network: "solana", contract: "CDJtzEhhd3K6Exv9ssw3ZafbmVwEDF6QhNGbYrShyTUc" },
        };
        const coin = coinConfig[requestedSymbol];
        if (!coin) return res.redirect('/trading');
        const contractAddress = `https://geckoterminal.com/${coin.network}/pools/${coin.contract}`;
        const [holding] = await db.query( 'SELECT shares FROM portfolios WHERE userid = ? AND symbol = ?', [user.userid, requestedSymbol] );
        const [allHoldings] = await db.query( 'SELECT * FROM portfolios WHERE userid = ?', [user.userid] );
        const userShares = holding.length > 0 ? holding[0].shares : 0;
        const positionRows = allHoldings.map(pos => {
            return `
            <tr class="position-row" data-symbol="${pos.symbol}" data-entry="${pos.average_price}" data-shares="${pos.shares}">
                <td style="padding: 15px 20px;">${pos.symbol.toUpperCase()}</td>
                <td>${Number(pos.shares).toLocaleString()}</td>
                <td>$${Number(pos.average_price).toLocaleString()}</td>
                <td>${pos.leverage}x</td>
                <td class="pos-pnl">Calculating...</td>
                <td style="text-align: right; padding-right: 20px;">
                    <button onclick="closePosition('${pos.symbol}', '${pos.network}', '${pos.contract}', ${pos.shares}, ${pos.leverage})" class="btn-close-pos">
                        Close
                    </button>
                </td>
            </tr>`;
        }).join('');
        let html = fs.readFileSync(path.join(__dirname, 'public', 'trading.html'), 'utf8');
        html = html.replace('{{positionRows}}', positionRows || '<tr><td colspan="6" style="text-align:center; padding:20px;">No open positions</td></tr>')
                   .replaceAll('{{balance}}', user.balance.toLocaleString())
                   .replaceAll('{{ownedshares}}', userShares.toLocaleString())
                   .replaceAll('{{contractlink}}', contractAddress)
                   .replaceAll('{{network}}', coin.network)
                   .replaceAll('{{contract}}', coin.contract)
                   .replaceAll('{{coinid}}', requestedSymbol)
                   .replaceAll('{{share}}', requestedSymbol)
                   .replaceAll('{{userid}}', user.userid)
                   .replaceAll('{{avatarurl}}', getAvatar(user.userid, user.avatar));
        res.send(html);
    } catch (err) {
        console.error("Trading Route Error:", err);
        res.status(500).send("Trading Error\n" + err.message);
    }
});

web.post('/trade/buy', checkAuth, async (req, res) => {
    try {
        const { coinId, network, contract, amount, leverage } = req.body;
        const amountToBuy = parseFloat(amount);
        const userid = req.user.userid;
        const price = await getContract(network, contract);
        const totalPositionValue = Math.round(price * amountToBuy);
        const marginRequired = Math.round(totalPositionValue / leverage);
        const [userRows] = await db.query('SELECT balance FROM users WHERE userid = ?', [userid]);
        const currentBalance = userRows[0].balance;
        if (currentBalance < marginRequired) {
            return res.json({ 
                success: false, 
                message: `Insufficient Margin! Required: 💰${marginRequired.toLocaleString()}` 
            });
        }
        if (leverage < 0 || leverage > 50) {
            return res.json({ 
                success: false, 
                message: `Invalid Leverage! Please choose a value between 1 and 50.` 
            });
        }
        await db.query('UPDATE users SET balance = balance - ? WHERE userid = ?', [marginRequired, userid]);
        await db.query(`
            INSERT INTO portfolios (userid, symbol, shares, average_price, network, contract, leverage, margin_used) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?) 
            ON DUPLICATE KEY UPDATE 
                average_price = (average_price * shares + VALUES(average_price) * VALUES(shares)) / (shares + VALUES(shares)),
                shares = shares + VALUES(shares),
                margin_used = margin_used + VALUES(margin_used)`, 
            [userid, coinId, amountToBuy, price, network, contract, leverage, marginRequired]
        );
        await db.query( 'INSERT INTO stock_logs (userid, symbol, action, amount, price_per_share, total_cost, leverage) VALUES (?, ?, ?, ?, ?, ?, ?)', [userid, coinId, 'BUY', amountToBuy, price, marginRequired, leverage] );
        res.json({ success: true, message: `Opened ${leverage}x position!`,  });
    } catch (err) {
        console.error("Web Trade Error:", err);
        res.status(500).json({ success: false, message: "A server error occurred during the trade." });
    }
});

web.post('/trade/sell', checkAuth, async (req, res) => {
    try {
        const { coinId, network, contract, amount, leverage } = req.body;
        const amountToSell = parseFloat(amount);
        const userid = req.user.userid;
        const [holdings] = await db.query(
            'SELECT shares, average_price, margin_used, leverage FROM portfolios WHERE userid = ? AND symbol = ?', 
            [userid, coinId]
        );
        if (holdings.length === 0 || holdings[0].shares < amountToSell) {
            return res.json({ success: false, message: "Not enough shares/position size!" });
        }
        const position = holdings[0];
        const currentPrice = await getContract(network, contract);
        if (!currentPrice) return res.json({ success: false, message: "Price fetch failed." });
        const marginRatio = amountToSell / position.shares;
        const marginToRelease = position.margin_used * marginRatio;
        const pnl = (currentPrice - position.average_price) * amountToSell;
        let totalReturn = Math.round(marginToRelease + pnl);
        if (totalReturn < 0) totalReturn = 0;
        await db.query('UPDATE users SET balance = balance + ? WHERE userid = ?', [totalReturn, userid]);
        if (position.shares === amountToSell) {
            await db.query('DELETE FROM portfolios WHERE userid = ? AND symbol = ?', [userid, coinId]);
        } else {
            await db.query(
                'UPDATE portfolios SET shares = shares - ?, margin_used = margin_used - ? WHERE userid = ? AND symbol = ?', 
                [amountToSell, marginToRelease, userid, coinId]
            );
        }
        await db.query('INSERT INTO stock_logs (userid, symbol, action, amount, price_per_share, total_cost, leverage) VALUES (?, ?, ?, ?, ?, ?, ?)', 
            [userid, coinId, 'SELL', amountToSell, currentPrice, totalReturn, leverage]);
        res.json({ 
            success: true, 
            message: `Closed position! Return: 💰${totalReturn.toLocaleString()} (PnL: ${pnl >= 0 ? '+' : ''}${Math.round(pnl).toLocaleString()})` 
        });
    } catch (err) {
        console.error("Sell Error:", err);
        res.status(500).json({ success: false, message: "Server error during sale." });
    }
});

web.get('/api/trade-history', checkAuth, async (req, res) => {
    const [logs] = await db.query(
        'SELECT * FROM stock_logs WHERE userid = ? ORDER BY timestamp DESC LIMIT 50', 
        [req.user.userid]
    );
    res.json(logs);
});

web.post('/callback/update/:network/:contract', async (req, res) => {
    const { network, contract } = req.params;
    try {
        const newprice = await getContract(network, contract);
        const leverage = await getPosition(req.user.userid, contract);
        const [userRows] = await db.query('SELECT balance FROM users WHERE userid = ?', [req.user.userid]);
        const currentBalance = userRows.length > 0 ? userRows[0].balance : 0;
        res.json({ 
            Price: newprice, 
            Balance: currentBalance,
            Shares: leverage.shares,
            Leverage: leverage.leverage,
            Margin_used: leverage.margin_used
        });
    } catch (err) {
        console.error("Update Route Error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

web.get('/leaderboard/money', checkAuth, (req, res) => handleLeaderboard(req, res, 'balance', 'Richest Users', req.user));
web.get('/leaderboard/rank', checkAuth, (req, res) => handleLeaderboard(req, res, 'level', 'User Rankings', req.user));

web.get('/auth/discord', (req, res, next) => {
    passport.authenticate('discord', (err) => {
        if (err) {
            console.log("INTERNAL PASSPORT REDIRECT ERROR:", err);
            return res.status(500).send("Passport Redirect Error: " + err.message);
        }
    })(req, res, next);
});

web.get('/auth/discord/callback', (req, res, next) => {
    return passport.authenticate('discord', {
        failureRedirect: '/login',
        successRedirect: '/'
    })(req, res, next);
});

web.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

web.use((req, res, next) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

web.use((err, req, res, next) => {
    console.error("DEBUG - Server Error:", err.stack);
    res.status(500).send("Something went wrong on our end!");
});

web.listen(port, () => { 
    console.log(`Website running at ${process.env.DOMAIN}:${port}/`); }
);

function renderLeaderboard(res, rows, title, userdata) {
    let html = fs.readFileSync(path.join(__dirname, 'public', 'leaderboard.html'), 'utf8');
    let tableRows = rows.map((user, index) => {
        const rank = index + 1;
        let medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
        const avatarUrl = `https://cdn.discordapp.com/avatars/${user.userid}/${user.avatar}.png`;
        return `<tr>
            <td style="text-align:center">${medal}</td>
            <td style="display:flex; align-items:center; gap:10px;"><img src="${avatarUrl}" style="width:30px; border-radius:50%"> ${user.username}</td>
            <td>💰 ${user.balance.toLocaleString()}</td>
            <td>⭐ ${user.level}</td>
        </tr>`;
    }).join('');
    html = html.replace('{{rows}}', tableRows)
        .replaceAll('{{LB-TYPE}}', title)
        .replaceAll('{{avatarurl}}', getAvatar(userdata.userid, userdata.avatar));;
    res.send(html);
}

async function handleLeaderboard(req, res, sortColumn, title, user) {
    try {
        const searchTerm = req.query.search || '';
        let query;
        let queryParams = [];
        if (searchTerm) {
            query = `
                SELECT userid, username, avatar, balance, level 
                FROM users 
                WHERE username LIKE ? 
                ORDER BY ${sortColumn} DESC 
                LIMIT 50
            `;
            queryParams = [`%${searchTerm}%`];
        } else {
            query = `SELECT userid, username, avatar, balance, level FROM users ORDER BY ${sortColumn} DESC LIMIT 10`;
        }
        const [rows] = await db.query(query, queryParams);
        renderLeaderboard(res, rows, title, user);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error");
    }
}

async function getContract(network, poolAddress) {
    const cacheKey = `${network}_${poolAddress}`.toLowerCase();
    const now = Date.now();
    if (priceCache[cacheKey] && (now - priceCache[cacheKey].timestamp < 15 * 1000)) { return priceCache[cacheKey].price; }
    try {
        const url = `https://api.geckoterminal.com/api/v2/networks/${network}/pools/${poolAddress}`;
        const response = await axios.get(url, {
            headers: { 'Accept': 'application/json;version=20230203' }
        });
        const price = parseFloat(response.data.data.attributes.base_token_price_usd);
        if (price) {
            priceCache[cacheKey] = {
                price: price,
                timestamp: now
            };
            return price;
        }
        return null;
    } catch (error) {
        console.error("GeckoTerminal API Error:", error.message);
        return priceCache[cacheKey] ? priceCache[cacheKey].price : null;
    }
}

function getnonce() {
    return Math.floor(Math.random() * (10000000000 - 999999999999) + 999999999999);
}

async function getPosition(userid, contract) {
    try {
        resp = await db.query(`SELECT * FROM portfolios WHERE userid = ? AND contract = ?`, [userid, contract]);
        if (!resp[0] || resp[0].length === 0) { return { leverage: 0, shares: 0, margin_used: 0 }; }
        return { leverage: resp[0][0].leverage || 0, shares: resp[0][0].shares || 0, margin_used: resp[0][0].margin_used || 0 };
    } catch (error) {
        console.error("Position Fetch Error:", error);
        throw error;
    }
}