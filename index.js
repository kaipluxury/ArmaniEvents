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
    const scheduleRule = {
      hour: (hour + 23) % 24, // 10 minutes earlier
      minute: (minute + 50) % 60,
      tz: 'Europe/London'
    };

    const channelId = CHANNELS[eventName];
    if (!channelId) continue;

    schedule.scheduleJob(scheduleRule, async () => {
      const channel = await client.channels.fetch(channelId);
      sendEvent(channel, eventName, exactTime);
    });
  }

  schedule.scheduleJob({ hour: 5, minute: 0, tz: 'Europe/London' }, async () => {
    for (const msg of messageTracker) {
      try {
        const channel = await client.channels.fetch(msg.channelId);
        const message = await channel.messages.fetch(msg.messageId);
        await message.delete();
      } catch (e) {
        console.log("❌ Message already deleted.");
      }
    }
    messageTracker.length = 0;
    Object.keys(registeredPlayers).forEach(e => registeredPlayers[e] = []);
    console.log("✅ Daily cleanup complete.");
  });
});

async function sendEvent(channel, eventName, startTime) {
  if (!registeredPlayers[eventName]) registeredPlayers[eventName] = [];

  const embed = new EmbedBuilder()
    .setTitle(getEventIcon(eventName) + " " + eventName)
    .setDescription(generateDescription(eventName))
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

function generateDescription(eventName) {
  const players = registeredPlayers[eventName] || [];
  const formatted = players.map((entry, i) => `${i + 1}. <@${entry.id}> | ${entry.gameId || 'N/A'}`).join('\n') || 'No players yet.';
  const limit = SIGNUP_LIMITS[eventName] || 25;
  return `Sign up below! 🔔 [Armani Alerts]\n\n${formatted}\n\nSignups: ${players.length}/${limit} ✅`;
}

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton() && !interaction.isModalSubmit() && !interaction.isChatInputCommand()) return;

  const [action, ...eventNameArr] = interaction.customId.split('_');
  const eventName = eventNameArr.join('_');
  const userId = interaction.user.id;

  if (!registeredPlayers[eventName]) registeredPlayers[eventName] = [];

  const playerList = registeredPlayers[eventName];

  if (action === 'join') {
    if (playerList.find(p => p.id === userId)) {
      return interaction.reply({ content: '❌ You are already signed up.', ephemeral: true });
    }
    if (playerList.length >= SIGNUP_LIMITS[eventName]) {
      return interaction.reply({ content: '⚠️ Signup full for this event.', ephemeral: true });
    }
    playerList.push({ id: userId, gameId: 'N/A' });
    await updateEmbed(interaction.message, eventName);
    return interaction.reply({ content: '✅ You are signed up!', ephemeral: true });
  }

  if (action === 'leave') {
    registeredPlayers[eventName] = playerList.filter(p => p.id !== userId);
    await updateEmbed(interaction.message, eventName);
    return interaction.reply({ content: '❌ You have been removed.', ephemeral: true });
  }

  if (action === 'manager') {
    if (!interaction.member.roles.cache.has(VIEW_ROLE_ID)) {
      return interaction.reply({ content: '❌ You are not allowed to use this.', ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId(`manualadd_${eventName}`)
      .setTitle(`Sign Someone Up for ${eventName}`);

    const userField = new TextInputBuilder()
      .setCustomId('userid')
      .setLabel("User ID (Mention or ID)")
      .setStyle(TextInputStyle.Short);

    const idField = new TextInputBuilder()
      .setCustomId('gameid')
      .setLabel("Game ID (optional)")
      .setStyle(TextInputStyle.Short);

    modal.addComponents(
      new ActionRowBuilder().addComponents(userField),
      new ActionRowBuilder().addComponents(idField)
    );

    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && action === 'manualadd') {
    if (!interaction.member.roles.cache.has(VIEW_ROLE_ID)) {
      return interaction.reply({ content: '❌ You are not allowed to use this.', ephemeral: true });
    }
    const mention = interaction.fields.getTextInputValue('userid').trim().replace(/[<@!>]/g, '');
    const gameId = interaction.fields.getTextInputValue('gameid').trim() || 'N/A';

    if (!mention) return interaction.reply({ content: '❌ Invalid user.', ephemeral: true });

    if (playerList.find(p => p.id === mention)) {
      return interaction.reply({ content: '❌ That user is already signed up.', ephemeral: true });
    }
    if (playerList.length >= SIGNUP_LIMITS[eventName]) {
      return interaction.reply({ content: '⚠️ Signup full.', ephemeral: true });
    }

    playerList.push({ id: mention, gameId });
    await updateEmbed(interaction.message, eventName);
    return interaction.reply({ content: `✅ <@${mention}> has been signed up.`, ephemeral: true });
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'test') {
    const channel = interaction.channel;
    sendEvent(channel, 'RP Ticket Factory - PRIORITY', '12:00');
    interaction.reply({ content: '✅ Test embed sent.', ephemeral: true });
  }
});

async function updateEmbed(message, eventName) {
  const embed = EmbedBuilder.from(message.embeds[0]);
  embed.setDescription(generateDescription(eventName));
  await message.edit({ embeds: [embed] });
}

function getEventIcon(eventName) {
  if (eventName.includes("RP Ticket")) return "🎟️";
  if (eventName.includes("Biz War")) return "⚔️";
  if (eventName.includes("Shopping")) return "🛍️";
  return "✅";
}

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

client.login(process.env.DISCORD_TOKEN);

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Armani Bot Active'));
app.listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));
