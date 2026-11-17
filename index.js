const { Client, GatewayIntentBits, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers]
});

const PREFIX = '!';
const warns = new Map();

client.once('ready', () => console.log(`✅ بوت الإدارة يعمل: ${client.user.tag}`));

client.on('messageCreate', async msg => {
    if (msg.author.bot || !msg.guild || !msg.content.startsWith(PREFIX)) return;

    const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    // 1. مسح الرسائل: !مسح 20
    if (cmd === 'مسح' || cmd === 'clear') {
        if (!msg.member.permissions.has(PermissionFlagsBits.ManageMessages)) return msg.reply('❌ ليس لديك صلاحية.');
        const count = parseInt(args);
        if (isNaN(count) || count < 1 || count > 100) return msg.reply('⚠️ اكتب عدداً بين 1 و 100.');
        await msg.channel.bulkDelete(count, true).catch(() => {});
        const m = await msg.channel.send(`🧹 تم مسح **${count}** رسالة.`);
        return setTimeout(() => m.delete().catch(() => {}), 3000);
    }

    // 2. قفل وفتح الروم: !قفل / !فتح
    if (cmd === 'قفل' || cmd === 'lock') {
        if (!msg.member.permissions.has(PermissionFlagsBits.ManageChannels)) return msg.reply('❌ ليس لديك صلاحية.');
        await msg.channel.permissionOverwrites.edit(msg.guild.id, { SendMessages: false });
        return msg.reply('🔒 تم قفل الروم بنجاح.');
    }
    if (cmd === 'فتح' || cmd === 'unlock') {
        if (!msg.member.permissions.has(PermissionFlagsBits.ManageChannels)) return msg.reply('❌ ليس لديك صلاحية.');
        await msg.channel.permissionOverwrites.edit(msg.guild.id, { SendMessages: true });
        return msg.reply('🔓 تم فتح الروم بنجاح.');
    }

    const target = msg.mentions.members.first();
    if (['بان', 'ban', 'كيك', 'kick', 'تايم', 'timeout', 'فك_تايم', 'untimeout', 'تحذير', 'warn', 'تحذيرات', 'warns'].includes(cmd)) {
        if (!target) return msg.reply('⚠️ منشن العضو المطلوب أولاً!');
        if (target.id === msg.author.id) return msg.reply('❌ لا يمكنك تطبيق الأمر على نفسك!');
    }

    // 3. البان والكيك
    if (cmd === 'بان' || cmd === 'ban') {
        if (!msg.member.permissions.has(PermissionFlagsBits.BanMembers) || !target.bannable) return msg.reply('❌ لا يمكن حظر هذا العضو.');
        const reason = args.slice(1).join(' ') || 'مخالفة القوانين';
        await target.ban({ reason });
        return msg.reply(`🔨 تم حظر **${target.user.tag}** | السبب: **${reason}**`);
    }
    if (cmd === 'كيك' || cmd === 'kick') {
        if (!msg.member.permissions.has(PermissionFlagsBits.KickMembers) || !target.kickable) return msg.reply('❌ لا يمكن طرد هذا العضو.');
        await target.kick();
        return msg.reply(`👢 تم طرد **${target.user.tag}** من السيرفر.`);
    }

    // 4. التايم أوت وفكه
    if (cmd === 'تايم' || cmd === 'timeout') {
        if (!msg.member.permissions.has(PermissionFlagsBits.ModerateMembers) || !target.moderatable) return msg.reply('❌ تعذر إعطاء تايم أوت.');
        const mins = parseInt(args) || 5;
        await target.timeout(mins * 60 * 1000);
        return msg.reply(`⏳ تم إعطاء ${target} تايم أوت لمدة **${mins}** دقيقة.`);
    }
    if (cmd === 'فك_تايم' || cmd === 'untimeout') {
        if (!msg.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return msg.reply('❌ ليس لديك صلاحية.');
        await target.timeout(null);
        return msg.reply(`🔊 تم فك التايم أوت عن ${target}.`);
    }

    // 5. التحذيرات
    if (cmd === 'تحذير' || cmd === 'warn') {
        if (!msg.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return msg.reply('❌ ليس لديك صلاحية.');
        const current = (warns.get(target.id) || 0) + 1;
        warns.set(target.id, current);
        if (current >= 3 && target.moderatable) await target.timeout(3600000).catch(() => {});
        return msg.reply(`⚠️ تم تحذير ${target} (التحذير رقم **${current}**)${current >= 3 ? '\n🚨 **تم إعطاؤه تايم أوت ساعة تلقائياً!**' : ''}`);
    }
    if (cmd === 'تحذيرات' || cmd === 'warns') {
        return msg.reply(`📋 تحذيرات **${target.user.tag}**: **${warns.get(target.id) || 0}** تحذير.`);
    }
});

client.login(process.env.TOKEN);
