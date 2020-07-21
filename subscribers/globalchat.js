module.exports = {
    channels: ['minecraft.chat.global.out'],

    execute(channel, message, depend) {
        const log = depend['log'];
        const config = depend['config'];
        const discord_client = depend['discord_client'];
        const webhook = depend['webhook'];

        try {
			message = JSON.parse(message);
			
			log.basic(`[CHAT IN] ${message.name}: ${message.message}`);

			webhook.send(message.message.replace(/@everyone/ig, '@ everyone').replace(/@here/ig, '@ here'), {
				avatarURL: 'https://crafatar.com/avatars/' + message.uuid,
				username: message.name
			});

        } catch (e) { // when not a json object, message is supposed to be directly sent
            // TODO make this less crappy (requies Left4Chat edit)
            discord_client.channels.fetch(config.chat_bridge_chan_id, true).then((channel) => {
				channel.send(message);
				log.basic(`[RAW TXT] ${message}`)
            });
        }
    }
};