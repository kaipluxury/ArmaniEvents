const express = require('express');
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Events, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const schedule = require('node-schedule');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const MENTION_ROLES = {
  'RP Ticket Factory - PRIORITY': '1284522045551673405',
  'Biz War - PRIORITY': '1279505005472387203',
  'Shopping Center': '1280183480336253080'
};

const SIGNUP_LIMITS = {
  'RP Ticket Factory - PRIORITY': 25,
  'Biz War - PRIORITY': 25,
  'Shopping Center': 5
};

const BANNERS = {
  'RP Ticket Factory - PRIORITY': 'https://raw.githubusercontent.com/kaipluxury/ArmaniEvents/refs/heads/main/C6C97DFF-431F-4F13-8EAB-7B607A39315C.png',
  'Biz War - PRIORITY': 'https://raw.githubusercontent.com/kaipluxury/ArmaniEvents/refs/heads/main/0D884C51-9315-406A-B7C5-45ACAC210081.png',
  'Shopping Center': 'https://raw.githubusercontent.com/kaipluxury/ArmaniEvents/refs/heads/main/9A1BD0CB-8AC4-49E5-A793-0B813D435CE7.png'
};

const VIEW_ROLE_ID = process.env.VIEW_ROLE_ID;
const CHANNELS = {
  'RP Ticket Factory - PRIORITY': '1284521475788902443',
  'Biz War - PRIORITY': '1279095872537497723',
  'Shopping Center': '1279095972076716092'
};

const registeredPlayers = {};
const messageTracker = [];

const events = [
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
    const fireHour = (minute < 10) ? (hour + 23) % 24 : hour;
    const fireMinute = (minute + 60 - 10) % 60;

    schedule.scheduleJob({ hour: fireHour, minute: fireMinute, tz: 'Europe/London' }, async () => {
      const channel = await client.channels.fetch(CHANNELS[eventName]);
      sendEvent(channel, eventName, exactTime);
    });
  }

  schedule.scheduleJob({ hour: 5, minute: 0, tz: 'Europe/London' }, async () => {
    for (const msg of messageTracker) {
      try {
        const channel = await client.channels.fetch(msg.channelId);
        const message = await channel.messages.fetch(msg.messageId);
        await message.delete();
      } catch { }
    }
    messageTracker.length = 0;
    Object.keys(registeredPlayers).forEach(e => registeredPlayers[e] = []);
  });
});

async function sendEvent(channel, eventName, startTime) {
  if (!registeredPlayers[eventName]) registeredPlayers[eventName] = [];

  const embed = new EmbedBuilder()
    .setTitle(getEventIcon(eventName) + " " + eventName)
    .setDescription(generateDescription(eventName, startTime))
    .setColor('#000000')
    .setFooter({ text: 'Armani Family | Made By Kai' })
    .setImage(BANNERS[eventName]);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`join_${eventName}`).setLabel('✅ Sign Up').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`leave_${eventName}`).setLabel('❌ Cancel').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`manager_${eventName}`).setLabel('👤 Sign Someone Up').setStyle(ButtonStyle.Primary)
  );

  const sent = await channel.send({
    content: `<@&${MENTION_ROLES[eventName]}>`,
    embeds: [embed],
    components: [row]
  });

  messageTracker.push({ channelId: sent.channel.id, messageId: sent.id });
}

function generateDescription(eventName, startTime) {
  const players = registeredPlayers[eventName] || [];
  const list = players.map((p, i) => `${i + 1}. <@${p.id}> | ${p.gameId || 'N/A'}`).join('\n') || 'No players yet.';
  const limit = SIGNUP_LIMITS[eventName] || 25;
  return (
    `**⏳ Starts In:** 10 minutes *(InGame Time)*\n` +
    `**🕒 Start Time:** ${startTime} *(InGame Time)*\n\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `**Registered Players:**\n${list}\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `**✅ Slots Filled:** ${players.length}/${limit}`
  );
}

