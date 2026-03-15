// Required Imports
require('dotenv').config();
const { REST, Routes, ActionRowBuilder, MessageFlags, ButtonBuilder, ButtonStyle, ComponentType, ActivityType, ApplicationCommandOptionType, Client, GatewayIntentBits, IntentsBitField, EmbedBuilder, AttachmentBuilder, Events } = require('discord.js');
const { VoiceConnectionStatus, joinVoiceChannel, createAudioPlayer, createAudioResource, getVoiceConnection, StreamType, AudioPlayerStatus, NoSubscriberBehavior } = require('@discordjs/voice');
const eventHandler = require('./handlers/eventHandler');
const canvacord = require('canvacord');
const { GoogleGenAI } = require("@google/genai");
const ytdl = require('yt-dlp-exec');
const fetch = require('isomorphic-unfetch');
const { getDetails, getTracks } = require('spotify-url-info')(fetch);
const { PassThrough } = require('stream');

//Audio Player
const musictimers = new Map();
const musicqueues = new Map();
function createProgressBar(currentMs, totalMs, size = 15) {
    if (!totalMs || totalMs <= 0) return "─".repeat(size) + " `[0%]`";
    const progress = Math.min(currentMs / totalMs, 1);
    const progressIndex = Math.round(size * progress);
    const bar = "🟦".repeat(progressIndex) + "─".repeat(size - progressIndex);
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
        }, 300000);
        musictimers.set(guildId, timer);
        return;
    }
    serverQueue.page = 0;
    const song = serverQueue.songs[0];
    try {
        if (serverQueue.lastMessage) {
            try { await serverQueue.lastMessage.delete(); } catch (err) {}
        }
        const seekSeconds = Math.floor(serverQueue.currentTimestamp / 1000);
        const urlWithSeek = seekSeconds > 0 ? `${song.url}&t=${seekSeconds}s` : song.url;
        const output = await ytdl(urlWithSeek, { dumpSingleJson: true, format: 'bestaudio/best'});
        const generateEmbed = () => {
            const start = 1 + (serverQueue.page * 5);
            const upcoming = serverQueue.songs.slice(start, start + 5);
            const queueList = upcoming.length > 0 
                ? upcoming.map((s, i) => `\`${start + i}.\` ${s.title}`).join('\n') 
                : "No more songs in this page.";
            const currentFormatted = formatTime(serverQueue.currentTimestamp);
            const totalMs = output.duration * 1000;
            const totalFormatted = formatTime(totalMs);
            const progressBar = createProgressBar(serverQueue.currentTimestamp, totalMs)
            return new EmbedBuilder()
                .setTitle("Now Playing 🎶")
                .setDescription(`**[${output.title}](${song.url})**\n${progressBar}`)
                .setThumbnail(output.thumbnail || null)
                .addFields(
                    { name: 'Duration', value: `\`${currentFormatted} / ${totalFormatted}\``, inline: true },
                    { name: 'Queue Size', value: `${serverQueue.songs.length} songs`, inline: true },
                    { name: `Upcoming (Page ${serverQueue.page + 1}):`, value: queueList }
                )
                .setColor("#00ff00");
            };
        const navRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('prev_page').setLabel('⬅️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('next_page').setLabel('➡️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('vol_up').setLabel('🔊⬆️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('vol_down').setLabel('🔉⬇️').setStyle(ButtonStyle.Secondary),
        );
        const musicRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('pause_resume').setLabel('⏸️/▶️').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('stop_music').setLabel('🛑').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('skip_song').setLabel('⏭️').setStyle(ButtonStyle.Secondary),
        );
        const sentMessage = await serverQueue.textChannel.send({ 
            embeds: [generateEmbed()], 
            components: [musicRow, navRow] 
        });
        serverQueue.lastMessage = sentMessage;
        const resource = createAudioResource(output.url, {
            inputType: StreamType.Arbitrary,
            inlineVolume: true,
            highWaterMark: 1024 * 1024 * 64, 
            ffmpegOptions: [        
                '-ss', String(Math.floor(serverQueue.currentTimestamp / 1000)),
                '-i', output.url,
                '-reconnect', '1',
                '-reconnect_streamed', '1',
                '-reconnect_delay_max', '1',
                '-analyzeduration', '0',
                '-loglevel', '0'
            ]
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
                } else {
                    await i.reply({ content: "End of queue reached.", flags: [MessageFlags.Ephemeral] });
                }
            } else if (i.customId === 'prev_page') {
                if (serverQueue.page > 0) {
                    serverQueue.page--;
                    await i.update({ embeds: [generateEmbed()] });
                } else {
                    await i.reply({ content: "First page reached.", flags: [MessageFlags.Ephemeral] });
                }
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
                await i.reply({ content: "Skipped ⏭️", ephemeral: true });
                collector.stop();
            } else if (i.customId === 'stop_music') {
                serverQueue.songs = [];
                serverQueue.isSkipping = true
                serverQueue.currentTimestamp = 0;
                serverQueue.player.stop();
                await i.reply({ content: "Stopped 🛑", flags: [MessageFlags.Ephemeral] });
                collector.stop();
            } else if (i.customId === 'vol_up' || i.customId === 'vol_down') {
                const currentRes = serverQueue.player.state.resource;
                if (currentRes && currentRes.volume) {
                    let vol = currentRes.volume.volume;
                    vol = i.customId === 'vol_up' ? Math.min(vol + 0.1, 2.0) : Math.max(vol - 0.1, 0.1);
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
                } else {
                    clearInterval(timer);
                }
            }, 1000);
        });
        serverQueue.player.once(AudioPlayerStatus.Idle, () => {
            collector.stop();
            const totalDurationMs = output.duration * 1000;
            if (serverQueue.isSkipping) {
                serverQueue.isSkipping = false;
                serverQueue.currentTimestamp = 0;
                serverQueue.songs.shift();
                return playSong(guildId);
            }
            if (serverQueue.currentTimestamp < totalDurationMs - 5000) {
                console.log(`Song cut out at ${serverQueue.currentTimestamp}ms. Resuming...`);
                return playSong(guildId);
            }
            serverQueue.currentTimestamp = 0;
            serverQueue.songs.shift();
            playSong(guildId);
        });
        serverQueue.player.once('error', error => {
            console.error(`Audio Player Error: ${error.message}`);
            serverQueue.currentTimestamp = 0;
            serverQueue.songs.shift();
            playSong(guildId);
        });
    } catch (error) {
        console.error("Playback Error:", error);
        serverQueue.currentTimestamp = 0;
        serverQueue.songs.shift();
        playSong(guildId);
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
function numtoemo(numbers) {
    return numbers.toString().replace(/1/g, ':one:').replace(/2/g, ':two:').replace(/3/g, ':three:').replace(/4/g, ':four:').replace(/5/g, ':five:').replace(/6/g, ':six:').replace(/7/g, ':seven:').replace(/8/g, ':eight:').replace(/9/g, ':nine:').replace(/0/g, ':zero:');
}

// Function to Calculate Xp
async function giveXp(interaction) {
    const xpToGive = getRandomNumber(1, 5);
    try {
        let result = await db.query("SELECT * FROM users WHERE userid = ?", [interaction.member.id]);
        const user = result[0][0];
        let newxp = Number(user.xp) + xpToGive;
        let calculatedlevel = 100 * Number(user.level);
        if (user.xp > calculatedlevel) {
            let xpleft = newxp - calculatedlevel;
            let newlevel = Number(user.level) + 1;
            let newbalance = user.balance + calculatedlevel;
            db.query('UPDATE users SET level = ?, xp = ?, balance = ? WHERE userid = ?', [newlevel, xpleft, newbalance, interaction.member.id]);
            interaction.channel.send(`${interaction.member} you have leveled up to **level ${newlevel}**`);
        } else {
            db.query('UPDATE users SET xp = ? WHERE userid = ?', [newxp, interaction.member.id]);
        }
    } catch (error) {
        console.log(`=-=GIVE=XP=ERROR=-= ${error}`);
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
        description: 'test'
    },
    {
        name: 'join',
        description: 'Joins the Voice Channel'
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
        name: 'queue',
        description: 'Displays the current music queue',
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
        name: 'towers',
        description: 'Play a Game of Towers',
        options: [
            {
                name: 'tower-choice',
                description: 'Choose Which tower you want to Advance to',
                type: ApplicationCommandOptionType.Number,
                required: true,
                choices: [
                    {
                        name: "Option 1",
                        value: 1
                    },
                    {
                        name: "Option 2",
                        value: 2
                    },
                    {
                        name: "Option 3",
                        value: 3
                    }
                ]
            },
            {
                name: 'bet-amount',
                description: 'Choose how much to bet (if you havent already started a Game)',
                type: ApplicationCommandOptionType.Number
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
        description: "Spin a Selection of SlotMachines",
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
        description: '60% chance to Collect 1-1000 every Minute'
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
        description: 'Collect 25000 Daily'
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
        GatewayIntentBits.GuildVoiceStates,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent  
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
client.once(Events.ClientReady, (readyClient) => {
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
                    name: "/join",
                    value: "Joins a Voice Channel",
                    inline: true
                },
                {
                    name: "/play",
                    value: "Play a Youtube or Spotify Song in the Music Player",
                    inline: true
                },
                {
                    name: "/queue",
                    value: "Shows the Current Music Queue",
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
                    value: "Gets you 25000💵 Daily\n60% chance to get 1-1000💵 every Minute",
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
                },
                {
                    name: "/towers",
                    value: "Play a Game of Towers",
                    inline: true
                },
                {
                    name: "/ai",
                    value: "Generate a response from Google Gemini",
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
        try{
            await interaction.deferReply();
            const userx = interaction.options.get('user')?.value;
            if (userx) {
                let result = await db.query("SELECT * FROM users WHERE userid = ?", [userx]);
                let user = result[0][0];
                if (!user) {
                    interaction.editReply('That user doesnt hasnt used this bot yet!')
                    return;
                }
                interaction.editReply(`Your balance is **${user.balance}💵**`);
            } else {
                let result = await db.query("SELECT * FROM users WHERE userid = ?", [interaction.member.id]);
                let user = result[0][0];
                if (!user) {
                    const currentDate = new Date().toDateString();
                    db.query('INSERT INTO users VALUES(?, ?, ?, ?, ?)', [interaction.member.id, 25000, currentDate, 0, 1]);
                    user.balance = 25000;
                }
                interaction.editReply(`Your balance is **${user.balance}💵**`);
            }
        } catch(error) {
            console.log("######"+error)
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
            const currentDate = new Date().toDateString();
            let result = await db.query("SELECT * FROM users WHERE userid = ?", [interaction.member.id]);
            let user = result[0][0];
            if (!user) {
                await db.query('INSERT INTO users VALUES(?, ?, ?, ?, ?)', [interaction.member.id, 25000, currentDate, 0, 1]);
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
            const currentDate = new Date().toDateString();
            let result = await db.query("SELECT * FROM users WHERE userid = ?", [interaction.member.id]);
            let user = result[0][0];
            if (!user) {
                await db.query('INSERT INTO users VALUES(?, ?, ?, ?, ?)', [interaction.member.id, 25000, currentDate, 0, 1]);
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
            const currentDate = new Date().toDateString();
            let result = await db.query("SELECT * FROM users WHERE userid = ?", [interaction.member.id]);
            let user = result[0][0];
            if (!user) {
                await db.query('INSERT INTO users VALUES(?, ?, ?, ?, ?)', [interaction.member.id, 25000, currentDate, 0, 1]);
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
            const currentDate = new Date().toDateString();
            let result = await db.query("SELECT * FROM users WHERE userid = ?", [interaction.member.id]);
            let user = result[0][0];
            if (!user) {
                await db.query('INSERT INTO users VALUES(?, ?, ?, ?, ?)', [interaction.member.id, 25000, currentDate, 0, 1]);
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
            const currentDate = new Date().toDateString();
            let result = await db.query("SELECT * FROM users WHERE userid = ?", [interaction.member.id]);
            let user = result[0][0];
            if (!user) {
                await db.query('INSERT INTO users VALUES(?, ?, ?, ?, ?)', [interaction.member.id, 25000, currentDate, 0, 1]);
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
            interaction.reply({
              content: 'You can only run this command inside a server.',
              flags: [MessageFlags.Ephemeral],
            });
            return;
        } try {
            await interaction.deferReply();
            const currentDate = new Date().toDateString();
            let result = await db.query("SELECT * FROM users WHERE userid = ?", [interaction.member.id]);
            let result1 = await db.query("SELECT * FROM cooldown WHERE userid = ?", [interaction.member.id]);
            let user = result[0][0];
            let cooldown = result1[0][0];
            if (!user) {
                db.query('INSERT INTO users VALUES(?, ?, ?, ?, ?)', [interaction.member.id, 25000, currentDate, 0, 1]);
                user = { userid: interaction.member.id, balance: 25000 };
            }
            if (!cooldown) {
                db.query('INSERT INTO cooldown VALUES(?, ?, ?)', [interaction.member.id, 'dig', Date.now()]);
                cooldown = { userid: interaction.member.id, command: 'dig', endsAt: Date.now() - 60000 };
            }
            if (Date.now() < cooldown.endsAt) {
                time = Math.round((cooldown.endsAt-Date.now())/1000);
                interaction.editReply({ content: `Try again in ${time} Seconds`, flags: [MessageFlags.Ephemeral] });
            } else {
                const digChance = getRandomNumber(0, 100);
                if (digChance < 40) {
                    interaction.editReply(`Nothing this time, Try again`);
                    let newcooldown = Date.now() + 60000;
                    db.query('UPDATE cooldown SET endsAt = ? WHERE userid = ?', [newcooldown, interaction.member.id]);
                } else {
                    const digAmount = getRandomNumber(1,1000);
                    let newcooldown = Date.now() + 60000;
                    let newbalance = user.balance+digAmount;
                    db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
                    db.query('UPDATE cooldown SET endsAt = ? WHERE userid = ?', [newcooldown, interaction.member.id]);
                    interaction.editReply({ content: `+${digAmount}💵\nYour new balance is\n${numtoemo(newbalance)}`, flags: [MessageFlags.Ephemeral] });
                }
            }
        } catch (error) {
            interaction.editReply(`Error with /dig ${error}`);
            console.log(`Error with /dig: ${error}`);
        }
    }

    if (interaction.commandName === 'daily') {
        try {
            await interaction.deferReply();
            const currentDate = new Date().toDateString();
            let result = await db.query("SELECT * FROM users WHERE userid = ?", [interaction.member.id]);
            let user = result[0][0];
            if (!user) {
                db.query('INSERT INTO users VALUES(?, ?, ?, ?, ?)', [interaction.member.id, 25000, currentDate, 0, 1]);
                interaction.editReply(`+$25000💵\nYour new balance is\n${numtoemo(25000)}`);
                return;
            }
            if (currentDate == user.daily) {
                interaction.editReply(`Try this command again tomarrow!`);
            } else {
                let newbalance = user.balance+25000
                db.query('UPDATE users SET balance = ?, daily = ? WHERE userid = ?', [newbalance, currentDate, interaction.member.id]);
                interaction.editReply(`+$25000💵\nYour new balance is\n${numtoemo(newbalance)}`);
            }
        } catch (error) {
            interaction.editReply(`Please try the Command Again`);
            console.log(`Error with /daily: ${error}`);
        }
    }

    if (interaction.commandName === "level") {
        try {
            await interaction.deferReply();
            const userx = interaction.options.get('user')?.value;
            if (userx) {
                let result = await db.query("SELECT * FROM users WHERE userid = ?", [userx]);
                let user = result[0][0];
                if (!user) {
                    interaction.editReply('That user doesnt hasnt interacted in the server yet!');
                    return;
                }
                let [alllevels] = await db.query("select * from users");
                alllevels.sort((a, b) => {
                    if (a.level === b.level) {
                    return b.xp - a.xp;
                    } else {
                    return b.level - a.level;
                    }
                });
                let currentRank = alllevels.findIndex((lvl) => String(lvl.userid) === String(userx)) + 1;
                const targetUserObj = await interaction.guild.members.fetch(userx);
                const rank = new canvacord.Rank()
                    .setAvatar(targetUserObj.user.displayAvatarURL({ size: 256 }))
                    .setRank(currentRank)
                    .setLevel(Number(user.level))
                    .setCurrentXP(Number(user.xp))
                    .setRequiredXP(100 * Number(user.level))
                    .setProgressBar('#FF0069', 'COLOR')
                    .setUsername(targetUserObj.user.username)
                    .setBackground("COLOR", "PINK");
                const data = await rank.build();
                const attachment = new AttachmentBuilder(data);
                interaction.editReply({ files: [attachment] });
            } else {
                let result = await db.query("SELECT * FROM users WHERE userid = ?", [interaction.member.id]);
                let user = result[0][0];
                if (!user) {
                    const currentDate = new Date().toDateString();
                    db.query('INSERT INTO users VALUES(?, ?, ?, ?, ?)', [interaction.member.id, 25000, currentDate, 0, 1]);
                    user = {};
                }
                let [alllevels] = await db.query("select * from users");
                alllevels.sort((a, b) => {
                    if (a.level === b.level) {
                    return b.xp - a.xp;
                    } else {
                    return b.level - a.level;
                    }
                });
                let currentRank = alllevels.findIndex((lvl) => String(lvl.userid) === String(interaction.member.id)) + 1;
                const targetUserObj = await interaction.guild.members.fetch(interaction.member.id);
                const rank = new canvacord.Rank()
                    .setAvatar(targetUserObj.user.displayAvatarURL({ size: 256 }))
                    .setRank(currentRank)
                    .setLevel(Number(user.level))
                    .setCurrentXP(Number(user.xp))
                    .setRequiredXP(100 * Number(user.level))
                    .setProgressBar('#FF0069', 'COLOR')
                    .setUsername(targetUserObj.user.username)
                    .setBackground("COLOR", "PINK");
                const data = await rank.build();
                const attachment = new AttachmentBuilder(data);
                interaction.editReply({ files: [attachment] });
            }
        } catch (error) {
            interaction.editReply(`Please try the Command Again`);
            console.log(`=-=ERROR=-= ${error}`);
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
            const currentDate = new Date().toDateString();
            let result = await db.query("SELECT * FROM users WHERE userid = ?", [interaction.member.id]);
            let result1 = await db.query("SELECT * FROM hilow WHERE userid = ?", [interaction.member.id]);
            let user = result[0][0];
            let game = result1[0][0];
            if (!user) {
                await db.query('INSERT INTO users VALUES(?, ?, ?, ?, ?)', [interaction.member.id, 25000, currentDate, 0, 1]);
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
            const currentDate = new Date().toDateString();
            let result = await db.query("SELECT * FROM users WHERE userid = ?", [interaction.member.id]);
            let result1 = await db.query("SELECT * FROM hilow WHERE userid = ?", [interaction.member.id]);
            let user = result[0][0];
            let game = result1[0][0];
            if (!user) {
                await db.query('INSERT INTO users VALUES(?, ?, ?, ?, ?)', [interaction.member.id, 25000, currentDate, 0, 1]);
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
            interaction.reply({
                content: 'You can only run this command inside a server.',
                flags: [MessageFlags.Ephemeral],
            });
            return;
        } try {
            await interaction.deferReply();
            const currentDate = new Date().toDateString();
            let result = await db.query("SELECT * FROM users WHERE userid = ?", [interaction.member.id]);
            let user = result[0][0];
            if (!user) {
                await db.query('INSERT INTO users VALUES(?, ?, ?, ?, ?)', [interaction.member.id, 25000, currentDate, 0, 1]);
                user = { userid: interaction.member.id, balance: 25000 };
            }
            const bet = interaction.options.get('bet-amount').value;
            if (bet >= 1000) {
                giveXp(interaction);
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
                                let newbalance = user.balance + bet;
                                await db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
                                interaction.editReply(`🔥<${roulette}>🔥 +${bet}💵\nYour new balance is\n${numtoemo(newbalance)}`);
                            } else {
                                let newbalance = user.balance - bet;
                                await db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
                                interaction.editReply(`😭<${roulette}>😭 -${bet}💵\nYour new balance is\n${numtoemo(newbalance)}`);
                            }
                        } else {
                            if (spin === redAmount) {
                                let newbalance = user.balance + bet * 11;
                                await db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
                                interaction.editReply(`🔥<${spin}>🔥 +${bet*11}💵\nX11 WIN!!!\nYour new balance is\n${numtoemo(newbalance)}`);
                            } else {
                                let newbalance = user.balance - bet;
                                await db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
                                interaction.editReply(`😭<${spin}>😭 -${bet}💵\nBetter Luck Next Time!\nYour new balance is\n${numtoemo(newbalance)}`);
                            }
                        }
                    }
                } else {
                    if (blackAmount) {
                        if (blackAmount === 420) {
                            const blackNumbers = [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35];
                            const roulette = getRandomNumber(1,36);
                            if (blackNumbers.includes(roulette)) {
                                let newbalance = user.balance + bet;
                                await db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
                                interaction.editReply(`🔥<${roulette}>🔥 +${bet}💵\nYour new balance is\n${numtoemo(newbalance)}`);
                            } else {
                                let newbalance = user.balance - bet;
                                await db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
                                interaction.editReply(`😭<${roulette}>😭 -${bet}💵\nYour new balance is\n${numtoemo(newbalance)}`);
                            }
                        } else {
                            if (spin === blackAmount) {
                                let newbalance = user.balance + bet * 11;
                                await db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
                                interaction.editReply(`🔥<${spin}>🔥 +${bet*11}💵\nX11 WIN!!!\nYour new balance is\n${numtoemo(newbalance)}`);
                            } else {
                                let newbalance = user.balance - bet;
                                await db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
                                interaction.editReply(`😭<${spin}>😭 -${bet}💵\nBetter Luck Next Time!\nYour new balance is\n${numtoemo(newbalance)}`);
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
                flags: [MessageFlags.Ephemeral],
            });
            return;
        } try {
            await interaction.deferReply();
            const currentDate = new Date().toDateString();
            let result = await db.query("SELECT * FROM users WHERE userid = ?", [interaction.member.id]);
            let user = result[0][0];
            if (!user) {
                await db.query('INSERT INTO users VALUES(?, ?, ?, ?, ?)', [interaction.member.id, 25000, currentDate, 0, 1]);
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
            interaction.reply({
                content: 'You can only run this command inside a server.',
                flags: [MessageFlags.Ephemeral],
            });
            return;
        } try {
            await interaction.deferReply();
            const currentDate = new Date().toDateString();
            let result = await db.query("SELECT * FROM users WHERE userid = ?", [interaction.member.id]);
            let user = result[0][0];
            if (!user) {
                await db.query('INSERT INTO users VALUES(?, ?, ?, ?, ?)', [interaction.member.id, 25000, currentDate, 0, 1]);
                user = { userid: interaction.member.id, balance: 25000 };
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
            if (bet >= 1000) {
                giveXp(interaction);
            }
            if (user.balance >= bet && bet >= 10) {
                const raNumber = getRandomNumber(1,1000);
                if (hl === 1) {
                    let odds = getOdds(hl, number);
                    interaction.editReply(`${odds}`);
                    if (raNumber === odds.number) {
                        if (raNumber < 100) {
                            interaction.editReply(`⏹️⏹️⏹️⏹️⏹️\n⏹️⏹️${numtoemo(raNumber)}⬆️Higher\n⏹️⏹️${numtoemo(odds.number)}⬅️Your Number\n⏹️⏹️⏹️⏹️⏹️\n-0💵`);
                            return;
                        } else {
                            interaction.editReply(`⏹️⏹️⏹️⏹️⏹️\n⏹️${numtoemo(raNumber)}⬆️Higher\n⏹️${numtoemo(odds.number)}⬅️Your Number\n⏹️⏹️⏹️⏹️⏹️\n-0💵`);
                            return;
                        }
                    }
                    if (raNumber < odds.number) {
                        let newbalance = user.balance + Math.trunc(bet*odds.win);
                        await db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
                        if (raNumber < 100) {
                            if (odds.number < 100) {
                                interaction.editReply(`⏹️⏹️⏹️⏹️⏹️\n⏹️⏹️${numtoemo(raNumber)}⬆️Higher\n⏹️⏹️${numtoemo(odds.number)}⬅️Your Number\n⏹️⏹️⏹️⏹️⏹️\n🔥+${Math.trunc(bet*odds.win)}💵\nYour new balance is\n${numtoemo(user.balance+Math.trunc(bet*odds.win))}💵`);
                            } else {
                                interaction.editReply(`⏹️⏹️⏹️⏹️⏹️\n⏹️⏹️${numtoemo(raNumber)}⬆️Higher\n⏹️${numtoemo(odds.number)}⬅️Your Number\n⏹️⏹️⏹️⏹️⏹️\n🔥+${Math.trunc(bet*odds.win)}💵\nYour new balance is\n${numtoemo(user.balance+Math.trunc(bet*odds.win))}💵`);
                            }
                        }
                        if (odds.number < 100) {
                            interaction.editReply(`⏹️⏹️⏹️⏹️⏹️\n⏹️${numtoemo(raNumber)}⬆️Higher\n⏹️⏹️${numtoemo(odds.number)}⬅️Your Number\n⏹️⏹️⏹️⏹️⏹️\n🔥+${Math.trunc(bet*odds.win)}💵\nYour new balance is\n${numtoemo(user.balance+Math.trunc(bet*odds.win))}💵`);
                        } else {
                            interaction.editReply(`⏹️⏹️⏹️⏹️⏹️\n⏹️${numtoemo(raNumber)}⬆️Higher\n⏹️${numtoemo(odds.number)}⬅️Your Number\n⏹️⏹️⏹️⏹️⏹️\n🔥+${Math.trunc(bet*odds.win)}💵\nYour new balance is\n${numtoemo(user.balance+Math.trunc(bet*odds.win))}💵`);
                        }
                    } else {
                        let newbalance = user.balance - bet * 11;
                        await db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
                        if (raNumber < 100) {
                            if (odds.number < 100) {
                                interaction.editReply(`⏹️⏹️⏹️⏹️⏹️\n⏹️⏹️${numtoemo(raNumber)}⬆️Higher\n⏹️⏹️${numtoemo(odds.number)}⬅️Your Number\n⏹️⏹️⏹️⏹️⏹️\n-${bet}💵\nYour new balance is\n${numtoemo(user.balance-bet)}💵`);
                            } else {
                                interaction.editReply(`⏹️⏹️⏹️⏹️⏹️\n⏹️⏹️${numtoemo(raNumber)}⬆️Higher\n⏹️${numtoemo(odds.number)}⬅️Your Number\n⏹️⏹️⏹️⏹️⏹️\n-${bet}💵\nYour new balance is\n${numtoemo(user.balance-bet)}💵`);
                            }
                        }
                        if (odds.number < 100) {
                            interaction.editReply(`⏹️⏹️⏹️⏹️⏹️\n⏹️${numtoemo(raNumber)}⬆️Higher\n⏹️⏹️${numtoemo(odds.number)}⬅️Your Number\n⏹️⏹️⏹️⏹️⏹️\n-${bet}💵\nYour new balance is\n${numtoemo(user.balance-bet)}💵`);
                        } else {
                            interaction.editReply(`⏹️⏹️⏹️⏹️⏹️\n⏹️${numtoemo(raNumber)}⬆️Higher\n⏹️${numtoemo(odds.number)}⬅️Your Number\n⏹️⏹️⏹️⏹️⏹️\n-${bet}💵\nYour new balance is\n${numtoemo(user.balance-bet)}💵`);
                        }
                    }
                } else {
                    let odds = getOdds(hl ,number);
                    interaction.editReply(`${odds}`);
                    if (raNumber === odds.number) {
                        if (raNumber < 100) {
                            interaction.editReply(`⏹️⏹️⏹️⏹️⏹️\n⏹️⏹️${numtoemo(raNumber)}⬇️Lower\n⏹️⏹️${numtoemo(odds.number)}⬅️Your Number\n⏹️⏹️⏹️⏹️⏹️\n-0💵`);
                            return;
                        } else {
                            interaction.editReply(`⏹️⏹️⏹️⏹️⏹️\n⏹️${numtoemo(raNumber)}⬇️Lower\n⏹️${numtoemo(odds.number)}⬅️Your Number\n⏹️⏹️⏹️⏹️⏹️\n-0💵`);
                            return;
                        }
                    }
                    if (raNumber > odds.number) {
                        let newbalance = user.balance + Math.trunc(bet*odds.win);
                        await db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
                        if (raNumber < 100) {
                            if (odds.number < 100) {
                                interaction.editReply(`⏹️⏹️⏹️⏹️⏹️\n⏹️⏹️${numtoemo(raNumber)}⬇️Lower\n⏹️⏹️${numtoemo(odds.number)}⬅️Your Number\n⏹️⏹️⏹️⏹️⏹️\n🔥+${Math.trunc(bet*odds.win)}💵\nYour new balance is\n${numtoemo(user.balance+Math.trunc(bet*odds.win))}💵`);
                            } else {
                                interaction.editReply(`⏹️⏹️⏹️⏹️⏹️\n⏹️⏹️${numtoemo(raNumber)}⬇️Lower\n⏹️${numtoemo(odds.number)}⬅️Your Number\n⏹️⏹️⏹️⏹️⏹️\n🔥+${Math.trunc(bet*odds.win)}💵\nYour new balance is\n${numtoemo(user.balance+Math.trunc(bet*odds.win))}💵`);
                            }
                        }
                        if (odds.number < 100) {
                            interaction.editReply(`⏹️⏹️⏹️⏹️⏹️\n⏹️${numtoemo(raNumber)}⬇️Lower\n⏹️⏹️${numtoemo(odds.number)}⬅️Your Number\n⏹️⏹️⏹️⏹️⏹️\n🔥+${Math.trunc(bet*odds.win)}💵\nYour new balance is\n${numtoemo(user.balance+Math.trunc(bet*odds.win))}💵`);
                        } else {
                            interaction.editReply(`⏹️⏹️⏹️⏹️⏹️\n⏹️${numtoemo(raNumber)}⬇️Lower\n⏹️${numtoemo(odds.number)}⬅️Your Number\n⏹️⏹️⏹️⏹️⏹️\n🔥+${Math.trunc(bet*odds.win)}💵\nYour new balance is\n${numtoemo(user.balance+Math.trunc(bet*odds.win))}💵`);
                        }
                    } else {
                        let newbalance = user.balance - bet;
                        await db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
                        if (raNumber < 100) {
                            if (odds.number < 100) {
                                interaction.editReply(`⏹️⏹️⏹️⏹️⏹️\n⏹️⏹️${numtoemo(raNumber)}⬇️Lower\n⏹️⏹️${numtoemo(odds.number)}⬅️Your Number\n⏹️⏹️⏹️⏹️⏹️\n-${bet}💵\nYour new balance is\n${numtoemo(user.balance-bet)}💵`);
                            } else {
                                interaction.editReply(`⏹️⏹️⏹️⏹️⏹️\n⏹️⏹️${numtoemo(raNumber)}⬇️Lower\n⏹️${numtoemo(odds.number)}⬅️Your Number\n⏹️⏹️⏹️⏹️⏹️\n-${bet}💵\nYour new balance is\n${numtoemo(user.balance-bet)}💵`);
                            }
                        }
                        if (odds.number < 100) {
                            interaction.editReply(`⏹️⏹️⏹️⏹️⏹️\n⏹️${numtoemo(raNumber)}⬇️Lower\n⏹️⏹️${numtoemo(odds.number)}⬅️Your Number\n⏹️⏹️⏹️⏹️⏹️\n-${bet}💵\nYour new balance is\n${numtoemo(user.balance-bet)}💵`);
                        } else {
                            interaction.editReply(`⏹️⏹️⏹️⏹️⏹️\n⏹️${numtoemo(raNumber)}⬇️Lower\n⏹️${numtoemo(odds.number)}⬅️Your Number\n⏹️⏹️⏹️⏹️⏹️\n-${bet}💵\nYour new balance is\n${numtoemo(user.balance-bet)}💵`);
                        }
                    }
                }
            } else {
                interaction.editReply(`Minimum bet of 10 for this Game\nYour balance is\n${numtoemo(user.balance)}💵`);
            }
        } catch (error) {
            interaction.editReply(`Please try the Command Again`);
            console.log(`Error with /hashdice: ${error}`);
        }
    }

    if (interaction.commandName === "towers") {
        if (!interaction.inGuild()) {
            interaction.reply({
                content: 'You can only run this command inside a server.',
                flags: [MessageFlags.Ephemeral],
            });
            return;
        } try {
            await interaction.deferReply();
            const currentDate = new Date().toDateString();
            let result = await db.query("SELECT * FROM users WHERE userid = ?", [interaction.member.id]);
            let result2 = await db.query("SELECT * FROM towers WHERE userid = ?", [interaction.member.id]);
            let user = result[0][0];
            let game = result2[0][0];
            if (!user) {
                await db.query('INSERT INTO users VALUES(?, ?, ?, ?, ?)', [interaction.member.id, 25000, currentDate, 0, 1]);
                user = { userid: interaction.member.id, balance: 25000 };
            }
            if (!game) {
                await db.query('INSERT INTO towers VALUES(?, ?, ?, ?, ?, ?, ?, ?)', [interaction.member.id, 0, 0, 1, 1, 1, 1, 1]);
                game = { userid: interaction.member.id, status: 0, bet: 0, item1: 1, item2: 1, item3: 1, item4: 1, item5: 1};
            }
            const bet = interaction.options.get('bet-amount')?.value;
            const endGame = interaction.options.get('game-end')?.value;
            const tower = interaction.options.get('tower-choice').value;
            if (Number(game.status) === 0) {
                if (!bet) {
                    interaction.editReply(`Please choose a bet amount`);
                    return;
                }
                if (endGame) {
                    interaction.editReply(`You can only end the game on or after the Third Level`);
                    return;
                }
                if (bet >= 1000) {
                    giveXp(interaction);
                }
                if (user.balance >= bet && bet >= 1) {
                    r1 = getRandomNumber(1,3);
                    r2 = getRandomNumber(1,3);
                    r3 = getRandomNumber(1,3);
                    r4 = getRandomNumber(1,3);
                    r5 = getRandomNumber(1,3);
                    let newbalance = user.balance - bet;
                    await db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
                    game.item1 = r1;
                    game.item2 = r2;
                    game.item3 = r3;
                    game.item4 = r4;
                    game.item5 = r5;
                    if (tower === r1) {
                        await db.query('UPDATE towers SET status = ? WHERE userid = ?', [0, interaction.member.id]);
                        if (tower === 1) {
                            interaction.editReply(`❌⭕⭕\n-${bet}\nYour New balance is\n${numtoemo(newbalance)}`);
                            return;
                        }
                        if (tower === 2) {
                            interaction.editReply(`⭕❌⭕\n-${bet}\nYour New balance is\n${numtoemo(newbalance)}`);
                            return;
                        } else {
                            interaction.editReply(`⭕⭕❌\n-${bet}\nYour New balance is\n${numtoemo(newbalance)}`);
                            return;
                        }
                    } else {
                        await db.query('UPDATE towers SET status = ?, bet = ? WHERE userid = ?', [2, bet, interaction.member.id]);
                        if (Number(game.item1) === 1) {
                            interaction.editReply(`❌⭕⭕`);
                            return;
                        }
                        if (Number(game.item1) === 2) {
                            interaction.editReply(`⭕❌⭕`);
                            return;
                        } else {
                            interaction.editReply(`⭕⭕❌`);
                            return;
                        }
                    }
                } else {
                    interaction.editReply(`Your balance is ${user.balance}💵`);
                }
            } else {
                if (bet) {
                    interaction.editReply(`You dont need to choose a bet once the game has been started.\nPlease Retry without a bet amount until the game has been finished`);
                } else {
                    if (Number(game.status) === 2) {
                        if (endGame) {
                            interaction.editReply(`You can only end the game on or after the Third Level`);
                            return;
                        }
                        if (tower === Number(game.item2)){
                            await db.query('UPDATE towers SET status = ?, bet = ? WHERE userid = ?', [0, 0, interaction.member.id]);
                            if (Number(game.item1) === 1) {
                                if (Number(game.item2) === 1) {
                                    interaction.editReply(`❌⭕⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                    return;
                                }
                                if (Number(game.item2) === 2) {
                                    interaction.editReply(`⭕❌⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                } else {
                                    interaction.editReply(`⭕⭕❌\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                }
                                return;
                            }
                            if (Number(game.item1) === 2) {
                                if (Number(game.item2) === 1) {
                                    interaction.editReply(`❌⭕⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                    return;
                                }
                                if (Number(game.item2) === 2) {
                                    interaction.editReply(`⭕❌⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                } else {
                                    interaction.editReply(`⭕⭕❌\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                }
                            } else {
                                if (Number(game.item2) === 1) {
                                    interaction.editReply(`❌⭕⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                    return;
                                }
                                if (Number(game.item2) === 2) {
                                    interaction.editReply(`⭕❌⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                } else {
                                    interaction.editReply(`⭕⭕❌\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                }
                            }
                        } else {
                            await db.query('UPDATE towers SET status = ? WHERE userid = ?', [3, interaction.member.id]);
                            if (Number(game.item1) === 1) {
                                if (Number(game.item2) === 1) {
                                    interaction.editReply(`❌⭕⭕\n❌⭕⭕`);
                                    return;
                                }
                                if (Number(game.item2) === 2) {
                                    interaction.editReply(`⭕❌⭕\n❌⭕⭕`);
                                } else {
                                    interaction.editReply(`⭕⭕❌\n❌⭕⭕`);
                                }
                                return;
                            }
                            if (Number(game.item1) === 2) {
                                if (Number(game.item2) === 1) {
                                    interaction.editReply(`❌⭕⭕\n⭕❌⭕`);
                                    return;
                                }
                                if (Number(game.item2) === 2) {
                                    interaction.editReply(`⭕❌⭕\n⭕❌⭕`);
                                } else {
                                    interaction.editReply(`⭕⭕❌\n⭕❌⭕`);
                                }
                            } else {
                                if (Number(game.item2) === 1) {
                                    interaction.editReply(`❌⭕⭕\n⭕⭕❌`);
                                    return;
                                }
                                if (Number(game.item2) === 2) {
                                    interaction.editReply(`⭕❌⭕\n⭕⭕❌`);
                                } else {
                                    interaction.editReply(`⭕⭕❌\n⭕⭕❌`);
                                }
                            }
                        }
                        return;
                    }
                    if (Number(game.status) === 3) {
                        if (tower === Number(game.item3)) {
                            await db.query('UPDATE towers SET status = ?, bet = ? WHERE userid = ?', [0, 0, interaction.member.id]);
                            if (Number(game.item1) === 1) {
                                if (Number(game.item2) === 1) {
                                    if (Number(game.item3) === 1) {
                                        interaction.editReply(`❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        return;
                                    }
                                    if (Number(game.item3) === 2) {
                                        interaction.editReply(`⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                    } else {
                                        interaction.editReply(`⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                    }
                                }
                                if (Number(game.item2) === 2) {
                                    if (Number(game.item3) === 1) {
                                        interaction.editReply(`❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                    }
                                    if (Number(game.item3) === 2) {
                                        interaction.editReply(`⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                    } else {
                                        interaction.editReply(`⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                    }
                                } else {
                                    if (Number(game.item3) === 1) {
                                        interaction.editReply(`❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                    }
                                    if (Number(game.item3) === 2) {
                                        interaction.editReply(`⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                    } else {
                                        interaction.editReply(`⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                    }
                                }
                            }
                            if (Number(game.item1) === 2) {
                                if (Number(game.item2) === 1) {
                                    if (Number(game.item3) === 1) {
                                        interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                    }
                                    if (Number(game.item3) === 2) {
                                        interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                    } else {
                                        interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                    }
                                }
                                if (Number(game.item2) === 2) {
                                    if (Number(game.item3) === 1) {
                                        interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                    }
                                    if (Number(game.item3) === 2) {
                                        interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                    } else {
                                        interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                    }
                                } else {
                                    if (Number(game.item3) === 1) {
                                        interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                    }
                                    if (Number(game.item3) === 2) {
                                        interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                    } else {
                                        interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                    }
                                }
                            } else {
                                if (Number(game.item2) === 1) {
                                    if (Number(game.item3) === 1) {
                                        interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                    }
                                    if (Number(game.item3) === 2) {
                                        interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                    } else {
                                        interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                    }
                                }
                                if (Number(game.item2) === 2) {
                                    if (Number(game.item3) === 1) {
                                        interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                    }
                                    if (Number(game.item3) === 2) {
                                        interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                    } else {
                                        interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                    }
                                } else {
                                    if (Number(game.item3) === 1) {
                                        interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                    }
                                    if (Number(game.item3) === 2) {
                                        interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                    } else {
                                        interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                    }
                                }
                            }
                            return;
                        } else {
                            if (endGame) {
                                let newbalance = user.balance + Number(game.bet) * 2;
                                await db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
                                await db.query('UPDATE towers SET status = ?, bet = ? WHERE userid = ?', [0, 0, interaction.member.id]);
                                if (Number(game.item1) === 1) {
                                    if (Number(game.item2) === 1) {
                                        if (Number(game.item3) === 1) {
                                            interaction.editReply(`❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n+${Number(game.bet)*2}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*2)}`);
                                        }
                                        if (Number(game.item3) === 2) {
                                            interaction.editReply(`⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n+${Number(game.bet)*2}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*2)}`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n+${Number(game.bet)*2}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*2)}`);
                                        }
                                    }
                                    if (Number(game.item2) === 2) {
                                        if (Number(game.item3) === 1) {
                                            interaction.editReply(`❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n+${Number(game.bet)*2}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*2)}`);
                                        }
                                        if (Number(game.item3) === 2) {
                                            interaction.editReply(`⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n+${Number(game.bet)*2}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*2)}`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n+${Number(game.bet)*2}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*2)}`);
                                        }
                                    } else {
                                        if (Number(game.item3) === 1) {
                                            interaction.editReply(`❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n+${Number(game.bet)*2}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*2)}`);
                                        }
                                        if (Number(game.item3) === 2) {
                                            interaction.editReply(`⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n+${Number(game.bet)*2}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*2)}`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n+${Number(game.bet)*2}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*2)}`);
                                        }
                                    }
                                }
                                if (Number(game.item1) === 2) {
                                    if (Number(game.item2) === 1) {
                                        if (Number(game.item3) === 1) {
                                            interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n+${Number(game.bet)*2}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*2)}`);
                                        }
                                        if (Number(game.item3) === 2) {
                                            interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n+${Number(game.bet)*2}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*2)}`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n+${Number(game.bet)*2}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*2)}`);
                                        }
                                    }
                                    if (Number(game.item2) === 2) {
                                        if (Number(game.item3) === 1) {
                                            interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n+${Number(game.bet)*2}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*2)}`);
                                        }
                                        if (Number(game.item3) === 2) {
                                            interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n+${Number(game.bet)*2}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*2)}`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n+${Number(game.bet)*2}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*2)}`);
                                        }
                                    } else {
                                        if (Number(game.item3) === 1) {
                                            interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n+${Number(game.bet)*2}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*2)}`);
                                        }
                                        if (Number(game.item3) === 2) {
                                            interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n+${Number(game.bet)*2}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*2)}`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n+${Number(game.bet)*2}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*2)}`);
                                        }
                                    }
                                } else {
                                    if (Number(game.item2) === 1) {
                                        if (Number(game.item3) === 1) {
                                            interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n+${Number(game.bet)*2}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*2)}`);
                                        }
                                        if (Number(game.item3) === 2) {
                                            interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n+${Number(game.bet)*2}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*2)}`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n+${Number(game.bet)*2}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*2)}`);
                                        }
                                    }
                                    if (Number(game.item2) === 2) {
                                        if (Number(game.item3) === 1) {
                                            interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n+${Number(game.bet)*2}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*2)}`);
                                        }
                                        if (Number(game.item3) === 2) {
                                            interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n+${Number(game.bet)*2}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*2)}`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n+${Number(game.bet)*2}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*2)}`);
                                        }
                                    } else {
                                        if (Number(game.item3) === 1) {
                                            interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n+${Number(game.bet)*2}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*2)}`);
                                        }
                                        if (Number(game.item3) === 2) {
                                            interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n+${Number(game.bet)*2}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*2)}`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n+${Number(game.bet)*2}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*2)}`);
                                        }
                                    }
                                }
                                return;
                            } else {
                                await db.query('UPDATE towers SET status = ? WHERE userid = ?', [4, interaction.member.id]);
                                if (Number(game.item1) === 1) {
                                    if (Number(game.item2) === 1) {
                                        if (Number(game.item3) === 1) {
                                            interaction.editReply(`❌⭕⭕\n❌⭕⭕\n❌⭕⭕`);
                                        }
                                        if (Number(game.item3) === 2) {
                                            interaction.editReply(`⭕❌⭕\n❌⭕⭕\n❌⭕⭕`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n❌⭕⭕\n❌⭕⭕`);
                                        }
                                    }
                                    if (Number(game.item2) === 2) {
                                        if (Number(game.item3) === 1) {
                                            interaction.editReply(`❌⭕⭕\n⭕❌⭕\n❌⭕⭕`);
                                        }
                                        if (Number(game.item3) === 2) {
                                            interaction.editReply(`⭕❌⭕\n⭕❌⭕\n❌⭕⭕`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n⭕❌⭕\n❌⭕⭕`);
                                        }
                                    } else {
                                        if (Number(game.item3) === 1) {
                                            interaction.editReply(`❌⭕⭕\n⭕⭕❌\n❌⭕⭕`);
                                        }
                                        if (Number(game.item3) === 2) {
                                            interaction.editReply(`⭕❌⭕\n⭕⭕❌\n❌⭕⭕`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n⭕⭕❌\n❌⭕⭕`);
                                        }
                                    }
                                }
                                if (Number(game.item1) === 2) {
                                    if (Number(game.item2) === 1) {
                                        if (Number(game.item3) === 1) {
                                            interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕❌⭕`);
                                        }
                                        if (Number(game.item3) === 2) {
                                            interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕❌⭕`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕❌⭕`);
                                        }
                                    }
                                    if (Number(game.item2) === 2) {
                                        if (Number(game.item3) === 1) {
                                            interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕❌⭕`);
                                        }
                                        if (Number(game.item3) === 2) {
                                            interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕❌⭕`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕❌⭕`);
                                        }
                                    } else {
                                        if (Number(game.item3) === 1) {
                                            interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕❌⭕`);
                                        }
                                        if (Number(game.item3) === 2) {
                                            interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕❌⭕`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕❌⭕`);
                                        }
                                    }
                                } else {
                                    if (Number(game.item2) === 1) {
                                        if (Number(game.item3) === 1) {
                                            interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕⭕❌`);
                                        }
                                        if (Number(game.item3) === 2) {
                                            interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕⭕❌`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕⭕❌`);
                                        }
                                    }
                                    if (Number(game.item2) === 2) {
                                        if (Number(game.item3) === 1) {
                                            interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕⭕❌`);
                                        }
                                        if (Number(game.item3) === 2) {
                                            interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕⭕❌`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕⭕❌`);
                                        }
                                    } else {
                                        if (Number(game.item3) === 1) {
                                            interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕⭕❌`);
                                        }
                                        if (Number(game.item3) === 2) {
                                            interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕⭕❌`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕⭕❌`);
                                        }
                                    }
                                }
                                return;
                            }
                        }
                    }
                    if (Number(game.status) === 4) {
                        if (tower === Number(game.item4)) {
                            await db.query('UPDATE towers SET status = ?, bet = ? WHERE userid = ?', [0, 0, interaction.member.id]);
                            if (Number(game.item1) === 1){
                                if (Number(game.item2) === 1) {
                                    if (Number(game.item3) === 1) {
                                        if (Number(game.item4) === 1) {
                                            interaction.editReply(`❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                        if (Number(game.item4) === 2) {
                                            interaction.editReply(`⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                    }
                                    if (Number(game.item3) === 2) {
                                        if (Number(game.item4) === 1) {
                                            interaction.editReply(`❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                        if (Number(game.item4) === 2) {
                                            interaction.editReply(`⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                    } else {
                                        if (Number(game.item4) === 1) {
                                            interaction.editReply(`❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                        if (Number(game.item4) === 2) {
                                            interaction.editReply(`⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                    }
                                }
                                if (Number(game.item2) === 2) {
                                    if (Number(game.item3) === 1) {
                                        if (Number(game.item4) === 1) {
                                            interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                        if (Number(game.item4) === 2) {
                                            interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                    }
                                    if (Number(game.item3) === 2) {
                                        if (Number(game.item4) === 1) {
                                            interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                        if (Number(game.item4) === 2) {
                                            interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                    } else {
                                        if (Number(game.item4) === 1) {
                                            interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                        if (Number(game.item4) === 2) {
                                            interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                    }
                                } else {
                                    if (Number(game.item3) === 1) {
                                        if (Number(game.item4) === 1) {
                                            interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                        if (Number(game.item4) === 2) {
                                            interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                    }
                                    if (Number(game.item3) === 2) {
                                        if (Number(game.item4) === 1) {
                                            interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                        if (Number(game.item4) === 2) {
                                            interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                    } else {
                                        if (Number(game.item4) === 1) {
                                            interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                        if (Number(game.item4) === 2) {
                                            interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                    }
                                }
                            }
                            if (Number(game.item1) === 2) {
                                if (Number(game.item2) === 1) {
                                    if (Number(game.item3) === 1) {
                                        if (Number(game.item4) === 1) {
                                            interaction.editReply(`❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                        if (Number(game.item4) === 2) {
                                            interaction.editReply(`⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                    }
                                    if (Number(game.item3) === 2) {
                                        if (Number(game.item4) === 1) {
                                            interaction.editReply(`❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                        if (Number(game.item4) === 2) {
                                            interaction.editReply(`⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                    } else {
                                        if (Number(game.item4) === 1) {
                                            interaction.editReply(`❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                        if (Number(game.item4) === 2) {
                                            interaction.editReply(`⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                    }
                                }
                                if (Number(game.item2) === 2) {
                                    if (Number(game.item3) === 1) {
                                        if (Number(game.item4) === 1) {
                                            interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                        if (Number(game.item4) === 2) {
                                            interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                    }
                                    if (Number(game.item3) === 2) {
                                        if (Number(game.item4) === 1) {
                                            interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                        if (Number(game.item4) === 2) {
                                            interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                    } else {
                                        if (Number(game.item4) === 1) {
                                            interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                        if (Number(game.item4) === 2) {
                                            interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                    }
                                } else {
                                    if (Number(game.item3) === 1) {
                                        if (Number(game.item4) === 1) {
                                            interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                        if (Number(game.item4) === 2) {
                                            interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                    }
                                    if (Number(game.item3) === 2) {
                                        if (Number(game.item4) === 1) {
                                            interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                        if (Number(game.item4) === 2) {
                                            interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                    } else {
                                        if (Number(game.item4) === 1) {
                                            interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                        if (Number(game.item4) === 2) {
                                            interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                    }
                                }
                            } else {
                                if (Number(game.item2) === 1) {
                                    if (Number(game.item3) === 1) {
                                        if (Number(game.item4) === 1) {
                                            interaction.editReply(`❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                        if (Number(game.item4) === 2) {
                                            interaction.editReply(`⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                    }
                                    if (Number(game.item3) === 2) {
                                        if (Number(game.item4) === 1) {
                                            interaction.editReply(`❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                        if (Number(game.item4) === 2) {
                                            interaction.editReply(`⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                    } else {
                                        if (Number(game.item4) === 1) {
                                            interaction.editReply(`❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                        if (Number(game.item4) === 2) {
                                            interaction.editReply(`⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                    }
                                }
                                if (Number(game.item2) === 2) {
                                    if (Number(game.item3) === 1) {
                                        if (Number(game.item4) === 1) {
                                            interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                        if (Number(game.item4) === 2) {
                                            interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                    }
                                    if (Number(game.item3) === 2) {
                                        if (Number(game.item4) === 1) {
                                            interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                        if (Number(game.item4) === 2) {
                                            interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                    } else {
                                        if (Number(game.item4) === 1) {
                                            interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                        if (Number(game.item4) === 2) {
                                            interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                    }
                                } else {
                                    if (Number(game.item3) === 1) {
                                        if (Number(game.item4) === 1) {
                                            interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                        if (Number(game.item4) === 2) {
                                            interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                    }
                                    if (Number(game.item3) === 2) {
                                        if (Number(game.item4) === 1) {
                                            interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                        if (Number(game.item4) === 2) {
                                            interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                    } else {
                                        if (Number(game.item4) === 1) {
                                            interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                        if (Number(game.item4) === 2) {
                                            interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        } else {
                                            interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                        }
                                    }
                                }
                            }
                            return;
                        } else {
                            if (endGame) {
                                let newbalance = user.balance + Number(game.bet) * 3;
                                await db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
                                await db.query('UPDATE towers SET status = ?, bet = ? WHERE userid = ?', [0, 0, interaction.member.id]);
                                if (Number(game.item1) === 1){
                                    if (Number(game.item2) === 1) {
                                        if (Number(game.item3) === 1) {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                        }
                                        if (Number(game.item3) === 2) {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                        } else {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                        }
                                    }
                                    if (Number(game.item2) === 2) {
                                        if (Number(game.item3) === 1) {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                        }
                                        if (Number(game.item3) === 2) {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                        } else {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                        }
                                    } else {
                                        if (Number(game.item3) === 1) {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                        }
                                        if (Number(game.item3) === 2) {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                        } else {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                        }
                                    }
                                }
                                if (Number(game.item1) === 2) {
                                    if (Number(game.item2) === 1) {
                                        if (Number(game.item3) === 1) {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                        }
                                        if (Number(game.item3) === 2) {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                        } else {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                        }
                                    }
                                    if (Number(game.item2) === 2) {
                                        if (Number(game.item3) === 1) {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                        }
                                        if (Number(game.item3) === 2) {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                        } else {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                        }
                                    } else {
                                        if (Number(game.item3) === 1) {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                        }
                                        if (Number(game.item3) === 2) {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                        } else {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                        }
                                    }
                                } else {
                                    if (Number(game.item2) === 1) {
                                        if (Number(game.item3) === 1) {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                        }
                                        if (Number(game.item3) === 2) {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                        } else {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                        }
                                    }
                                    if (Number(game.item2) === 2) {
                                        if (Number(game.item3) === 1) {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                        }
                                        if (Number(game.item3) === 2) {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                        } else {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                        }
                                    } else {
                                        if (Number(game.item3) === 1) {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                        }
                                        if (Number(game.item3) === 2) {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                        } else {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n+${Number(game.bet)*3}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*3)}`);
                                            }
                                        }
                                    }
                                }
                                return;
                            } else {
                                await db.query('UPDATE towers SET status = ? WHERE userid = ?', [5, interaction.member.id]);
                                if (Number(game.item1) === 1){
                                    if (Number(game.item2) === 1) {
                                        if (Number(game.item3) === 1) {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕`);
                                            }
                                        }
                                        if (Number(game.item3) === 2) {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕`);
                                            }
                                        } else {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕`);
                                            }
                                        }
                                    }
                                    if (Number(game.item2) === 2) {
                                        if (Number(game.item3) === 1) {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕`);
                                            }
                                        }
                                        if (Number(game.item3) === 2) {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕`);
                                            }
                                        } else {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕`);
                                            }
                                        }
                                    } else {
                                        if (Number(game.item3) === 1) {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕`);
                                            }
                                        }
                                        if (Number(game.item3) === 2) {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕`);
                                            }
                                        } else {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕`);
                                            }
                                        }
                                    }
                                }
                                if (Number(game.item1) === 2) {
                                    if (Number(game.item2) === 1) {
                                        if (Number(game.item3) === 1) {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕`);
                                            }
                                        }
                                        if (Number(game.item3) === 2) {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕`);
                                            }
                                        } else {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕`);
                                            }
                                        }
                                    }
                                    if (Number(game.item2) === 2) {
                                        if (Number(game.item3) === 1) {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕`);
                                            }
                                        }
                                        if (Number(game.item3) === 2) {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕`);
                                            }
                                        } else {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕`);
                                            }
                                        }
                                    } else {
                                        if (Number(game.item3) === 1) {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕`);
                                            }
                                        }
                                        if (Number(game.item3) === 2) {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕`);
                                            }
                                        } else {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕`);
                                            }
                                        }
                                    }
                                } else {
                                    if (Number(game.item2) === 1) {
                                        if (Number(game.item3) === 1) {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌`);
                                            }
                                        }
                                        if (Number(game.item3) === 2) {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌`);
                                            }
                                        } else {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌`);
                                            }
                                        }
                                    }
                                    if (Number(game.item2) === 2) {
                                        if (Number(game.item3) === 1) {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌`);
                                            }
                                        }
                                        if (Number(game.item3) === 2) {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌`);
                                            }
                                        } else {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌`);
                                            }
                                        }
                                    } else {
                                        if (Number(game.item3) === 1) {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌`);
                                            }
                                        }
                                        if (Number(game.item3) === 2) {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌`);
                                            }
                                        } else {
                                            if (Number(game.item4) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌`);
                                            }
                                            if (Number(game.item4) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌`);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        return;
                    }
                    if (Number(game.status) === 5) {
                        if (tower === Number(game.item5)) {
                            await db.query('UPDATE towers SET status = ?, bet = ? WHERE userid = ?', [0, 0, interaction.member.id]);
                            if (Number(game.item1) === 1) {
                                if (Number(game.item2) === 1) {
                                    if (Number(game.item3) === 1) {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                        if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                    }
                                    if (Number(game.item3) === 2) {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                        if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                    } else {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                        if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                    }
                                }
                                if (Number(game.item2) === 2) {
                                    if (Number(game.item3) === 1) {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                        if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                    }
                                    if (Number(game.item3) === 2) {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                        if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                    } else {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                        if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                    }
                                } else {
                                    if (Number(game.item3) === 1) {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                        if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                    }
                                    if (Number(game.item3) === 2) {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                        if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                    } else {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                        if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                    }
                                }
                            }
                            if (Number(game.item1) === 2) {
                                if (Number(game.item2) === 1) {
                                    if (Number(game.item3) === 1) {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                        if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                    }
                                    if (Number(game.item3) === 2) {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                        if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                    } else {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                        if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                    }
                                }
                                if (Number(game.item2) === 2) {
                                    if (Number(game.item3) === 1) {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                        if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                    }
                                    if (Number(game.item3) === 2) {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                        if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                    } else {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                        if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                    }
                                } else {
                                    if (Number(game.item3) === 1) {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                        if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                    }
                                    if (Number(game.item3) === 2) {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                        if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                    } else {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                        if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                    }
                                }
                            } else {
                                if (Number(game.item2) === 1) {
                                    if (Number(game.item3) === 1) {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                        if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                    }
                                    if (Number(game.item3) === 2) {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                        if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                    } else {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                        if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                    }
                                }
                                if (Number(game.item2) === 2) {
                                    if (Number(game.item3) === 1) {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                        if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                    }
                                    if (Number(game.item3) === 2) {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                        if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                    } else {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                        if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                    }
                                } else {
                                    if (Number(game.item3) === 1) {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                        if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                    }
                                    if (Number(game.item3) === 2) {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                        if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                    } else {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                        if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                            if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n-${game.bet}\nYour New balance is\n${numtoemo(user.balance-Number(game.bet))}`);
                                            }
                                        }
                                    }
                                }
                            }
                            return;
                        } else {
                            let newbalance = user.balance + Number(game.bet) * 5;
                            await db.query('UPDATE users SET balance = ? WHERE userid = ?', [newbalance, interaction.member.id]);
                            await db.query('UPDATE towers SET status = ?, bet = ? WHERE userid = ?', [0, 0, interaction.member.id]);
                            if (Number(game.item1) === 1) {
                                if (Number(game.item2) === 1) {
                                    if (Number(game.item3) === 1) {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        }
                                    } else if (Number(game.item3) === 2) {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        }
                                    } else {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        }
                                    }
                                } else if (Number(game.item2) === 2) {
                                    if (Number(game.item3) === 1) {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        }
                                    } else if (Number(game.item3) === 2) {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        }
                                    } else {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        }
                                    }
                                } else {
                                    if (Number(game.item3) === 1) {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        }
                                    } else if (Number(game.item3) === 2) {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        }
                                    } else {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        }
                                    }
                                }
                            } else if (Number(game.item1) === 2) {
                                if (Number(game.item2) === 1) {
                                    if (Number(game.item3) === 1) {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        }
                                    } else if (Number(game.item3) === 2) {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        }
                                    } else {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        }
                                    }
                                } else if (Number(game.item2) === 2) {
                                    if (Number(game.item3) === 1) {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        }
                                    } else if (Number(game.item3) === 2) {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        }
                                    } else {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        }
                                    }
                                } else {
                                    if (Number(game.item3) === 1) {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        }
                                    } else if (Number(game.item3) === 2) {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        }
                                    } else {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        }
                                    }
                                }
                            } else {
                                if (Number(game.item2) === 1) {
                                    if (Number(game.item3) === 1) {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        }
                                    } else if (Number(game.item3) === 2) {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        }
                                    } else {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        }
                                    }
                                } else if (Number(game.item2) === 2) {
                                    if (Number(game.item3) === 1) {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        }
                                    } else if (Number(game.item3) === 2) {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        }
                                    } else {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        }
                                    }
                                } else {
                                    if (Number(game.item3) === 1) {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        }
                                    } else if (Number(game.item3) === 2) {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        }
                                    } else {
                                        if (Number(game.item4) === 1) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else if (Number(game.item4) === 2) {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        } else {
                                            if (Number(game.item5) === 1) {
                                                interaction.editReply(`❌⭕⭕\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else if (Number(game.item5) === 2) {
                                                interaction.editReply(`⭕❌⭕\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            } else {
                                                interaction.editReply(`⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n⭕⭕❌\n+${Number(game.bet)*5}\nYour New balance is\n${numtoemo(user.balance+Number(game.bet)*5)}`);
                                            }
                                        }
                                    }
                                }
                            }
                            return;
                        }
                    }
                }
            }
        } catch (error) {
            interaction.editReply(`Please try the Command Again`);
            console.log(`Error with /towers: ${error}`);
        }
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

    if (interaction.commandName === "join") {
        const channel = interaction.member.voice.channel;
        if (!channel) return interaction.reply({
            content: 'Join a voice channel first!',
            flags: [MessageFlags.Ephemeral]
        });
        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
        });
        const timer = setTimeout(() => {
            const conn = getVoiceConnection(interaction.guildId);
            if (conn) conn.destroy();
            musictimers.delete(interaction.guildId);
            musicqueues.delete(interaction.guildId);
        }, 300000);
        musictimers.set(interaction.guildId, timer);
        await interaction.reply({
            content: `Joined ${channel.name}`,
            flags: [MessageFlags.Ephemeral]
        });
    }
    
    if (interaction.commandName === "play") {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        const query = interaction.options.getString('search');
        const guildId = interaction.guildId;
        let songsToAdd = [];
        const existingTimer = musictimers.get(guildId);
        if (existingTimer) {
            clearTimeout(existingTimer);
            musictimers.delete(guildId);
        } try {
            if (query.includes('spotify.com')) {
                let searchTerms = [];
                try {
                    if (query.includes('/playlist/') || query.includes('/album/')) {
                        const tracks = await getTracks(query);
                        searchTerms = tracks.map(t => {
                            const name = t.name || t.title;
                            const artistName = t.artists?.[0]?.name || t.artist || ""; 
                            return `${name} ${artistName}`.trim();
                        }).filter(term => term.length > 0);
                        await interaction.editReply(`Processing **${searchTerms.length}** Spotify tracks...`);
                    } else {
                        const data = await getDetails(query);
                        const name = data.preview?.title || data.title;
                        const artist = data.preview?.artist || data.artists?.[0]?.name || "";
                        searchTerms.push(`${name} ${artist}`.trim());
                    }
                    for (const term of searchTerms) {
                        try {
                            const output = await ytdl(term, {
                                dumpSingleJson: true,
                                defaultSearch: 'ytsearch1:',
                                noWarnings: true,
                                format: 'bestaudio',
                            });
                            const videoData = output.entries ? output.entries[0] : output;
                            if (videoData) {
                                songsToAdd.push({
                                    title: videoData.title,
                                    url: videoData.webpage_url || videoData.url
                                });
                            }
                        } catch (e) {
                            console.error(`Failed to find YouTube version for: ${term}`);
                        }
                    }
                } catch (err) {
                    console.error("Spotify Metadata Error:", err);
                    return interaction.editReply("Failed to get Spotify data. Ensure the link is public.");
                }
            } else {
                const output = await ytdl(query, {
                    dumpSingleJson: true,
                    noWarnings: true,
                    flatPlaylist: true,
                    format: 'bestaudio/best',
                    defaultSearch: 'ytsearch1:' 
                });
                if (output.entries && output.entries.length > 0) {
                    songsToAdd = output.entries.map(entry => ({
                        title: entry.title,
                        url: entry.url || entry.webpage_url
                    }));
                } else {
                    songsToAdd.push({
                        title: output.title,
                        url: output.url || output.webpage_url
                    });
                }
            }
            if (songsToAdd.length === 0) return interaction.editReply("Could not find any songs.");
            let serverQueue = musicqueues.get(guildId);
            if (!serverQueue) {
                const player = createAudioPlayer({
                    behaviors: { noSubscriber: NoSubscriberBehavior.Play }
                });
                const connection = getVoiceConnection(guildId);
                if (connection) {
                    connection.subscribe(player);
                    connection.on('stateChange', (oldState, newState) => {
                        if (oldState.status === VoiceConnectionStatus.Ready && newState.status === VoiceConnectionStatus.Connecting) {
                            connection.configureNetworking();
                        }
                    });
                }
                serverQueue = {
                    songs: songsToAdd,
                    player: player,
                    textChannel: interaction.channel,
                    lastMessage: null,
                    currentTimestamp: 0,
                    isSkipping: false,
                    page: 0
                };
                musicqueues.set(guildId, serverQueue);
                playSong(guildId);
                const msg = songsToAdd.length > 1 
                    ? `Added **${songsToAdd.length}** songs to queue.` 
                    : `Now playing: **${songsToAdd[0].title}**`;
                await interaction.editReply(msg);
            } else {
                serverQueue.songs.push(...songsToAdd);
                if (serverQueue.player.state.status === AudioPlayerStatus.Idle) {
                    const connection = getVoiceConnection(guildId);
                    if (connection) connection.subscribe(serverQueue.player);
                    playSong(guildId);
                }
                const msg = songsToAdd.length > 1 
                    ? `Added **${songsToAdd.length}** songs to queue.` 
                    : `Added **${songsToAdd[0].title}** to queue!`;
                await interaction.editReply(msg);
            }
        } catch (error) {
            console.error("Play Command Error:", error);
            await interaction.editReply("Failed to load music. Check the link or try again.");
        }
    }

    if (interaction.commandName === "queue") {
        const serverQueue = musicqueues.get(interaction.guildId);
        if (!serverQueue || serverQueue.songs.length === 0) {
            return interaction.reply({
                content: "The queue is currently empty.",
                flags: [MessageFlags.Ephemeral]
            });
        }
        const currentSong = serverQueue.songs[0];
        const upcoming = serverQueue.songs.slice(1, 11);
        const embed = new EmbedBuilder()
            .setTitle(`Queue for ${interaction.guild.name}`)
            .setColor('#0099ff')
            .addFields(
                { name: 'Now Playing', value: `🎶 **${currentSong.title}**` }
            );
        if (upcoming.length > 0) {
            const list = upcoming.map((song, index) => `${index + 1}. ${song.title}`).join('\n');
            embed.addFields({ name: 'Upcoming', value: list });
        }
        if (serverQueue.songs.length > 11) {
            embed.setFooter({ text: `...and ${serverQueue.songs.length - 11} more songs` });
        }
        return interaction.reply({ 
                embeds: [embed],
                flags: [MessageFlags.Ephemeral]
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
                const url = interaction.options.get('url').value;
                let yt_info = await play.video_basic_info(url);
                console.log(yt_info)
                await interaction.reply("-"+yt_info);
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

    if (message.content === "ff0069") {
        await db.query('UPDATE users SET balance = ? WHERE userid = ?', [25000, message.member.id]);
        message.reply("Balance has been reset to 25000");
    }

    if (message.content.slice(0, 14) === "https://x.com/") {
        try{
            if (message.author.id === process.env.CLIENT_ID) {
                return;
            }
            let replacement = "https://fixupx.com/"+message.content.slice(14, 150);
            message.reply({
                content: replacement
            })
            await message.delete();
            message.delete().catch(error => {
            if (error.code !== 10008) { 
                console.error('Failed to delete the message:', error);
                return;
                }
            });
        } catch(error) {
            console.log("######"+error)
        }
    }

    if (message.content.slice(0, 26) === "https://www.instagram.com/") {
        try{
            if (message.author.id === process.env.CLIENT_ID) {
                return;
            }
            let replacement = "https://eeinstagram.com/"+message.content.slice(26, 150);
            message.reply({
                content: replacement
            })
            await message.delete();
            message.delete().catch(error => {
            if (error.code !== 10008) { 
                console.error('Failed to delete the message:', error);
                return;
                }
            });
        } catch(error) {
            console.log("######"+error)
        }
    }

    if (message.content.slice(0, 23) === "https://www.reddit.com/") {
        try{
            if (message.author.id === process.env.CLIENT_ID) {
                return;
            }
            let replacement = "https://redditez.com/"+message.content.slice(23, 150);
            message.reply({
                content: replacement
            })
            await message.delete();
            message.delete().catch(error => {
            if (error.code !== 10008) { 
                console.error('Failed to delete the message:', error);
                return;
                }
            });
        } catch(error) {
            console.log("######"+error)
        }
    }

    if (message.content.slice(0, 23) === "https://www.tiktok.com/") {
        try{
            if (message.author.id === process.env.CLIENT_ID) {
                return;
            }
            let replacement = "https://tiktokez.com/"+message.content.slice(23, 150);
            message.reply({
                content: replacement
            })
            await message.delete();
            message.delete().catch(error => {
            if (error.code !== 10008) { 
                console.error('Failed to delete the message:', error);
                return;
                }
            });
        } catch(error) {
            console.log("######"+error)
        }
    }

    if (message.content.slice(0, 25) === "https://www.facebook.com/") {
        try{
            if (message.author.id === process.env.CLIENT_ID) {
                return;
            }
            let replacement = "https://facebed.com/"+message.content.slice(25, 150);
            message.reply({
                content: replacement
            })
            await message.delete();
            message.delete().catch(error => {
            if (error.code !== 10008) { 
                console.error('Failed to delete the message:', error);
                return;
                }
            });
        } catch(error) {
            console.log("######"+error)
        }
    }

});
