require('dotenv').config();

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
  NoSubscriberBehavior
} = require('@discordjs/voice');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID || '';

if (!TOKEN || !CLIENT_ID) {
  console.error('Defina DISCORD_TOKEN e CLIENT_ID no arquivo .env.');
  process.exit(1);
}

const command = new SlashCommandBuilder()
  .setName('tts')
  .setDescription('Faz o bot falar um texto no seu canal de voz')
  .addStringOption(option =>
    option
      .setName('texto')
      .setDescription('Texto que será convertido em fala')
      .setRequired(true)
      .setMaxLength(500)
  );

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

function makeTempPath(extension = 'wav') {
  return path.join(os.tmpdir(), `nope-tts-${crypto.randomUUID()}.${extension}`);
}

function synthesizeSpeech(text, outputFile) {
  return new Promise((resolve, reject) => {
    const escapedText = text
      .replace(/`/g, "''")
      .replace(/'/g, "''");
    const escapedPath = outputFile.replace(/'/g, "''");

    // Usa o Windows PowerShell/System.Speech, mantendo a síntese local no PC.
    const script = [
      'Add-Type -AssemblyName System.Speech',
      '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
      "$s.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::NotSet, [System.Speech.Synthesis.VoiceAge]::Adult, 0, [System.Globalization.CultureInfo]::GetCultureInfo('pt-BR'))",
      `$s.SetOutputToWaveFile('${escapedPath}')`,
      `$s.Speak('${escapedText}')`,
      '$s.Dispose()'
    ].join('; ');

    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      windowsHide: true
    });

    let stderr = '';
    child.stderr.on('data', data => { stderr += data.toString(); });
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `PowerShell terminou com código ${code}`));
        return;
      }
      if (!fs.existsSync(outputFile)) {
        reject(new Error('O Windows não gerou o arquivo de áudio. Verifique se existe uma voz compatível instalada.'));
        return;
      }
      resolve();
    });
  });
}

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  const body = [command.toJSON()];

  if (GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body });
    console.log(`Comando /tts registrado no servidor ${GUILD_ID}.`);
  } else {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body });
    console.log('Comando /tts registrado globalmente.');
  }
}

client.once('ready', async () => {
  console.log(`Conectado como ${client.user.tag}`);
  try {
    await registerCommands();
  } catch (error) {
    console.error('Falha ao registrar /tts:', error.message);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'tts') return;

  const member = interaction.member;
  const voiceChannel = member?.voice?.channel;
  const text = interaction.options.getString('texto', true).trim();

  if (!voiceChannel) {
    await interaction.reply({ content: 'Entre em um canal de voz primeiro.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  let connection;
  let audioFile;

  try {
    audioFile = makeTempPath('wav');
    await synthesizeSpeech(text, audioFile);

    connection = getVoiceConnection(interaction.guildId) || joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 15_000);

    const player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Stop }
    });
    const resource = createAudioResource(audioFile);

    player.play(resource);
    connection.subscribe(player);

    await interaction.editReply('🔊 Falando...');

    player.once(AudioPlayerStatus.Idle, () => {
      try { fs.rmSync(audioFile, { force: true }); } catch {}
      setTimeout(() => {
        const current = getVoiceConnection(interaction.guildId);
        if (current === connection && current.state.status === VoiceConnectionStatus.Ready) {
          current.destroy();
        }
      }, 1500);
    });

    player.on('error', error => {
      console.error('Erro no áudio:', error);
      try { fs.rmSync(audioFile, { force: true }); } catch {}
    });
  } catch (error) {
    console.error('Erro no /tts:', error);
    if (audioFile) {
      try { fs.rmSync(audioFile, { force: true }); } catch {}
    }
    if (connection) {
      try { connection.destroy(); } catch {}
    }
    await interaction.editReply(`Não consegui reproduzir o áudio: ${error.message}`);
  }
});

client.login(TOKEN);
