import { SlashCommandBuilder } from '@discordjs/builders';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import config from './config.json';
const commands = [
    new SlashCommandBuilder()
        .setName('add_account')
        .setDescription('Add an account number to your server\'s stack.')
        .addIntegerOption(option => option.setName('account_id')
        .setDescription('The Steam 32 id of the user you would like to add.')
        .setRequired(true)),
    new SlashCommandBuilder()
        .setName('remove_account')
        .setDescription('Remove an account number to your server\'s stack.')
        .addIntegerOption(option => option.setName('account_id')
        .setDescription('The Steam 32 id of the user you would like to remove.')
        .setRequired(true)),
    new SlashCommandBuilder()
        .setName('new_question')
        .setDescription('Get a new multiple choice question about your stack.'),
    new SlashCommandBuilder()
        .setName('refresh_accounts')
        .setDescription('Refresh data in the dota accounts in your stack.')
]
    .map(command => command.toJSON());
const rest = new REST({ version: '9' }).setToken(config.token);
(async () => {
    try {
        await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commands });
        console.log('Successfully registered application commands.');
    }
    catch (error) {
        console.error(error);
    }
})();
