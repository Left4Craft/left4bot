/**
 * @name poll-bot
 * @author eartharoid
 * @license MIT
 */

const fs = require('fs');
const Discord = require('discord.js');
const client = new Discord.Client({
    autoReconnect: true
});
const fetch = require('node-fetch');
const log = require('leekslazylogger');
const config = require('./config.js');

client.commands = new Discord.Collection();
const cooldowns = new Discord.Collection();

log.init({
    name: config.name
});

const now = () => {
    return new Date();
};


client.on('ready', () => {
    log.success(`Connected to Discord API`);
    log.success(`Logged in as ${client.user.tag}`);

    const commands = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

    for (const file of commands) {
        const command = require(`./commands/${file}`);
        client.commands.set(command.name, command);
        log.console(`> Loaded '${config.prefix}${command.name}' command`);
    };

    log.info(`Finished loading ${commands.length} commands`);
    if (config.log_general) {
        client.channels.cache.get(config.log_chan_id).send(
            new Discord.MessageEmbed()
            .setColor(config.colour)
            .setTitle("Started")
            .setDescription(`:white_check_mark: **»** Started succesfully with ${commands.length} commands loaded.`)
            .setFooter(config.name, client.user.avatarURL())
            .setTimestamp()
        );
    };

    const updatePresence = () => {
        client.user.setPresence({
                activity: {
                    name: config.activities[Math.floor(Math.random() * config.activities.length)] + `  |  ${config.prefix}help`,
                    type: config.activity_type
                }
            })
            .catch(log.error);
    };

    updatePresence();
    setInterval(() => {
        updatePresence();
    }, 15000);


    const stats_cat_id = config.stats_cat_id;
    const players_cat_id = config.status_cat_id;
    const updateStatusInfo = () => {
        let host = config.query_cache_bypass[Math.floor(Math.random() * config.query_cache_bypass.length)];
        log.info(`Pinging ${host}`);

        fetch(`https://mcapi.ca/ping/players/${host}`).then(res => res.json())
        .then(json => {
            let status = json.status ? "online" : "offline";
            let text = `${status} with ${json.players.online} players`;

            log.console(`${config.name} is ${log.colour[status ? "greenBright" : "redBright"](status)}`);

            client.channels.cache.get(config.status_cat_id).setName(text);

            log.info(`Updated status category: ${text}`);

            client.user.setStatus(json.status ? "online" : "dnd");
        });

    };

    updateStatusInfo();
    setInterval(() => {
        updateStatusInfo();
    }, config.status_update_interval * 1000);

});

client.on('message', async message => {
    if (message.author.bot) return;

    if (message.channel.type === "dm") {
        if (message.author.id === client.user.id) return;
        if (config.log_dm) {
            if (config.log_general) {
                client.channels.cache.get(config.log_chan_id).send(
                    new Discord.MessageEmbed()
                    .setAuthor(message.author.username, message.author.avatarURL())
                    .setTitle("DM Logger")
                    .addField("Username", message.author.tag, true)
                    .addField("Message", message.content, true)
                    .setFooter(config.name, client.user.avatarURL())
                    .setTimestamp()
                );
            };
        };
    };

    const prefixRegex = new RegExp(`^(<@!?${client.user.id}>|\\${config.prefix})\\s*`);
    if (!prefixRegex.test(message.content)) return;
    const [, matchedPrefix] = message.content.match(prefixRegex);
    const args = message.content.slice(matchedPrefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName) || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

    if (!command) return;

    if (command.guildOnly && message.channel.type !== 'text') {
        return message.channel.send(`Sorry, this command can only be used in a server.`)
    }

    // if ((command.permission && !message.member.hasPermission(command.permission)) || (command.adminOnly === true && !message.member.roles.cache.has(config.admin_role_id))) {
    if ((command.permission && !message.member.hasPermission(command.permission)) || (command.adminOnly === true && !message.member.roles.cache.some(r => config.admin_roles.includes(r.id)))) {
        log.console(`${message.author.tag} tried to use the '${command.name}' command without permission`);
        return message.channel.send(
            new Discord.MessageEmbed()
            .setColor("#E74C3C")
            .setDescription(`\n:x: **You do not have permission to use the \`${command.name}\` command.**`)
        );
    }

    if (command.args && !args.length) {
        return message.channel.send(
            new Discord.MessageEmbed()
            .setColor("#E74C3C")
            .addField("Usage", `\`${config.prefix}${command.name} ${command.usage}\`\n`)
            .addField("Help", `Type \`${config.prefix}help ${command.name}\` for more information`)
        );
    };

    if (!cooldowns.has(command.name)) {
        cooldowns.set(command.name, new Discord.Collection());
    }

    const timestamps = cooldowns.get(command.name);
    const cooldownAmount = (command.cooldown || config.cooldown) * 1000;

    if (timestamps.has(message.author.id)) {
        const expirationTime = timestamps.get(message.author.id) + cooldownAmount;

        if (now() < expirationTime) {
            const timeLeft = (expirationTime - now()) / 1000;
            return message.channel.send(
                new Discord.MessageEmbed()
                .setColor("#E74C3C")
                .setDescription(`:x: **Please do not spam commands** (wait ${timeLeft.toFixed(1)}s)`)
            );
        }
    }
    timestamps.set(message.author.id, now());
    setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);

    try {
        command.execute(message, args); // execute the command (*so much code just to get to this 1 line*)

        log.console(`${message.author.tag} used the '${command.name}' command`)
    } catch (error) {
        log.error(error);
        message.channel.send(`:x: An error occured whilst executing the \`${command.name}\` command.\nThe issue has been reported.`);
        log.error(`An error occured whilst executing the '${command.name}' command`);
    }

});
client.on('error', error => {
    log.warn(`Potential error detected\n(likely Discord API connection issue)\n`);
    log.error(`Client error:\n${error}`);
});
client.on('warn', (e) => log.warn(`${e}`));

if (config.debug_level == 1) {
    client.on('debug', (e) => log.debug(`${e}`))
};

process.on('unhandledRejection', error => {
    log.warn(`An error was not caught`);
    log.error(`Uncaught error: \n${error.stack}`);
});
process.on('beforeExit', (code) => {
    log.basic(log.colour.yellowBright(`Disconected from Discord API`));
    log.basic(`Exiting (${code})`);
});



client.login(config.token);