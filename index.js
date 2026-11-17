const http = require('http');
http.createServer((req, res) => { res.write('Bot is Alive!'); res.end(); }).listen(process.env.PORT || 3000);

const { Client, GatewayIntentBits, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const PREFIX = '!';
const STAFF_ROLE_ID = 'ضع_ايدي_رتبة_الستاف_هنا';
const BAN_ROLE_ID = '1571860618368122962';
const KICK_ROLE_ID = '1571863048866500711';
const TIMEOUT_ROLE_ID = '1571868429189906524';
const WARN_ROLE_ID = '1571868552980467792';

const DB_FILE = './staff_points.json';
const warns = new Map();
const voiceSessions = new Map();

const getDb = () => { if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, '{}'); return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); };
const saveDb = d => fs.writeFileSync(DB_FILE, JSON.stringify(d, null, 2));
const ensure = (d, id) => { if (!d[id]) d[id] = { msgs: 0, voiceMins: 0 }; };

client.once('ready', () => {
    console.log(`✅ بوت الإدارة ونقاط الستاف يعمل: ${client.user.tag}`);
    let lastResetDate = '';
    setInterval(() => {
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
        const todayStr = now.toDateString();
        if (now.getDay() === 5 && now.getHours() === 0 && now.getMinutes() === 0 && lastResetDate !== todayStr) {
            lastResetDate = todayStr;
            saveDb({});
        }
    }, 30000);
});

client.on('voiceStateUpdate', (oldState, newState) => {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot || !member.roles.cache.has(STAFF_ROLE_ID)) return;
    const uid = member.id;
    const isInValidVoice = newState.channelId && !newState.selfDeaf && !newState.serverDeaf && newState.channelId !== newState.guild.afkChannelId;

    if (isInValidVoice && !voiceSessions.has(uid)) {
        voiceSessions.set(uid, Date.now());
    } else if (!isInValidVoice && voiceSessions.has(uid)) {
        const mins = Math.floor((Date.now() - voiceSessions.get(uid)) / 60000);
        voiceSessions.delete(uid);
        if (mins > 0) { const db = getDb(); ensure(db, uid); db[uid].voiceMins += mins; saveDb(db); }
    }
});

