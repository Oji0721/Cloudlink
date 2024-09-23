const { Client } = require('discord.js-selfbot-v13');
const { joinVoiceChannel } = require('@discordjs/voice');
const { RichPresence, Util } = require('discord.js-selfbot-rpc');
require('dotenv').config();

const client = new Client();
const guildId = '1261321680706601011';
const channelId = '1261321681264443441';
const applicationId = '1136560543742836746';

async function joinChannel() {
  try {
    const guild = await client.guilds.fetch(guildId);
    const channel = await guild.channels.fetch(channelId);

    if (channel.isVoice()) {
      joinVoiceChannel({
        channelId: channel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false,
      });
    }
  } catch (error) {
    console.error('Error joining channel:', error);
  }
}

client.on('ready', async () => {
  console.log(`${client.user.username} is ready!`);
  await joinChannel();

  setInterval(async () => {
    try {
      const guild = await client.guilds.fetch(guildId);
      const member = guild.members.cache.get(client.user.id);

      if (!member.voice.channel) {
        console.log('Bot is disconnected from the voice channel, rejoining...');
        await joinChannel();
      }
    } catch (error) {
      console.error('Error in interval check:', error);
    }
  }, 180000);

  try {
    const robloxImage = await Util.getAssets(applicationId, 'roblox');
    const privateServerImage = await Util.getAssets(applicationId, 'private-server');

    const presence = new RichPresence()
      .setStatus('dnd')
      .setType('PLAYING')
      .setApplicationId(applicationId)
      .setName('Roblox')
      .setDetails('Playing ✈️ Cabin Crew Simulator')
      .setState('In a private server')
      .setAssetsLargeImage(privateServerImage.id)
      .setAssetsLargeText('✈️ Cabin Crew Simulator')
      .setAssetsSmallImage(robloxImage.id)
      .setAssetsSmallText('Roblox')
      .setTimestamp(1726657270109);

    client.user.setPresence(presence.toData());
  } catch (error) {
    console.error('Error setting Rich Presence:', error);
  }
});

client.on('voiceStateUpdate', async (oldState, newState) => {
  try {
    if (newState.id === client.user.id && !newState.channelId) {
      console.log('Bot disconnected from voice channel, rejoining in 30 seconds...');
      setTimeout(async () => {
        console.log('Rejoining the voice channel...');
        await joinChannel();
      }, 30000);
    }
  } catch (error) {
    console.error('Error in voiceStateUpdate:', error);
  }
});

client.login(process.env.TOKEN);
