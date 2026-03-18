// Required Imports
require('dotenv').config();
const { REST, Routes, ActionRowBuilder, MessageFlags, ButtonBuilder, ButtonStyle, ComponentType, ActivityType, ApplicationCommandOptionType, Client, GatewayIntentBits, IntentsBitField, EmbedBuilder, AttachmentBuilder, Events } = require('discord.js');
const { VoiceConnectionStatus, joinVoiceChannel, createAudioPlayer, createAudioResource, getVoiceConnection, StreamType, AudioPlayerStatus, NoSubscriberBehavior } = require('@discordjs/voice');
const eventHandler = require('./handlers/eventHandler');
const canvacord = require('canvacord');
const { GoogleGenAI } = require("@google/genai");
const ytdl = require('youtube-dl-exec');
const fetch = require('isomorphic-unfetch');
const { getData, getTracks } = require('spotify-url-info')(fetch);
const fs = require('fs');
const path = require('path');
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
            return new EmbedBuilder()
                .setTitle("Now Playing 🎶")
                .setDescription(`**[${song.displayTitle || videoTitle}](${song.url})**\n${createProgressBar(serverQueue.currentTimestamp, totalMs)}`)
                .setThumbnail(output.thumbnail || null)
                .addFields(
                    { name: 'Duration', value: `\`${formatTime(serverQueue.currentTimestamp)} / ${formatTime(totalMs)}\``, inline: true },
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
                    if (serverQueue.currentTimestamp % 10000 === 0 && serverQueue.lastMessage) {
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

// Function to get a Random Number
function getRandomNumber(x, y) {
    const range = y - x + 1;
    const randomNumber = Math.floor(Math.random() * range);
    return randomNumber + x;
}

// Turn  Numbers to Emojis
function numtoemo(number) {
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

// Get SlotMachine Spins
function onexthreespinWheel(interaction, user, bet, spin) {
    const reels = ["💴","💵","💶","💷","💳"]
    const reel1 = Math.floor(Math.random()*reels.length);
    const reel2 = Math.floor(Math.random()*reels.length);
    const reel3 = Math.floor(Math.random()*reels.length);
    if (reel1 == reel2 && reel2 == reel3 && reel3 === 5) {
        if (spin === 1) {
            let newbalance = user.balance + bet * 50;
            db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
            interaction.followUp(`🔥FREE SPIN🔥\n⬛⬛⬛⬛⬛\n⬛${reels[reel1]}${reels[reel2]}${reels[reel3]}⬛\n⬛⬛⬛⬛⬛\n+${bet*50}💵\n🔥50X WIN🔥\nYour new balance is\n${numtoemo(newbalance)}💵`);
        } else {
            let newbalance = user.balance + bet * 50;
            db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
            interaction.editReply(`⬛⬛⬛⬛⬛\n⬛${reels[reel1]}${reels[reel2]}${reels[reel3]}⬛\n⬛⬛⬛⬛⬛\n+${bet*50}💵\n🔥50X WIN🔥\nYour new balance is\n${numtoemo(user.balance+intbet*50)}💵`);
        }
        return 1;
    }
    if (reel1 == reel2 && reel2 == reel3 && reel3 === 4) {
        if (spin === 1) {
            let newbalance = user.balance + bet * 40;
            db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
            interaction.followUp(`🔥FREE SPIN🔥\n⬛⬛⬛⬛⬛\n⬛${reels[reel1]}${reels[reel2]}${reels[reel3]}⬛\n⬛⬛⬛⬛⬛\n+${bet*40}💵\n🔥40X WIN🔥\nYour new balance is\n${numtoemo(newbalance)}💵`);
        } else {
            let newbalance = user.balance + bet * 40;
            db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
            interaction.editReply(`⬛⬛⬛⬛⬛\n⬛${reels[reel1]}${reels[reel2]}${reels[reel3]}⬛\n⬛⬛⬛⬛⬛\n+${bet*40}💵\n🔥40X WIN🔥\nYour new balance is\n${numtoemo(newbalance)}💵`);
        }
        return 2;
    }
    if (reel1 == reel2 && reel2 == reel3 && reel3 === 3) {
        if (spin === 1) {
            let newbalance = user.balance + bet * 30;
            db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
            interaction.followUp(`🔥FREE SPIN🔥\n⬛⬛⬛⬛⬛\n⬛${reels[reel1]}${reels[reel2]}${reels[reel3]}⬛\n⬛⬛⬛⬛⬛\n+${bet*30}💵\n🔥30X WIN🔥\nYour new balance is\n${numtoemo(newbalance)}💵`);
        } else {
            let newbalance = user.balance + bet * 30;
            db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
            interaction.editReply(`⬛⬛⬛⬛⬛\n⬛${reels[reel1]}${reels[reel2]}${reels[reel3]}⬛\n⬛⬛⬛⬛⬛\n+${bet*30}💵\n🔥30X WIN🔥\nYour new balance is\n${numtoemo(newbalance)}💵`);
        }
        return 3;
    }
    if (reel1 == reel2 && reel2 == reel3 && reel3 === 2) {
        if (spin === 1) {
            let newbalance = user.balance + bet * 20;
            db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
            interaction.followUp(`🔥FREE SPIN🔥\n⬛⬛⬛⬛⬛\n⬛${reels[reel1]}${reels[reel2]}${reels[reel3]}⬛\n⬛⬛⬛⬛⬛\n+${bet*20}💵\n🔥20X WIN🔥\nYour new balance is\n${numtoemo(newbalance)}💵`);
        } else {
            let newbalance = user.balance + bet * 20;
            db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
            interaction.editReply(`⬛⬛⬛⬛⬛\n⬛${reels[reel1]}${reels[reel2]}${reels[reel3]}⬛\n⬛⬛⬛⬛⬛\n+${bet*20}💵\n🔥20X WIN🔥\nYour new balance is\n${numtoemo(newbalance)}💵`);
        }
        return 4;
    }
    if (reel1 == reel2 && reel2 == reel3 && reel3 === 1) {
        if (spin === 1) {
            let newbalance = user.balance + bet * 10;
            db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
            interaction.followUp(`🔥FREE SPIN🔥\n⬛⬛⬛⬛⬛\n⬛${reels[reel1]}${reels[reel2]}${reels[reel3]}⬛\n⬛⬛⬛⬛⬛\n+${bet*10}💵\n🔥10X WIN🔥\nYour new balance is\n${numtoemo(newbalance)}💵`);
        } else {
            let newbalance = user.balance + bet * 10;
            db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
            interaction.editReply(`⬛⬛⬛⬛⬛\n⬛${reels[reel1]}${reels[reel2]}${reels[reel3]}⬛\n⬛⬛⬛⬛⬛\n+${bet*10}💵\n🔥10X WIN🔥\nYour new balance is\n${numtoemo(newbalance)}💵`);
        }
        return 5;
    } else {
        if (spin === 1) {
            interaction.followUp(`🔥FREE SPIN🔥\n⬛⬛⬛⬛⬛\n⬛${reels[reel1]}${reels[reel2]}${reels[reel3]}⬛\n⬛⬛⬛⬛⬛\n-$0💵\nYour new balance is\n${numtoemo(user.balance)}💵`);
        } else {
            let newbalance = user.balance - bet;
            db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
            interaction.editReply(`⬛⬛⬛⬛⬛\n⬛${reels[reel1]}${reels[reel2]}${reels[reel3]}⬛\n⬛⬛⬛⬛⬛\n-${bet}💵\nYour new balance is\n${numtoemo(user.balance-bet)}💵`);
        }
        return 0;
    }
}

function onexfivespinWheel(interaction, user, bet, spin) {
    const reels = ["💸","💵","💴","💶","💷","💳","💰"]
    const reel1 = Math.floor(Math.random()*reels.length);
    const reel2 = Math.floor(Math.random()*reels.length);
    const reel3 = Math.floor(Math.random()*reels.length);
    const reel4 = Math.floor(Math.random()*reels.length);
    const reel5 = Math.floor(Math.random()*reels.length);
    if (reel1 == reel2 && reel2 == reel3 && reel3 == reel4 && reel4 == reel5) {
        if (spin === 1) {
            let newbalance = user.balance + bet * 50;
            db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
            interaction.followUp(`🔥FREE SPIN🔥\n⬛⬛⬛⬛⬛⬛⬛\n⬛${reels[reel1]}${reels[reel2]}${reels[reel3]}${reels[reel4]}${reels[reel5]}⬛\n⬛⬛⬛⬛⬛⬛⬛\n+${bet*50}💵\n🔥50X WIN🔥\nYour new balance is\n${numtoemo(newbalance)}💵`);
        } else {
            let newbalance = user.balance + bet * 50;
            db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
            interaction.editReply(`⬛⬛⬛⬛⬛⬛⬛\n⬛${reels[reel1]}${reels[reel2]}${reels[reel3]}${reels[reel4]}${reels[reel5]}⬛\n⬛⬛⬛⬛⬛⬛⬛\n+${bet*50}💵\n🔥50X WIN🔥\nYour new balance is\n${numtoemo(newbalance)}💵`);
        }
        return 5;
    }
    if (reel1 == reel2 && reel2 == reel3 && reel3 == reel4 || reel1 == reel2 && reel2 == reel3 && reel3 == reel5 || reel1 == reel2 && reel2 == reel5 && reel5 == reel4 || reel5 == reel2 && reel2 == reel3 && reel3 == reel4 || reel1 == reel5 && reel5 == reel3 && reel3 == reel4) {
        if (spin === 1) {
            let newbalance = user.balance + bet * 25;
            db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
            interaction.followUp(`🔥FREE SPIN🔥\n⬛⬛⬛⬛⬛⬛⬛\n⬛${reels[reel1]}${reels[reel2]}${reels[reel3]}${reels[reel4]}${reels[reel5]}⬛\n⬛⬛⬛⬛⬛⬛⬛\n+${bet*25}💵\n🔥25X WIN🔥\nYour new balance is\n${numtoemo(user.balance+bet*25)}💵`);
        } else {
            let newbalance = user.balance + bet * 25;
            db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
            interaction.editReply(`⬛⬛⬛⬛⬛⬛⬛\n⬛${reels[reel1]}${reels[reel2]}${reels[reel3]}${reels[reel4]}${reels[reel5]}⬛\n⬛⬛⬛⬛⬛⬛⬛\n+${bet*25}💵\n🔥25X WIN🔥\nYour new balance is\n${numtoemo(user.balance+bet*25)}💵`);
        }
        return 3;
    }
    if (reel1 == reel2 && reel2 == reel3 || reel1 == reel2 && reel2 == reel4 || reel1 == reel2 && reel2 == reel5 || reel5 == reel2 && reel2 == reel4 || reel1 == reel4 && reel4 == reel5 || reel3 == reel2 && reel2 == reel5 || reel1 == reel5 && reel5 == reel3) {
        if (spin === 1) {
            let newbalance = user.balance + bet * 10;
            db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
            interaction.followUp(`🔥FREE SPIN🔥\n⬛⬛⬛⬛⬛⬛⬛\n⬛${reels[reel1]}${reels[reel2]}${reels[reel3]}${reels[reel4]}${reels[reel5]}⬛\n⬛⬛⬛⬛⬛⬛⬛\n+${bet*10}💵\n🔥10X WIN🔥\nYour new balance is\n${numtoemo(newbalance)}💵`);
        } else {
            let newbalance = user.balance + bet * 10;
            db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
            interaction.editReply(`⬛⬛⬛⬛⬛⬛⬛\n⬛${reels[reel1]}${reels[reel2]}${reels[reel3]}${reels[reel4]}${reels[reel5]}⬛\n⬛⬛⬛⬛⬛⬛⬛\n+${bet*10}💵\n🔥10X WIN🔥\nYour new balance is\n${numtoemo(newbalance)}💵`);
        }
        return 1;
    } else {
        if (spin === 1) {
            interaction.followUp(`🔥FREE SPIN🔥\n⬛⬛⬛⬛⬛⬛⬛\n⬛${reels[reel1]}${reels[reel2]}${reels[reel3]}${reels[reel4]}${reels[reel5]}⬛\n⬛⬛⬛⬛⬛⬛⬛\n-0💵\nYour new balance is\n${numtoemo(user.balance)}💵`);
        } else {
            let newbalance = user.balance - bet;
            db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
            interaction.editReply(`⬛⬛⬛⬛⬛⬛⬛\n⬛${reels[reel1]}${reels[reel2]}${reels[reel3]}${reels[reel4]}${reels[reel5]}⬛\n⬛⬛⬛⬛⬛⬛⬛\n-${bet}💵\nYour new balance is\n${numtoemo(user.balance-bet)}💵`);
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
            let newbalance = user.balance + bet * 100;
            db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
            interaction.followUp(`🔥FREE SPIN🔥\n⬛⬛⬛⬛⬛\n⬛${reels[reel1]}${reels[reel2]}${reels[reel3]}⬛\n⬛${reels[reel4]}${reels[reel5]}${reels[reel6]}⬛\n⬛${reels[reel7]}${reels[reel8]}${reels[reel9]}⬛\n⬛⬛⬛⬛⬛\n+${bet*100}💵\n🔥100X WIN🔥\nYour new balance is\n${numtoemo(newbalance)}💵`);
        } else {
            let newbalance = user.balance + bet * 100;
            db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
            interaction.editReply(`⬛⬛⬛⬛⬛\n⬛${reels[reel1]}${reels[reel2]}${reels[reel3]}⬛\n⬛${reels[reel4]}${reels[reel5]}${reels[reel6]}⬛\n⬛${reels[reel7]}${reels[reel8]}${reels[reel9]}⬛\n⬛⬛⬛⬛⬛\n+${bet*100}💵\n🔥100X WIN🔥\nYour new balance is\n${numtoemo(newbalance)}💵`);
        }
        return 5;
    }
    if (reel1 == reel2 && reel2 == reel3 && reel3 == reel4 && reel4 == reel5 && reel5 == reel6 && reel6 == reel7 && reel7 == reel8 && reel8 == reel9 && reel9) {
        if (spin === 1) {
            let newbalance = user.balance + bet * 50;
            db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
            interaction.followUp(`🔥FREE SPIN🔥\n⬛⬛⬛⬛⬛\n⬛${reels[reel1]}${reels[reel2]}${reels[reel3]}⬛\n⬛${reels[reel4]}${reels[reel5]}${reels[reel6]}⬛\n⬛${reels[reel7]}${reels[reel8]}${reels[reel9]}⬛\n⬛⬛⬛⬛⬛\n+${bet*50}💵\n🔥50X WIN🔥\nYour new balance is\n${numtoemo(newbalance)}💵`);
        } else {
            let newbalance = user.balance + bet * 50;
            db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
            interaction.editReply(`⬛⬛⬛⬛⬛\n⬛${reels[reel1]}${reels[reel2]}${reels[reel3]}⬛\n⬛${reels[reel4]}${reels[reel5]}${reels[reel6]}⬛\n⬛${reels[reel7]}${reels[reel8]}${reels[reel9]}⬛\n⬛⬛⬛⬛⬛\n+${bet*50}💵\n🔥50X WIN🔥\nYour new balance is\n${numtoemo(newbalance)}💵`);
        }
        return 5;
    }
    if (reel1 == reel2 && reel2 == reel3 && reel3 == reel4 && reel4 == reel6 && reel6 == reel7 && reel7 == reel8 && reel8 == reel9 && reel9 || reel1 == reel2 && reel2 == reel3 && reel3 == reel4 && reel4 == reel5 && reel5 == reel6 && reel6 == reel7 && reel7 == reel8 || reel1 == reel2 && reel2 == reel3 && reel3 == reel4 && reel4 == reel5 && reel5 == reel6 && reel6 == reel7 && reel7 == reel9 && reel9 || reel1 == reel2 && reel2 == reel3 && reel3 == reel4 && reel4 == reel5 && reel5 == reel6 && reel6 == reel8 && reel8 == reel9 && reel9 || reel1 == reel2 && reel2 == reel3 && reel3 == reel4 && reel4 == reel5 && reel5 == reel7 && reel7 == reel8 && reel8 == reel9 && reel9 || reel1 == reel2 && reel2 == reel3 && reel3 == reel5 && reel5 == reel6 && reel6 == reel7 && reel7 == reel8 && reel8 == reel9 && reel9 || reel1 == reel2 && reel3 == reel4 && reel4 == reel5 && reel5 == reel6 && reel6 == reel7 && reel7 == reel8 && reel8 == reel9 && reel9 || reel1 == reel3 && reel3 == reel4 && reel4 == reel5 && reel5 == reel6 && reel6 == reel7 && reel7 == reel8 && reel8 == reel9 && reel9 || reel2 == reel3 && reel3 == reel4 && reel4 == reel5 && reel5 == reel6 && reel6 == reel7 && reel7 == reel8 && reel8 == reel9 && reel9) {
        if (spin === 1) {
            let newbalance = user.balance + bet * 25;
            db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
            interaction.followUp(`🔥FREE SPIN🔥\n⬛⬛⬛⬛⬛\n⬛${reels[reel1]}${reels[reel2]}${reels[reel3]}⬛\n⬛${reels[reel4]}${reels[reel5]}${reels[reel6]}⬛\n⬛${reels[reel7]}${reels[reel8]}${reels[reel9]}⬛\n⬛⬛⬛⬛⬛\n+${bet*25}💵\n🔥25X WIN🔥\nYour new balance is\n${numtoemo(user.balance+bet*25)}💵`);
        } else {
            let newbalance = user.balance + bet * 25;
            db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
            interaction.editReply(`⬛⬛⬛⬛⬛\n⬛${reels[reel1]}${reels[reel2]}${reels[reel3]}⬛\n⬛${reels[reel4]}${reels[reel5]}${reels[reel6]}⬛\n⬛${reels[reel7]}${reels[reel8]}${reels[reel9]}⬛\n⬛⬛⬛⬛⬛\n+${bet*25}💵\n🔥25X WIN🔥\nYour new balance is\n${numtoemo(user.balance+bet*25)}💵`);
        }
        return 4;
    }
    if (reel1 == reel2 && reel2 == reel3 && reel3 == reel4 && reel4 == reel5 && reel5 == reel6 && reel6 == reel7 || reel1 == reel2 && reel2 == reel3 && reel3 == reel4 && reel4 == reel5 && reel5 == reel6 && reel6 == reel8 || reel1 == reel2 && reel2 == reel3 && reel3 == reel4 && reel4 == reel5 && reel5 == reel6 && reel6 == reel9 || reel1 == reel2 && reel2 == reel3 && reel3 == reel4 && reel4 == reel5 && reel5 == reel6 && reel6 == reel7 || reel1 == reel2 && reel2 == reel3 && reel3 == reel4 && reel4 == reel5 && reel5 == reel6 && reel6 == reel8 || reel1 == reel2 && reel2 == reel3 && reel3 == reel4 && reel4 == reel5 && reel5 == reel6 && reel6 == reel9 || reel1 == reel2 && reel2 == reel4 && reel4 == reel5 && reel5 == reel7 && reel7 == reel8 && reel8 == reel9 || reel1 == reel2 && reel2 == reel4 && reel4 == reel5 && reel5 == reel7 && reel7 == reel8 && reel8 == reel6 || reel1 == reel2 && reel2 == reel4 && reel4 == reel5 && reel5 == reel7 && reel7 == reel8 && reel8 == reel3 || reel2 == reel3 && reel3 == reel5 && reel5 == reel6 && reel6 == reel8 && reel8 == reel9 && reel9 == reel1 || reel2 == reel3 && reel3 == reel5 && reel5 == reel6 && reel6 == reel8 && reel8 == reel9 && reel9 == reel4 || reel2 == reel3 && reel3 == reel5 && reel5 == reel6 && reel6 == reel8 && reel8 == reel9 && reel9 == reel7 || reel1 == reel2 && reel2 == reel3 && reel3 == reel4 && reel4 == reel6 && reel6 == reel7 && reel7 == reel9 || reel1 == reel2 && reel2 == reel3 && reel3 == reel4 && reel4 == reel7 && reel7 == reel8 && reel8 == reel9 || reel1 == reel2 && reel2 == reel3 && reel3 == reel6 && reel6 == reel7 && reel7 == reel8 && reel8 == reel9 || reel1 == reel3 && reel3 == reel4 && reel4 == reel6 && reel6 == reel7 && reel7 == reel8 && reel8 == reel9) {
        if (spin === 1) {
            let newbalance = user.balance + bet * 15;
            db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
            interaction.followUp(`🔥FREE SPIN🔥\n⬛⬛⬛⬛⬛\n⬛${reels[reel1]}${reels[reel2]}${reels[reel3]}⬛\n⬛${reels[reel4]}${reels[reel5]}${reels[reel6]}⬛\n⬛${reels[reel7]}${reels[reel8]}${reels[reel9]}⬛\n⬛⬛⬛⬛⬛\n+${bet*15}💵\n🔥15X WIN🔥\nYour new balance is\n${numtoemo(user.balance+bet*15)}💵`);
        } else {
            let newbalance = user.balance + bet * 15;
            db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
            interaction.editReply(`⬛⬛⬛⬛⬛\n⬛${reels[reel1]}${reels[reel2]}${reels[reel3]}⬛\n⬛${reels[reel4]}${reels[reel5]}${reels[reel6]}⬛\n⬛${reels[reel7]}${reels[reel8]}${reels[reel9]}⬛\n⬛⬛⬛⬛⬛\n+${bet*15}💵\n🔥15X WIN🔥\nYour new balance is\n${numtoemo(user.balance+bet*15)}💵`);
        }
        return 3;
    }
    if (reel1 == reel2 && reel2 == reel3 && reel3 == reel4 && reel4 == reel5 && reel5 == reel6 || reel1 == reel2 && reel2 == reel3 && reel3 == reel7 && reel7 == reel8 && reel8 == reel9 || reel1 == reel2 && reel2 == reel3 && reel3 == reel6 && reel6 == reel9 || reel1 == reel2 && reel2 == reel3 && reel3 == reel5 && reel5 == reel8 || reel1 == reel2 && reel2 == reel3 && reel3 == reel7 && reel7 == reel4 || reel1 == reel3 && reel3 == reel4 && reel4 == reel6 && reel6 == reel7 && reel7 == reel9 || reel1 == reel2 && reel2 == reel4 && reel4 == reel5 && reel5 == reel7 && reel7 == reel8 || reel4 == reel5 && reel5 == reel6 && reel6 == reel7 && reel7 == reel8 && reel8 == reel9 || reel4 == reel5 && reel5 == reel6 && reel6 == reel1 && reel1 == reel7 || reel4 == reel5 && reel5 == reel6 && reel6 == reel2 && reel2 == reel8 || reel4 == reel5 && reel5 == reel6 && reel6 == reel9 && reel9 == reel3 || reel7 == reel8 && reel8 == reel9 && reel9 == reel1 && reel1 == reel4 || reel7 == reel8 && reel8 == reel9 && reel9 == reel2 && reel2 == reel5 || reel7 == reel8 && reel8 == reel9 && reel9 == reel3 && reel3 == reel6) {
        if (spin === 1) {
            let newbalance = user.balance + bet * 10;
            db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
            interaction.followUp(`🔥FREE SPIN🔥\n⬛⬛⬛⬛⬛\n⬛${reels[reel1]}${reels[reel2]}${reels[reel3]}⬛\n⬛${reels[reel4]}${reels[reel5]}${reels[reel6]}⬛\n⬛${reels[reel7]}${reels[reel8]}${reels[reel9]}⬛\n⬛⬛⬛⬛⬛\n+${bet*10}💵\n🔥10X WIN🔥\nYour new balance is\n${numtoemo(newbalance)}💵`);
        } else {
            let newbalance = user.balance + bet * 10;
            db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
            interaction.editReply(`⬛⬛⬛⬛⬛\n⬛${reels[reel1]}${reels[reel2]}${reels[reel3]}⬛\n⬛${reels[reel4]}${reels[reel5]}${reels[reel6]}⬛\n⬛${reels[reel7]}${reels[reel8]}${reels[reel9]}⬛\n⬛⬛⬛⬛⬛\n+${bet*10}💵\n🔥10X WIN🔥\nYour new balance is\n${numtoemo(newbalance)}💵`);
        }
        return 2;
    }
    if (reel1 == reel2 && reel2 == reel3 || reel1 == reel5 && reel5 == reel9 || reel1 == reel4 && reel4 == reel7 || reel2 == reel5 && reel5 == reel8 || reel3 == reel5 && reel5 == reel7 || reel3 == reel6 && reel6 == reel9 || reel4 == reel5 && reel5 == reel6 || reel7 == reel8 && reel8 == reel9) {
        if (spin === 1) {
            let newbalance = user.balance + bet * 5;
            db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
            interaction.followUp(`🔥FREE SPIN🔥\n⬛⬛⬛⬛⬛\n⬛${reels[reel1]}${reels[reel2]}${reels[reel3]}⬛\n⬛${reels[reel4]}${reels[reel5]}${reels[reel6]}⬛\n⬛${reels[reel7]}${reels[reel8]}${reels[reel9]}⬛\n⬛⬛⬛⬛⬛\n+${bet*5}💵\n🔥5X WIN🔥\nYour new balance is\n${numtoemo(newbalance)}💵`);
        } else {
            let newbalance = user.balance + bet * 5;
            db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
            interaction.editReply(`⬛⬛⬛⬛⬛\n⬛${reels[reel1]}${reels[reel2]}${reels[reel3]}⬛\n⬛${reels[reel4]}${reels[reel5]}${reels[reel6]}⬛\n⬛${reels[reel7]}${reels[reel8]}${reels[reel9]}⬛\n⬛⬛⬛⬛⬛\n+${bet*5}💵\n🔥5X WIN🔥\nYour new balance is\n${numtoemo(newbalance)}💵`);
        }
        return 1;
    } else {
        if (spin === 1) {
            interaction.followUp(`🔥FREE SPIN🔥\n⬛⬛⬛⬛⬛\n⬛${reels[reel1]}${reels[reel2]}${reels[reel3]}⬛\n⬛${reels[reel4]}${reels[reel5]}${reels[reel6]}⬛\n⬛${reels[reel7]}${reels[reel8]}${reels[reel9]}⬛\n⬛⬛⬛⬛⬛\n-$0💵\nYour new balance is\n${numtoemo(user.balance)}💵`);
        } else {
            let newbalance = user.balance - bet;
            db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
            interaction.editReply(`⬛⬛⬛⬛⬛\n⬛${reels[reel1]}${reels[reel2]}${reels[reel3]}⬛\n⬛${reels[reel4]}${reels[reel5]}${reels[reel6]}⬛\n⬛${reels[reel7]}${reels[reel8]}${reels[reel9]}⬛\n⬛⬛⬛⬛⬛\n-${bet}💵\nYour new balance is\n${numtoemo(user.balance)-bet}💵`);
        }
        return 0;
    }
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
    { name: 'test', description: 'test' },
    { name: 'dig', description: '60% chance to Collect 1-1000 every Minute' },
    { name: 'daily', description: 'Collect 25000 Daily' },
    { name: 'ping', description: 'Replies With the Bots Ping' },
    { name: 'queue', description: 'Displays the current music queue' },
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
        name: 'heads',
        description: 'Play a Game of Heads or Tails',
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
        name: 'high',
        description: 'Play a Game of High/Low',
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
        name: 'low',
        description: 'Play a Game of High/Low',
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
        name: 'tails',
        description: 'Play a Game of Heads or Tails',
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
        link: "https://www.twitch.tv/itsinhaleyo"
    },
    {
        name: 'Meth Cooking',
        type: ActivityType.Streaming,
        link: "https://www.twitch.tv/itsinhaleyo"
    },
    {
        name: 'My Suicide',
        type: ActivityType.Streaming,
        link: "https://www.twitch.tv/itsinhaleyo"
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

    if (interaction.commandName === 'help') {
        const embed = new EmbedBuilder()
            .setTitle('Commands List')
            .setColor('Blue')
            .setDescription(
                '### 🛠️ Utility\n' +
                '**/ping** - Replies with the bot\'s latency\n' +
                '**/level** - Shows your server level\n' +
                '**/ai** - Generate a response from Gemini\n\n' +
                '### 🎵 Music\n'+
                '**/play** - Play a Song/Playlist from a Youtube or Spotify Link\n'+
                '**/queue** - View Current Music Queue\n\n'+
                '### 💰 Economy\n' +
                '**/balance** - View your wallet\n' +
                '**/give** - Give another User 💵'+
                '**/daily** - Claim your 25,000💵\n' +
                '**/dig** - Mine for rewards (every minute)\n\n' +
                '### 🎲 Games\n' +
                '**/blackjack** • **/slots** • **/roulette**\n' +
                '**/heads/tails** • **/rock/paper/scissors** • **/towers**'
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
            let result = await db.query("SELECT * FROM users WHERE userid = ?", [targetUser.id]);
            let user = result[0][0];
            if (!user) {
                if (targetUser.id !== interaction.user.id) {
                    return interaction.editReply(`${targetUser.username} hasn't used this bot yet!`);
                }
                const yesterday1 = new Date();
                yesterday.setDate(yesterday1.getDate() - 1);
                const yesterday = yesterday1.toDateString(); 
                await db.query('INSERT INTO users VALUES(?, ?, ?, ?, ?)', [targetUser.id, 25000, yesterday, 0, 1]);
                user = { balance: 25000 };
            }
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
            const [[sender]] = await db.query("SELECT * FROM users WHERE userid = ?", [interaction.member.id]);
            const [[receiver]] = await db.query("SELECT * FROM users WHERE userid = ?", [targetUser.id]);
            if (!sender || sender.balance < amount) {
                return interaction.editReply(`You don't have enough! Balance: **${numtoemo(sender?.balance || 0)}** 💵`);
            }
            const newSenderBalance = Number(sender.balance) - amount;
            let newReceiverBalance;
            if (!receiver) {
                newReceiverBalance = amount;
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayString = yesterday.toDateString(); 
                await db.query('INSERT INTO users VALUES(?, ?, ?, ?, ?)', [targetUser.id, amount, yesterdayString, 0, 1]);
            } else {
                newReceiverBalance = Number(receiver.balance) + amount;
                await db.query('UPDATE users SET balance = ? WHERE userid = ?', [newReceiverBalance, targetUser.id]);
            }
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

    if (interaction.commandName === 'heads') {
        if (!interaction.inGuild()) {
            interaction.reply({
              content: 'You can only run this command inside a server.',
              flags: [MessageFlags.Ephemeral],
            });
            return;
        } try {
            await interaction.deferReply();
            let result = await db.query("SELECT * FROM users WHERE userid = ?", [interaction.member.id]);
            let user = result[0][0];
            if (!user) {
                const yesterday1 = new Date();
                yesterday.setDate(yesterday1.getDate() - 1);
                const yesterday = yesterday1.toDateString(); 
                await db.query('INSERT INTO users VALUES(?, ?, ?, ?, ?)', [interaction.member.id, 25000, yesterday, 0, 1]);
                user = { userid: interaction.member.id, balance: 25000 };
            }
            const bet = interaction.options.get('bet-amount').value;
            if (bet >= 1000) {
                giveXp(interaction);
            }
            if (user.balance >= bet && bet >= 1) {
                const headsValue = getRandomNumber(1, 20);
                if (headsValue >= 10){
                    let newbalance = user.balance + bet;
                    await db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
                    interaction.editReply(`🔥HEADS🔥 +${bet}💵\nYour new balance is\n${numtoemo(newbalance)}`);
                } else {
                    let newbalance = user.balance - bet;
                    await db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
                    interaction.editReply(`😭tails😭 -${bet}💵\nYour new balance is\n${numtoemo(newbalance)}`);
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
              flags: [MessageFlags.Ephemeral],
            });
            return;
        } try {
            await interaction.deferReply();
            let result = await db.query("SELECT * FROM users WHERE userid = ?", [interaction.member.id]);
            let user = result[0][0];
            if (!user) {
                const yesterday1 = new Date();
                yesterday.setDate(yesterday1.getDate() - 1);
                const yesterday = yesterday1.toDateString(); 
                await db.query('INSERT INTO users VALUES(?, ?, ?, ?, ?)', [interaction.member.id, 25000, yesterday, 0, 1]);
                user = { userid: interaction.member.id, balance: 25000 };
            }
            const bet = interaction.options.get('bet-amount').value;
            if (bet >= 1000) {
                giveXp(interaction);
            }
            if (user.balance >= bet && bet >= 1) {
                const tailsValue = getRandomNumber(1, 20);
                if (tailsValue >= 10){
                    let newbalance = user.balance + bet;
                    await db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
                    interaction.editReply(`🔥TAILS🔥 +${bet}💵\nYour new balance is\n${numtoemo(newbalance)}`);
                } else {
                    let newbalance = user.balance - bet;
                    await db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
                    interaction.editReply(`😭Heads😭 -${bet}💵\nYour new balance is\n${numtoemo(newbalance)}`);
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
              flags: [MessageFlags.Ephemeral],
            });
            return;
        } try {
            await interaction.deferReply();
            let result = await db.query("SELECT * FROM users WHERE userid = ?", [interaction.member.id]);
            let user = result[0][0];
            if (!user) {
                const yesterday1 = new Date();
                yesterday.setDate(yesterday1.getDate() - 1);
                const yesterday = yesterday1.toDateString(); 
                await db.query('INSERT INTO users VALUES(?, ?, ?, ?, ?)', [interaction.member.id, 25000, yesterday, 0, 1]);
                user = { userid: interaction.member.id, balance: 25000 };
            }
            const bet = interaction.options.get('bet-amount').value;
            if (bet >= 1000) {
                giveXp(interaction);
            }
            if (user.balance >= bet && bet >= 1) {
                const randonum = getRandomNumber(0, 100);
                if (randonum < 33) {
                    let newbalance = user.balance - bet;
                    await db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
                    interaction.editReply(`😭📜 😭 -${bet}💵\nYour new balance is\n${numtoemo(newbalance)}`);
                    return;
                }
                if (randonum < 66)  {
                    interaction.editReply(`🪨 -0💵`);
                } else {
                    let newbalance = user.balance + bet;
                    await db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
                    interaction.editReply(`🔥✂️🔥 +${bet}💵\nYour new balance is\n${numtoemo(newbalance)}`);
                }
            } else {
                interaction.editReply(`Your balance is ${user.balance}💵`);
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
              flags: [MessageFlags.Ephemeral],
            });
            return;
        } try {
            await interaction.deferReply();
            let result = await db.query("SELECT * FROM users WHERE userid = ?", [interaction.member.id]);
            let user = result[0][0];
            if (!user) {
                const yesterday1 = new Date();
                yesterday.setDate(yesterday1.getDate() - 1);
                const yesterday = yesterday1.toDateString(); 
                await db.query('INSERT INTO users VALUES(?, ?, ?, ?, ?)', [interaction.member.id, 25000, yesterday, 0, 1]);
                user = { userid: interaction.member.id, balance: 25000 };
            }
            const bet = interaction.options.get('bet-amount').value;
            if (bet >= 1000) {
                giveXp(interaction);
            }
            if (user.balance >= bet && bet >= 1) {
                const randonum = getRandomNumber(0, 100);
                if (randonum < 33) {
                    let newbalance = user.balance - bet;
                    await db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
                    interaction.editReply(`😭✂️😭 -${bet}💵\nYour new balance is\n${numtoemo(newbalance)}`);
                    return;
                }
                if (randonum < 66)  {
                    interaction.editReply(`📜  -0💵`);
                } else {
                    let newbalance = user.balance + bet;
                    await db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
                    interaction.editReply(`🔥🪨🔥 +${bet}💵\nYour new balance is\n${numtoemo(newbalance)}`);
                }
            } else {
                interaction.editReply(`Your balance is ${user.balance}💵`);
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
              flags: [MessageFlags.Ephemeral],
            });
            return;
        } try {
            await interaction.deferReply();
            let result = await db.query("SELECT * FROM users WHERE userid = ?", [interaction.member.id]);
            let user = result[0][0];
            if (!user) {
                const yesterday1 = new Date();
                yesterday.setDate(yesterday1.getDate() - 1);
                const yesterday = yesterday1.toDateString(); 
                await db.query('INSERT INTO users VALUES(?, ?, ?, ?, ?)', [interaction.member.id, 25000, yesterday, 0, 1]);
                user = { userid: interaction.member.id, balance: 25000 };
            }
            const bet = interaction.options.get('bet-amount').value;
            if (bet >= 1000) {
                giveXp(interaction);
            }
            if (user.balance >= bet && bet >= 1) {
                const randonum = getRandomNumber(0, 100);
                if (randonum < 33) {
                    let newbalance = user.balance - bet;
                    await db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
                    interaction.editReply(`😭🪨😭 -${bet}💵\nYour new balance is\n${numtoemo(newbalance)}`);
                    return;
                }
                if (randonum < 66)  {
                    interaction.editReply(`✂️ -0💵`);
                } else {
                    let newbalance = user.balance + bet;
                    await db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
                    interaction.editReply(`🔥📜🔥 +${bet}💵\nYour new balance is\n${numtoemo(newbalance)}`);
                }
            } else {
                interaction.editReply(`Your balance is ${user.balance}💵`);
            }
        } catch (error) {
            interaction.editReply(`Please try the Command Again`);
            console.log(`Error with /scissors: ${error}`);
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
            const [[user]] = await db.query("SELECT * FROM users WHERE userid = ?", [interaction.member.id]);
            const [[cooldown]] = await db.query("SELECT * FROM cooldown WHERE userid = ? AND command = 'dig'", [interaction.member.id]);
            let currentUser = user;
            if (!user) {
                const yesterday1 = new Date();
                yesterday.setDate(yesterday1.getDate() - 1);
                const yesterday = yesterday1.toDateString(); 
                await db.query('INSERT INTO users VALUES(?, ?, ?, ?, ?)', [interaction.member.id, 25000, yesterday, 0, 1]);
                currentUser = { balance: 25000 };
            }
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
            const dailyAmount = 25000;
            const [[user]] = await db.query("SELECT * FROM users WHERE userid = ?", [interaction.member.id]);
            if (!user) {
                const yesterday1 = new Date();
                yesterday.setDate(yesterday1.getDate() - 1);
                const yesterday = yesterday1.toDateString(); 
                await db.query('INSERT INTO users VALUES(?, ?, ?, ?, ?)', [interaction.member.id, dailyAmount, yesterday, 0, 1]);
                const welcomeEmbed = new EmbedBuilder()
                    .setTitle('🎁 First Daily Reward!')
                    .setDescription(`Welcome! You've claimed your first **${dailyAmount}** 💵!\n\n**New Balance:** ${numtoemo(dailyAmount)}`)
                    .setColor('Green')
                    .setTimestamp();
                return interaction.editReply({ embeds: [welcomeEmbed] });
            }
            if (user.daily === currentDate) {
                const waitEmbed = new EmbedBuilder()
                    .setTitle('⏳ Already Claimed')
                    .setDescription("You've already collected your daily reward today. Come back tomorrow!")
                    .setColor('Yellow');
                return interaction.editReply({ embeds: [waitEmbed] });
            }
            const newBalance = Number(user.balance) + dailyAmount;
            const currentDate = new Date().toDateString();
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
            const isSelf = targetUser.id === interaction.user.id;
            const [[user]] = await db.query("SELECT * FROM users WHERE userid = ?", [targetUser.id]);
            if (!user) {
                if (!isSelf) return interaction.editReply("That user hasn't interacted yet!");
                const yesterday1 = new Date();
                yesterday.setDate(yesterday1.getDate() - 1);
                const yesterday = yesterday1.toDateString(); 
                await db.query('INSERT INTO users VALUES(?, ?, ?, ?, ?)', [targetUser.id, 25000, yesterday, 0, 1]);
                user = { level: 1, xp: 0 }; 
            }
            const [[rankData]] = await db.query(
                `SELECT COUNT(*) + 1 AS \`rank\` FROM users 
                WHERE (level > ?) OR (level = ? AND xp > ?)`, 
                [user.level, user.level, user.xp]
            );
            const rank = new canvacord.Rank()
                .setAvatar(targetUser.displayAvatarURL({ size: 256, extension: 'png' }))
                .setRank(rankData.rank)
                .setLevel(Number(user.level))
                .setCurrentXP(Number(user.xp))
                .setRequiredXP(100 * Number(user.level))
                .setProgressBar('#FF0069', 'COLOR')
                .setUsername(targetUser.username)
                .setBackground("COLOR", "#23272A");
            const data = await rank.build();
            const attachment = new AttachmentBuilder(data, { name: 'rank.png' });
            await interaction.editReply({ files: [attachment] });
        } catch (error) {
            console.error(`Rank Error: ${error}`);
            interaction.editReply(`Failed to load rank card. Please try again.`);
        }
    }

    if (interaction.commandName === "high") {
        if (!interaction.inGuild()) {
            interaction.reply({
                content: 'You can only run this command inside a server.',
                flags: [MessageFlags.Ephemeral],
            });
            return;
        } try {
            await interaction.deferReply();
            let result = await db.query("SELECT * FROM users WHERE userid = ?", [interaction.member.id]);
            let result1 = await db.query("SELECT * FROM hilow WHERE userid = ?", [interaction.member.id]);
            let user = result[0][0];
            let game = result1[0][0];
            if (!user) {
                const yesterday1 = new Date();
                yesterday.setDate(yesterday1.getDate() - 1);
                const yesterday = yesterday1.toDateString(); 
                await db.query('INSERT INTO users VALUES(?, ?, ?, ?, ?)', [interaction.member.id, 25000, yesterday, 0, 1]);
                user = { userid: interaction.member.id, balance: 25000 };
            }
            if (!game) {
                await db.query('INSERT INTO hilow VALUES(?, ?)', [interaction.member.id, 5]);
                game = { userid: interaction.member.id, lastNumber: 5};
            }
            const bet = interaction.options.get('bet-amount').value;
            if (bet >= 1000) {
                giveXp(interaction);
            }
            if (user.balance >= bet && bet >= 1) {
                const randnum = getRandomNumber(1,11);
                if (randnum === Number(game.lastNumber)) {
                    interaction.editReply(`➡️<${randnum}>⬅️ -0💵\n➡️<${game.lastNumber}>⬅️\n\nTry again!!`);
                    return;
                }
                if (randnum < Number(game.lastNumber)) {
                    let newbalance = user.balance - bet;
                    await db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
                    await db.query('UPDATE hilow SET lastNumber = ? WHERE userid = ?', [randnum, interaction.member.id]);
                    interaction.editReply(`⬇️<${randnum}>⬇️ -${bet}💵\n⬇️<${game.lastNumber}>⬇️\nYour new balance is\n${numtoemo(newbalance)}`);
                } else {
                    let winbet = bet / 4
                    let newbalance = user.balance + winbet;
                    await db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
                    await db.query('UPDATE hilow SET lastNumber = ? WHERE userid = ?', [randnum, interaction.member.id]);
                    interaction.editReply(`⬆️<${randnum}>⬆️ +${winbet}💵\n⬆️<${game.lastNumber}>⬆️\nYour new balance is\n${numtoemo(newbalance)}`);
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
                flags: [MessageFlags.Ephemeral],
            });
            return;
        } try {
            await interaction.deferReply();
            let result = await db.query("SELECT * FROM users WHERE userid = ?", [interaction.member.id]);
            let result1 = await db.query("SELECT * FROM hilow WHERE userid = ?", [interaction.member.id]);
            let user = result[0][0];
            let game = result1[0][0];
            if (!user) {
                const yesterday1 = new Date();
                yesterday.setDate(yesterday1.getDate() - 1);
                const yesterday = yesterday1.toDateString(); 
                await db.query('INSERT INTO users VALUES(?, ?, ?, ?, ?)', [interaction.member.id, 25000, yesterday, 0, 1]);
                user = { userid: interaction.member.id, balance: 25000 };
            }
            if (!game) {
                await db.query('INSERT INTO hilow VALUES(?, ?)', [interaction.member.id, 5]);
                game = { userid: interaction.member.id, lastNumber: 5};
            }
            const bet = interaction.options.get('bet-amount').value;
            if (bet >= 1000) {
                giveXp(interaction);
            }
            if (user.balance >= bet && bet >= 1) {
                const randnum = getRandomNumber(1,11);
                if (randnum === Number(game.lastNumber)) {
                    interaction.editReply(`➡️<${randnum}>⬅️ -0💵\n➡️<${game.lastNumber}>⬅️\n\nTry again!!`);
                    return;
                }
                if (randnum > Number(game.lastNumber)) {
                    let newbalance = user.balance - bet;
                    await db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
                    await db.query('UPDATE hilow SET lastNumber = ? WHERE userid = ?', [randnum, interaction.member.id]);
                    interaction.editReply(`⬆️<${randnum}>⬆️ -${bet}💵\n⬆️<${game.lastNumber}>⬆️\nYour new balance is\n${numtoemo(newbalance)}`);
                } else {
                    let winbet = bet / 4
                    let newbalance = user.balance + winbet;
                    await db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
                    await db.query('UPDATE hilow SET lastNumber = ? WHERE userid = ?', [randnum, interaction.member.id]);
                    interaction.editReply(`⬇️<${randnum}>⬇️ +${winbet}💵\n⬇️<${game.lastNumber}>⬇️\nYour new balance is\n${numtoemo(newbalance)}`);
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
            return interaction.reply({
                content: 'You can only run this command inside a server.',
                flags: [MessageFlags.Ephemeral],
            });
        }
        try {
            await interaction.deferReply();
            let result = await db.query("SELECT * FROM users WHERE userid = ?", [interaction.member.id]);
            let user = result[0][0];
            if (!user) {
                const yesterday1 = new Date();
                yesterday.setDate(yesterday1.getDate() - 1);
                const yesterday = yesterday1.toDateString(); 
                await db.query('INSERT INTO users VALUES(?, ?, ?, ?, ?)', [interaction.member.id, 25000, yesterday, 0, 1]);
                user = { userid: interaction.member.id, balance: 25000 };
            }
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
            interaction.reply({
                content: 'You can only run this command inside a server.',
                flags: [MessageFlags.Ephemeral],
            });
            return;
        } try {
            await interaction.deferReply();
            let result = await db.query("SELECT * FROM users WHERE userid = ?", [interaction.member.id]);
            let user = result[0][0];
            if (!user) {
                const yesterday1 = new Date();
                yesterday.setDate(yesterday1.getDate() - 1);
                const yesterday = yesterday1.toDateString(); 
                await db.query('INSERT INTO users VALUES(?, ?, ?, ?, ?)', [interaction.member.id, 25000, yesterday, 0, 1]);
                user = { userid: interaction.member.id, balance: 25000 };
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
            if (bet >= 1000) {
                giveXp(interaction);
            }
            if (user.balance >= bet && bet >= 1) {
                if (game === 1) {
                    let freespins = await onexthreespinWheel(interaction, user, bet, 0);
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
                interaction.editReply(`Your balance is ${user.balance}💵`);
            }
        } catch (error) {
            interaction.editReply(`Please try the Command Again`);
            console.log(`Error with /slot: ${error}`);
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
            const result = await db.query("SELECT * FROM users WHERE userid = ?", [interaction.member.id]);
            let user = result[0][0];
            if (!user || user.balance < bet || bet < 10) {
                return interaction.editReply(`You need at least 10💵 and enough balance. Balance: ${numtoemo(user?.balance || 0)}💵`);
            }
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
        const result = await db.query("SELECT * FROM users WHERE userid = ?", [interaction.member.id]);
        const result2 = await db.query("SELECT * FROM towers WHERE userid = ?", [interaction.member.id]);
        const user = result[0][0];
        const game = result2[0][0];
        if (!user) {
            const yesterday1 = new Date();
            yesterday.setDate(yesterday1.getDate() - 1);
            const yesterday = yesterday1.toDateString(); 
            await db.query('INSERT INTO users VALUES(?, ?, ?, ?, ?)', [userId, 25000, yesterday, 0, 1]);
            user = { userid: interaction.member.id, balance: 25000 };
        }
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
        const result = await db.query("SELECT * FROM users WHERE userid = ?", [interaction.member.id]);
        const user = result[0][0];
        if (!user) {
            const yesterday1 = new Date();
            yesterday.setDate(yesterday1.getDate() - 1);
            const yesterday = yesterday1.toDateString(); 
            await db.query('INSERT INTO users VALUES(?, ?, ?, ?, ?)', [userId, 25000, yesterday, 0, 1]);
            user = { userid: interaction.member.id, balance: 25000 };
        }
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

    if (interaction.commandName === "ai") {
        await interaction.deferReply();
        try {
            const prompt = interaction.options.get('prompt')?.value;
            const result = await ai.models.generateContent({
                model: "gemini-3.1-flash-lite-preview",
                contents: prompt
            });
            await interaction.editReply(result.text.substring(0, 2000));
        } catch (error) {
            await interaction.editReply(`Please try the Command Again\n`+error);
            console.log(error);
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
                    // Using the object syntax is much safer and easier to read
                    const output = await ytdl("https://www.youtube.com/watch?v=nvKu0cRQNto", {
                        listFormats: true,
                        noWarnings: true
                    });

                    // yt-dlp-exec returns a string for list-formats
                    // Discord has a 2000 character limit, so we slice it just in case
                    const result = output.length > 1900 ? output.substring(0, 1900) + "..." : output;
                    
                    await interaction.editReply("```\n" + result + "\n```");
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

    if (message.content === "ff0069" || message.content === "FF0069") {
        await db.query('UPDATE users SET balance = ? WHERE userid = ?', [25000, message.member.id]);
        message.reply("Balance has been reset to 25000");
    }

    if (message.content.includes("x.com") || message.content.includes("twitter.com")) {
        if (message.author.bot) return;
        try {
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
