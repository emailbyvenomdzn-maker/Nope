# Nope Discord TTS

Bot Discord local com um único comando:

`/tts texto:Olá pessoal!`

O bot entra no canal de voz em que você está, converte o texto em fala usando a síntese de voz do Windows e reproduz o áudio no Discord.

## Requisitos

- Windows com uma voz de fala instalada, de preferência uma voz em português (Brasil).
- Node.js 24.17.0 ou mais recente.
- Um aplicativo/bot criado no Discord Developer Portal.
- O bot precisa ter permissões para ver o servidor/canal, usar o canal de voz e usar comandos.

## Configuração

1. Copie `.env.example` para `.env`.
2. Preencha:
   - `DISCORD_TOKEN`: token do bot.
   - `CLIENT_ID`: Application ID do bot.
   - `GUILD_ID`: ID do seu servidor. É opcional, mas recomendado para registrar `/tts` imediatamente.
3. Instale as dependências:

```bash
npm install
```

4. Inicie:

```bash
npm start
```

## Uso

Entre em um canal de voz e use:

```text
/tts texto:Olá, isso é um teste de voz.
```

O bot entra no seu canal, fala o texto e sai depois da reprodução.

## Observações

- O arquivo `.env` nunca deve ser enviado ao GitHub.
- O projeto não precisa ficar hospedado: o processo do bot roda no seu próprio PC.
- Sem `GUILD_ID`, o comando é registrado globalmente e pode demorar para aparecer em todos os servidores.
