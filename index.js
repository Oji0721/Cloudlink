const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, Partials, Events } = require('discord.js');
require('dotenv').config();
const config = require('./config.json');
const fs = require('fs');
const path = require('path');

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
});

// Command setup
const commands = [
  new SlashCommandBuilder().setName('inprogress').setDescription('Mark the thread as "In Progress"'),
  new SlashCommandBuilder().setName('completed').setDescription('Mark the thread as "Completed"'),
  new SlashCommandBuilder().setName('cancel').setDescription('Mark the thread as "Cancelled"'),
  new SlashCommandBuilder().setName('onhold').setDescription('Mark the thread as "On Hold"'),
  new SlashCommandBuilder().setName('rizz').setDescription('Generate a random pickup line'),
  new SlashCommandBuilder().setName('embed').setDescription('Send an embed message with custom text')
    .addStringOption(option => option.setName('text').setDescription('Text for the embed').setRequired(true)),
  new SlashCommandBuilder().setName('eval').setDescription('Evaluate JavaScript code')
    .addStringOption(option => option.setName('code').setDescription('The code to evaluate').setRequired(true)),
].map(command => command.toJSON());

// REST setup to reload slash commands
const rest = new REST({ version: '10' }).setToken(process.env.CLOUDLINK_TOKEN);

(async () => {
  try {
    await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error while reloading application (/) commands:', error);
  }
})();

// Handle slash command interactions
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;
  const embed = new EmbedBuilder();

  try {
    switch (commandName) {
      case 'eval':
        if (interaction.user.id === process.env.OWNER_ID) {
          try {
            const code = interaction.options.getString('code');
            let evalResult = eval(code);
            if (typeof evalResult !== 'string') evalResult = require('util').inspect(evalResult);
            await interaction.reply({ content: `\`\`\`js\n${evalResult}\`\`\``, ephemeral: true });
          } catch (error) {
            await interaction.reply({ content: `Error: \`\`\`js\n${error}\`\`\``, ephemeral: true });
          }
        }
        break;

      case 'rizz':
        const rizzLine = getRandomRizzLine();
        embed.setColor('#00FF00').setDescription(rizzLine);
        await interaction.reply({ embeds: [embed], ephemeral: false });
        break;

      case 'embed':
        const text = interaction.options.getString('text');
        embed.setColor('#00FF00').setDescription(text);

        // Reply to the interaction as ephemeral
        await interaction.reply({ content: 'Your embed has been sent!', ephemeral: true });

        // Send the actual embed publicly in the channel
        await interaction.channel.send({ embeds: [embed] });
        break;

      default:
        const requiredRoles = config.commandPermissions[commandName] || [];
        const hasPermission = requiredRoles.some(role => interaction.member.roles.cache.has(role));

        if (!hasPermission) {
          embed.setColor('#FF0000').setDescription('You do not have permission to use this command.');
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (['inprogress', 'completed', 'cancel', 'onhold'].includes(commandName) && !interaction.channel.isThread()) {
          embed.setColor('#FF0000').setDescription('This command can only be used in a thread.');
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const threadCheck = await interaction.guild.channels.fetch('1286673249245073520');
        if (!threadCheck || !threadCheck.isThread()) {
          embed.setColor('#FF0000').setDescription('This command requires a specific thread to be created.');
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        let tagToAdd = null;
        let lockThread = false;

        if (commandName === 'inprogress') {
          tagToAdd = config.tagIds.inProgress;
          embed.setDescription('This thread is now **In Progress**.');
        } else if (commandName === 'completed') {
          tagToAdd = config.tagIds.completed;
          lockThread = true;
          embed.setDescription('This thread is now **Completed** and locked.');
        } else if (commandName === 'cancel') {
          tagToAdd = config.tagIds.cancelled;
          lockThread = true;
          embed.setDescription('This thread has been **Cancelled** and locked.');
        } else if (commandName === 'onhold') {
          tagToAdd = config.tagIds.onHold;
          embed.setDescription('This thread is now **On Hold**.');
        }

        const hasPriorityRole = interaction.member.roles.cache.some(role => config.priorityRoles.includes(role.id));
        const tagsToSet = [];

        if (hasPriorityRole) {
          tagsToSet.push(config.tagIds.priority);
        }

        if (tagToAdd) {
          tagsToSet.push(tagToAdd);
        }

        await interaction.channel.setAppliedTags(tagsToSet);

        if (lockThread) {
          await interaction.channel.setLocked(true);
        }

        embed.setColor('#00FF00');
        await interaction.reply({ embeds: [embed], ephemeral: false });
        break;
    }
  } catch (error) {
    console.error('Error handling interaction:', error);
    try {
      await interaction.reply({ content: 'There was an error executing this command.', ephemeral: true });
    } catch (errorReply) {
      console.error('Error replying to interaction:', errorReply);
    }
  }
});

// Error handling to prevent the bot from shutting down
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

// Login event handler
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

// Random pickup line generator
function getRandomRizzLine() {
  const rizzPath = path.join(__dirname, 'rizz.json');
  const rizzData = JSON.parse(fs.readFileSync(rizzPath, 'utf-8'));
  const randomIndex = Math.floor(Math.random() * rizzData.length);
  return rizzData[randomIndex];
}