client.on('messageCreate', async msg => {
    if (msg.author.bot || !msg.guild) return;

    if (msg.member.roles.cache.has(STAFF_ROLE_ID) && !msg.content.startsWith(PREFIX)) {
        const db = getDb(); ensure(db, msg.author.id); db[msg.author.id].msgs += 1; saveDb(db);
    }

    if (!msg.content.startsWith(PREFIX)) return;
    const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    if (cmd === 'نقاطي' || cmd === 'points' || cmd === 'نقاط') {
        const target = msg.mentions.members.first() || msg.member;
        const db = getDb(); ensure(db, target.id);
        let curMins = voiceSessions.has(target.id) ? Math.floor((Date.now() - voiceSessions.get(target.id)) / 60000) : 0;
        const totalMsgs = db[target.id].msgs, totalMins = db[target.id].voiceMins + curMins;
        const chatPts = totalMsgs / 100, voicePts = totalMins / 100;
        const emb = new EmbedBuilder().setTitle(`📊 نقاط الترقيات — ${target.user.username}`).setColor('#F1C40F')
            .addFields(
                { name: '🏆 الإجمالي', value: `**${(chatPts + voicePts).toFixed(2)}** نقطة` },
                { name: '💬 الشات', value: `**${totalMsgs}** رسالة (${chatPts.toFixed(2)})`, inline: true },
                { name: '🎙️ الفويس', value: `**${totalMins}** دقيقة (${voicePts.toFixed(2)})`, inline: true }
            );
        return msg.reply({ embeds: [emb] });
    }

    if (cmd === 'تصفير' || cmd === 'resetpoints') {
        if (!msg.member.permissions.has(PermissionFlagsBits.Administrator)) return msg.reply('❌ للإدارة العليا فقط.');
        saveDb({}); return msg.reply('🔄 تم تصفير جميع نقاط الستاف.');
    }

    if (cmd === 'مسح' || cmd === 'clear') {
        if (!msg.member.permissions.has(PermissionFlagsBits.Administrator)) return msg.reply('❌ لـ Administrator فقط.');
        const count = parseInt(args);
        if (isNaN(count) || count < 1 || count > 100) return msg.reply('⚠️ اكتب عدداً بين 1 و 100.');
        await msg.channel.bulkDelete(count, true).catch(() => {});
        const m = await msg.channel.send(`🧹 تم مسح **${count}** رسالة.`);
        return setTimeout(() => m.delete().catch(() => {}), 3000);
    }

    if (cmd === 'قفل' || cmd === 'lock') {
        if (!msg.member.permissions.has(PermissionFlagsBits.Administrator)) return msg.reply('❌ لـ Administrator فقط.');
        await msg.channel.permissionOverwrites.edit(msg.guild.id, { SendMessages: false });
        return msg.reply('🔒 تم قفل الروم.');
    }
    if (cmd === 'فتح' || cmd === 'unlock') {
        if (!msg.member.permissions.has(PermissionFlagsBits.Administrator)) return msg.reply('❌ لـ Administrator فقط.');
        await msg.channel.permissionOverwrites.edit(msg.guild.id, { SendMessages: true });
        return msg.reply('🔓 تم فتح الروم.');
    }

    const target = msg.mentions.members.first();
    if (['بان', 'ban', 'كيك', 'kick', 'تايم', 'timeout', 'فك_تايم', 'untimeout', 'تحذير', 'warn', 'تحذيرات', 'warns'].includes(cmd)) {
        if (!target) return msg.reply('⚠️ منشن العضو أولاً!');
        if (target.id === msg.author.id) return msg.reply('❌ لا يمكنك تطبيق الأمر على نفسك!');
    }

    if (cmd === 'بان' || cmd === 'ban') {
        if (!msg.member.roles.cache.has(BAN_ROLE_ID) && msg.author.id !== msg.guild.ownerId) return msg.reply('❌ مخصص لرتبة البان فقط.');
        if (!target.bannable) return msg.reply('❌ لا يمكن حظر هذا العضو.');
        await target.ban({ reason: args.slice(1).join(' ') || 'مخالفة القوانين' });
        return msg.reply(`🔨 تم حظر **${target.user.tag}**.`);
    }
    if (cmd === 'كيك' || cmd === 'kick') {
        if (!msg.member.roles.cache.has(KICK_ROLE_ID) && msg.author.id !== msg.guild.ownerId) return msg.reply('❌ مخصص لرتبة الكيك فقط.');
        if (!target.kickable) return msg.reply('❌ لا يمكن طرد هذا العضو.');
        await target.kick(); return msg.reply(`👢 تم طرد **${target.user.tag}**.`);
    }
    if (cmd === 'تايم' || cmd === 'timeout') {
        if (!msg.member.roles.cache.has(TIMEOUT_ROLE_ID) && msg.author.id !== msg.guild.ownerId) return msg.reply('❌ مخصص لرتبة التايم فقط.');
        if (!target.moderatable) return msg.reply('❌ تعذر إعطاء تايم أوت.');
        const mins = parseInt(args) || parseInt(args) || 5;
        await target.timeout(mins * 60 * 1000);
        return msg.reply(`⏳ تم إعطاء ${target} تايم أوت لمدة **${mins}** دقيقة.`);
    }
    if (cmd === 'فك_تايم' || cmd === 'untimeout') {
        if (!msg.member.roles.cache.has(TIMEOUT_ROLE_ID) && msg.author.id !== msg.guild.ownerId) return msg.reply('❌ مخصص لرتبة التايم فقط.');
        await target.timeout(null); return msg.reply(`🔊 تم فك التايم أوت عن ${target}.`);
    }
    if (cmd === 'تحذير' || cmd === 'warn') {
        if (!msg.member.roles.cache.has(WARN_ROLE_ID) && msg.author.id !== msg.guild.ownerId) return msg.reply('❌ مخصص لرتبة التحذيرات فقط.');
        const cur = (warns.get(target.id) || 0) + 1; warns.set(target.id, cur);
        if (cur >= 3 && target.moderatable) await target.timeout(3600000).catch(() => {});
        return msg.reply(`⚠️ تم تحذير ${target} (التحذير رقم **${cur}**).`);
    }
    if (cmd === 'تحذيرات' || cmd === 'warns') {
        return msg.reply(`📋 تحذيرات **${target.user.tag}**: **${warns.get(target.id) || 0}**`);
    }
});

process.on('unhandledRejection', err => console.log('❌ خطأ:', err.message));
process.on('uncaughtException', err => console.log('❌ خطأ:', err.message));

client.login(process.env.TOKEN);
