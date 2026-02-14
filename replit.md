# Espanoletes Discord Bot

## Overview
A Discord bot built with discord.js v14 for managing a Spanish community server. Features include ticket system, email verification, welcome messages, blackjack, and maintenance mode.

## Project Architecture
- **Language**: Node.js (CommonJS)
- **Framework**: discord.js v14 + Express (status page)
- **Entry point**: `index.js`
- **Commands**: `/commands/*.js` (slash commands)
- **Handlers**: `/handlers/commandHandler.js`, `/handlers/events/`
- **Config**: `config.js` (guild ID)
- **Data**: `data/tickets.json`

## Environment Variables Required
- `DISCORD_TOKEN` - Discord bot token
- `CLIENT_ID` - Discord application client ID
- `GUILD_ID` - Target Discord server ID
- `WELCOME_CHANNEL_ID` - Channel for welcome messages (optional)
- `SENDGRID_API_KEY` - SendGrid API key for email verification (optional)
- `SENDGRID_FROM_EMAIL` - Sender email for verification (optional)

## Key Features
- Ticket system with claim/close functionality
- Email verification via SendGrid
- Welcome messages for new members
- Slash commands (ping, ayuda, blackjack, anunciar, mantenimiento)
- Web status page on port 5000

## Recent Changes
- 2026-02-14: Configured for Replit environment - Express binds to 0.0.0.0:5000, graceful startup without Discord tokens
