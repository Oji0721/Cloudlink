const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, Partials, Events } = require('discord.js');
require('dotenv').config();
require('./voice.js');
const config = require('./config.json');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
});

const commands = [
  new SlashCommandBuilder().setName('inprogress').setDescription('Mark thread as "In Progress"'),
  new SlashCommandBuilder().setName('completed').setDescription('Mark thread as "Completed"'),
  new SlashCommandBuilder().setName('cancel').setDescription('Mark thread as "Cancelled"'),
  new SlashCommandBuilder().setName('onhold').setDescription('Mark thread as "On Hold"'),
  new SlashCommandBuilder().setName('rizz').setDescription('Generate random pickup line'),
  new SlashCommandBuilder().setName('embed').setDescription('Send custom embed message').addStringOption(option => option.setName('text').setDescription('Embed text').setRequired(true)),
  new SlashCommandBuilder().setName('eval').setDescription('Evaluate JavaScript code').addStringOption(option => option.setName('code').setDescription('Code to evaluate').setRequired(true)),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.CLOUDLINK_TOKEN);

(async () => {
  try {
    await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error while reloading commands:', error);
  }
})();

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isCommand()) return;
  const { commandName } = interaction;
  const embed = new EmbedBuilder();

  try {
    if (commandName === 'eval' && interaction.user.id === process.env.OWNER_ID) {
      const code = interaction.options.getString('code');
      try {
        let evalResult = eval(code);
        if (typeof evalResult !== 'string') evalResult = require('util').inspect(evalResult);
        await interaction.reply({ content: `\`\`\`js\n${evalResult}\`\`\``, ephemeral: true });
      } catch (error) {
        await interaction.reply({ content: `Error: \`\`\`js\n${error}\`\`\``, ephemeral: true });
      }
    } else if (commandName === 'rizz') {
      const rizzLine = getRandomRizzLine();
      embed.setColor('#00B4D8').setDescription(rizzLine);
      await interaction.reply({ embeds: [embed], ephemeral: false });
    } else if (commandName === 'embed') {
      const text = interaction.options.getString('text');
      embed.setColor('#00B4D8').setDescription(text);
      await interaction.reply({ content: 'Your embed has been sent!', ephemeral: true });
      await interaction.channel.send({ embeds: [embed] });
    } else {
      const requiredRoles = config.commandPermissions[commandName] || [];
      const hasPermission = requiredRoles.some(role => interaction.member.roles.cache.has(role));

      if (!hasPermission) {
        embed.setColor('#FF0000').setDescription('You do not have permission to use this command.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (['inprogress', 'completed', 'cancel', 'onhold'].includes(commandName)) {
        const parentChannelId = '1286673249245073520';
        if (interaction.channel.parentId !== parentChannelId) {
          embed.setColor('#FF0000').setDescription('This command can only be used in the correct parent channel.');
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }
      }

      let tagToAdd, lockThread = false;
      if (commandName === 'inprogress') {
        tagToAdd = config.tagIds.inProgress;
        embed.setDescription('Thread is now **In Progress**.');
      } else if (commandName === 'completed') {
        tagToAdd = config.tagIds.completed;
        lockThread = true;
        embed.setDescription('Thread is now **Completed** and locked.');
      } else if (commandName === 'cancel') {
        tagToAdd = config.tagIds.cancelled;
        lockThread = true;
        embed.setDescription('Thread has been **Cancelled** and locked.');
      } else if (commandName === 'onhold') {
        tagToAdd = config.tagIds.onHold;
        embed.setDescription('Thread is now **On Hold**.');
      }

      const hasPriorityRole = interaction.member.roles.cache.some(role => config.priorityRoles.includes(role.id));
      const tagsToSet = hasPriorityRole ? [config.tagIds.priority, tagToAdd] : [tagToAdd];

      await interaction.channel.setAppliedTags(tagsToSet);
      if (lockThread) await interaction.channel.setLocked(true);

      embed.setColor('#00B4D8');
      await interaction.reply({ embeds: [embed], ephemeral: false });
    }
  } catch (error) {
    console.error('Error handling interaction:', error);
    try {
      await interaction.reply({ content: 'Error executing this command.', ephemeral: true });
    } catch (errorReply) {
      console.error('Error replying:', errorReply);
    }
  }
});

client.on(Events.ThreadCreate, async (thread) => {
  const parentChannelId = '1286673249245073520';
  if (thread.parentId === parentChannelId) {
    try {
      const ownerMember = await thread.members.fetch(thread.ownerId);
      
      if (ownerMember) {
        const hasPriorityRole = ownerMember.roles.cache.some(role => config.priorityRoles.includes(role.id));
        
        if (hasPriorityRole) {
          await thread.setAppliedTags([config.tagIds.priority]);
        }
      } else {
        console.warn('Thread owner is not a guild member.');
      }
    } catch (error) {
      console.error('Error fetching thread owner:', error);
    }
  } else {
    console.warn('Thread created in the wrong parent channel.');
  }
});

process.on('unhandledRejection', (error) => console.error('Unhandled promise rejection:', error));
process.on('uncaughtException', (error) => console.error('Uncaught exception:', error));

client.once('ready', () => console.log(`Logged in as ${client.user.tag}!`));

function getRandomRizzLine() {
  const rizzPath = path.join(__dirname, 'rizz.json');
  const rizzData = JSON.parse(fs.readFileSync(rizzPath, 'utf-8'));
  return rizzData[Math.floor(Math.random() * rizzData.length)];
}

client.login(process.env.CLOUDLINK_TOKEN);
