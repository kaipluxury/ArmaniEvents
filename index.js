const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Events } = require('discord.js');
const schedule = require('node-schedule');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// CONFIG from Environment
const TAG_ROLE_ID = process.env.TAG_ROLE_ID;
const VIEW_ROLE_ID = process.env.VIEW_ROLE_ID;
const BANNER_URL = 'https://chat.openai.com/c/armani_banner.gif';

const CHANNELS = {
  'Informal': '1279094572672356453',
  'RP Ticket Factory - PRIORITY': '1284521475788902443',
  'Biz War - PRIORITY': '1279095872537497723',
  'Shopping Center': '1279095972076716092'
};

const registeredPlayers = {};
const messageTracker = [];

// Scheduled events (5 mins early)
const events = [
  ...Array.from({ length: 24 }, (_, i) => {
    const hour = (i + 4) % 24;
    return ['Informal', `${hour.toString().padStart(2, '0')}:40`];
  }),
  ['RP Ticket Factory - PRIORITY', '10:30'],
  ['RP Ticket Factory - PRIORITY', '16:30'],
  ['RP Ticket Factory - PRIORITY', '22:30'],
  ['Biz War - PRIORITY', '01:05'],
  ['Biz War - PRIORITY', '19:05'],
  ['Shopping Center', '17:15']
];

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  for (const [eventName, exactTime] of events) {
    const [hour, minute] = exactTime.split(':').map(Number);
    const eventDate = new Date();
    eventDate.setUTCHours(hour, minute - 5, 0, 0);
    const scheduleRule = {
      hour: eventDate.getUTCHours(),
      minute: eventDate.getUTCMinutes(),
      tz: 'Europe/London'
    };

    const channelId = CHANNELS[eventName];
    if (!channelId) continue;

    schedule.scheduleJob(scheduleRule, async () => {
      const channel = await client.channels.fetch(channelId);
      sendEvent(channel, eventName, exactTime);
    });
  }

  // Daily cleanup at 05:00 UK
  schedule.scheduleJob({ hour: 5, minute: 0, tz: 'Europe/London' }, async () => {
    for (const msg of messageTracker) {
      try {
        const channel = await client.channels.fetch(msg.channelId);
        const message = await channel.messages.fetch(msg.messageId);
        await message.delete();
      } catch (e) {
        console.log("❌ Message already deleted or not found.");
      }
    }
    messageTracker.length = 0;
    Object.keys(registeredPlayers).forEach(e => registeredPlayers[e] = []);
    console.log("✅ Daily cleanup complete.");
  });
});

async function sendEvent(channel, eventName, startTime) {
  const embed = new EmbedBuilder()
    .setTitle(getEventIcon(eventName) + " " + eventName)
    .setDescription(
      `⏰ **Starts In**: 5 minutes (InGame Time)\n` +
      `🕒 **Exact Start Time**: ${startTime} (InGame Time)\n\n` +
      `React using the buttons below to register for this event:\n` +
      `• ✅ Join — Add your name to the list\n` +
      `• ❌ Leave — Remove yourself if not joining\n` +
      `• 📋 View — Only for Event Managers`
    )
    .setColor('#000000')
    .setFooter({ text: 'Armani Family | Made By Kai' })
    .setImage(BANNER_URL);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`join_${eventName}`).setLabel('✅ Join').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`leave_${eventName}`).setLabel('❌ Leave').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`view_${eventName}`).setLabel('📋 Registered Players').setStyle(ButtonStyle.Primary)
  );

  const sent = await channel.send({ content: `<@&${TAG_ROLE_ID}>`, embeds: [embed], components: [row] });
  messageTracker.push({ channelId: sent.channel.id, messageId: sent.id });

  if (!registeredPlayers[eventName]) registeredPlayers[eventName] = [];
}

// Button + /test interaction
client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isChatInputCommand() && interaction.commandName === 'test') {
    const eventName = "Test Event";
    const startTime = "10:00";
    const channel = interaction.channel;

    const embed = new EmbedBuilder()
      .setTitle("🧪 Test Event")
      .setDescription(
        `⏰ **Starts In**: 5 minutes (InGame Time)\n` +
        `🕒 **Exact Start Time**: ${startTime} (InGame Time)\n\n` +
        `React using the buttons below to register for this event:\n` +
        `• ✅ Join — Add your name to the list\n` +
        `• ❌ Leave — Remove yourself if not joining\n` +
        `• 📋 View — Only for Event Managers`
      )
      .setColor('#000000')
      .setFooter({ text: 'Armani Family | Made By Kai' })
      .setImage(BANNER_URL);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('join_Test Event').setLabel('✅ Join').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('leave_Test Event').setLabel('❌ Leave').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('view_Test Event').setLabel('📋 Registered Players').setStyle(ButtonStyle.Primary)
    );

    const sent = await channel.send({ content: `<@&${TAG_ROLE_ID}>`, embeds: [embed], components: [row] });
    messageTracker.push({ channelId: sent.channel.id, messageId: sent.id });
    registeredPlayers[eventName] = [];

    await interaction.reply({ content: '✅ Test message sent.', ephemeral: true });
    return;
  }

  if (!interaction.isButton()) return;

  const [action, ...eventNameArr] = interaction.customId.split('_');
  const eventName = eventNameArr.join('_');
  const userId = interaction.user.id;

  if (!registeredPlayers[eventName]) registeredPlayers[eventName] = [];

  if (action === 'join') {
    if (!registeredPlayers[eventName].includes(userId)) {
      registeredPlayers[eventName].push(userId);
    }
    return interaction.reply({ content: `You are registered for **${eventName}**.`, ephemeral: true });
  }

  if (action === 'leave') {
    registeredPlayers[eventName] = registeredPlayers[eventName].filter(id => id !== userId);
    return interaction.reply({ content: `You have been removed from **${eventName}**.`, ephemeral: true });
  }

  if (action === 'view') {
    const hasAccess = interaction.member.roles.cache.has(VIEW_ROLE_ID);
    if (!hasAccess) return interaction.reply({ content: '❌ You do not have permission to view registered players.', ephemeral: true });

    const list = registeredPlayers[eventName];
    const mentionList = list.map((id, i) => `${i + 1}. <@${id}>`).join('\n') || 'No one registered yet.';

    const embed = new EmbedBuilder()
      .setTitle(`📋 Registered Players for ${eventName}`)
      .setDescription(`━━━━━━━━━━━━━━━━━━━\n${mentionList}\n━━━━━━━━━━━━━━━━━━━\nTotal: ${list.length}`)
      .setColor('#2b2d31');

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
});

// Register slash command
client.on("ready", async () => {
  const data = [{
    name: "test",
    description: "Send a test event message like a real event alert"
  }];
  const guildId = process.env.TEST_GUILD_ID;
  if (!guildId) return;
  const guild = await client.guilds.fetch(guildId);
  await guild.commands.set(data);
});

function getEventIcon(eventName) {
  if (eventName.includes("RP Ticket")) return "🎟️";
  if (eventName.includes("Biz War")) return "⚔️";
  if (eventName.includes("Informal")) return "📢";
  if (eventName.includes("Shopping")) return "🛍️";
  return "✅";
}

client.login(process.env.DISCORD_TOKEN);