client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isChatInputCommand() && interaction.commandName === 'test') {
    const channel = interaction.channel;
    await sendEvent(channel, 'RP Ticket Factory - PRIORITY', '12:00');
    return interaction.reply({ content: '✅ Test embed sent.', ephemeral: true });
  }

  if (!interaction.isButton() && !interaction.isModalSubmit()) return;

  const [action, ...eventArr] = interaction.customId.split('_');
  const eventName = eventArr.join('_');
  if (!registeredPlayers[eventName]) registeredPlayers[eventName] = [];

  if (action === 'join') {
    if (registeredPlayers[eventName].some(p => p.id === interaction.user.id)) {
      return interaction.reply({ content: '❌ Already signed up.', ephemeral: true });
    }
    if (registeredPlayers[eventName].length >= SIGNUP_LIMITS[eventName]) {
      return interaction.reply({ content: '⚠️ Sign-up limit reached.', ephemeral: true });
    }
    registeredPlayers[eventName].push({ id: interaction.user.id, gameId: 'N/A' });
    await updateEmbed(interaction.message, eventName);
    return interaction.reply({ content: '✅ You are signed up!', ephemeral: true });
  }

  if (action === 'leave') {
    registeredPlayers[eventName] = registeredPlayers[eventName].filter(p => p.id !== interaction.user.id);
    await updateEmbed(interaction.message, eventName);
    return interaction.reply({ content: '❌ You have been removed.', ephemeral: true });
  }

  if (action === 'manager') {
    if (!interaction.member.roles.cache.has(VIEW_ROLE_ID)) {
      return interaction.reply({ content: '❌ No access.', ephemeral: true });
    }
    const modal = new ModalBuilder().setCustomId(`manualadd_${eventName}`).setTitle(`Sign Someone Up - ${eventName}`);
    const userField = new TextInputBuilder().setCustomId('userid').setLabel("User ID").setStyle(TextInputStyle.Short);
    const idField = new TextInputBuilder().setCustomId('gameid').setLabel("Game ID").setStyle(TextInputStyle.Short);
    modal.addComponents(new ActionRowBuilder().addComponents(userField), new ActionRowBuilder().addComponents(idField));
    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('manualadd_')) {
    const eventName = interaction.customId.replace('manualadd_', '');
    const mention = interaction.fields.getTextInputValue('userid').replace(/[<@!>]/g, '');
    const gameId = interaction.fields.getTextInputValue('gameid') || 'N/A';
    if (registeredPlayers[eventName].some(p => p.id === mention)) {
      return interaction.reply({ content: '❌ Already signed up.', ephemeral: true });
    }
    registeredPlayers[eventName].push({ id: mention, gameId });
    await updateEmbed(interaction.message, eventName);
    return interaction.reply({ content: `✅ Signed up <@${mention}>.`, ephemeral: true });
  }
});

async function updateEmbed(message, eventName) {
  const embed = EmbedBuilder.from(message.embeds[0]);
  embed.setDescription(generateDescription(eventName, ''));
  await message.edit({ embeds: [embed] });
}

function getEventIcon(eventName) {
  if (eventName.includes("RP Ticket")) return "🎟️";
  if (eventName.includes("Biz War")) return "⚔️";
  if (eventName.includes("Shopping")) return "🛍️";
  return "✅";
}

client.on("ready", async () => {
  const guild = await client.guilds.fetch(process.env.TEST_GUILD_ID);
  await guild.commands.set([{ name: 'test', description: 'Send a test event embed' }]);
});

// ✅ Streaming Status with YouTube Link
const statuses = [
  "Streaming Armani Family",
  "Streaming Events",
  "Streaming Armani Fam Events"
];
let i = 0;
setInterval(() => {
  client.user.setActivity(statuses[i], {
    type: 1,
    url: "https://youtube.com/@andromilano?feature=shared"
  });
  i = (i + 1) % statuses.length;
}, 12000);

client.login(process.env.DISCORD_TOKEN);

// Web server for Render keep-alive
const app = express();
app.get('/', (req, res) => res.send('Armani Bot Running'));
app.listen(process.env.PORT || 3000);
