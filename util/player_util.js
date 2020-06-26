exports.get_uuid = (input, sql_pool, log, callback) => {
    // step 1: check for exact username match
    sql_pool.query('SELECT uuid FROM litebans_history WHERE name = ?', input, (err, res) => {
        input = input.trim();

        if(err) log.error(err);
        if(res[0] !== undefined) {
            callback(res[0]['uuid']);
            return;
        }

        // step 2: check for exact discord id match
        sql_pool.query('SELECT uuid FROM discord_users WHERE discordID = ?', [Number(input)], (err, res) => {
            if(err) log.error(err);
            if(res[0] !== undefined) {
                callback(res[0]['uuid']);
                return;
            }

            // step 3: check for exact uuid match
            sql_pool.query('SELECT uuid FROM litebans_history WHERE uuid = ?', input, (err, res) => {
                if(err) log.error(err);
                if(res[0] !== undefined) {
                    callback(res[0]['uuid']);
                    return;
                }

                // step 4: check for discord tag match
                input = input.slice(2, -1);
                if(input.startsWith('!')) input = input.slice(1);
                sql_pool.query('SELECT uuid FROM discord_users WHERE discordID = ?', [Number(input)], (err, res) => {
                    if(err) log.error(err);
                    if(res[0] !== undefined) {
                        callback(res[0]['uuid']);
                        return;
                    }
                });
                callback(null);
                return;
            });
        });
    });
};
/*
Returns the user's info in an object with the following format:

{
    username: string
    online: boolean
    muted: boolean
    banned: boolean
    history_url: string
}

if user not found, returns null
*/
exports.get_player_info = (uuid, sql_pool, redis_client, log, callback) => {
    // step 1: get most recent username
    sql_pool.query('SELECT name FROM litebans_history WHERE uuid = ? SORT BY date DESC', args[0], (err, res) => {
        if(err) log.error(err);
        if(res[0] === undefined) {
            callback(null);
            return;
        } else {

            // setp 2: get online status
            const user = res[0]['name'];
            redis_client.get('minecraft.players', (response) => {
                let online = false;
                if(response === null) response = '[]';
                players = JSON.parse(response);
                for(player of players) {
                    if(player['uuid'] === uuid) online = true;
                }

                // step 3: get muted / banned status
                sql_pool.query('SELECT reason FROM litebans_mutes WHERE uuid = ? AND (until < 1 OR until > unix_timestamp()*1000) AND active = 1', uuid, (err, res) => {
                    if(err) log.error(err);
                    const muted = res[0] !== undefined;
                    sql_pool.query('SELECT reason FROM litebans_bans WHERE uuid = ? AND (until < 1 OR until > unix_timestamp()*1000) AND active = 1', uuid, (err, res) => {
                        if(err) log.error(err);
                        const banned = res[0] !== undefined;
                        callback({
                            username: user,
                            online: online,
                            muted: muted,
                            banned: banned,
                            history_url: 'https://bans.left4craft.org/history.php?uuid=' + uuid
                        });
                        return;
                    });
                });
            });
        }
    });
}