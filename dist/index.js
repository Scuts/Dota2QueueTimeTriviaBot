import fetch from "node-fetch";
import fs from "fs";
import config from "./config.json";
import { Client, Intents } from 'discord.js';
import { MongoClient } from 'mongodb';
import path from 'path';
import util from 'util';
const dirname = path.resolve();
const heroDataFolder = "heroes";
const heroDirectoryPath = path.join(dirname, 'heroes');
const wait = util.promisify(setTimeout);
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MESSAGE_REACTIONS],
    partials: ['MESSAGE', 'CHANNEL', 'REACTION'] });
let heroesText = fs.readFileSync(`dotaconstants\\build\\heroes.json`, 'utf8');
const heroes = Object.values(JSON.parse(heroesText));
// When the client is ready, run this code (only once)
client.once('ready', () => {
    console.log('Ready!');
});
function shuffle(array) {
    let currentIndex = array.length, randomIndex;
    // While there remain elements to shuffle...
    while (currentIndex != 0) {
        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]
        ];
    }
    return array;
}
/*
const findMax = function(accountHeroes) {
  let accumGames = accountHeroes[0].games;
  return accountHeroes.reduce((accum, curr) => {
    const currGames = curr.games;
    if (currGames > accumGames) {
      accumGames = currGames;
      return curr;
    }
    return accum;
  });
}




const findMostPlayedHero = function(accountHeroes) {
  let heroCounts = [];
  heroes.forEach(hero => {
      let heroCount = {
          id: parseInt(hero.id),
          count: 0,
          name: hero.localized_name
      }
      heroCounts.push(heroCount);
  });
  accountHeroes.forEach(accountHero => {
      accountHero.heroes.forEach(hero => {
          let heroCount = heroCounts.find(x=> x.id === parseInt(hero.hero_id));
          heroCount.count += hero.games;
      });
  });

  let accumGames = heroCounts[0].count;

  return heroCounts.reduce((accum, curr) => {
    const currGames = curr.count;
    if (currGames < accumGames) {
      accumGames = currGames;
      return curr;
    }
    return accum;
  });
}

function parseText(response) {
  console.log(response);
  let jsonResults = JSON.parse(response);

  let heroesText = fs.readFileSync(`dotaconstants\\build\\heroes.json`, 'utf8');

  let heroes = Object.values(JSON.parse(heroesText));

  let maxHeroId = parseInt(findMax(jsonResults).hero_id);
  let maxHero = heroes.find(x => x.id === maxHeroId);
  console.log(maxHero.localized_name);
}*/
function addAccount(interaction) {
    const interactionData = interaction.options.data;
    let steamId;
    if (!interaction.guildId) {
        return `Could not find guild Id`;
    }
    if (interactionData && interactionData.length > 0) {
        steamId = interactionData.find(x => x.name === 'account_id')?.value;
    }
    else {
        return `Could not find steamId in message.`;
    }
    if (!steamId) {
        return `Could not find steamId in message.`;
    }
    fetchOpenDotaAccount(steamId, interaction.guildId);
    /*const uri = config.uri;
    const mongoClient = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    mongoClient.connect(err => {
        const collection = mongoClient.db("qttDB").collection("player");
        collection.deleteMany({ account_id: steamId});
        const playerHeroCollection = mongoClient.db("qttDB").collection("player_hero");
        playerHeroCollection.deleteMany({account_id: steamId}).then(fetchNewOpenDotaAccount(steamId));
    });*/
    return `Saving account info for: ${steamId}.`;
}
function removeAccountPromise(steamId) {
    return new Promise(function (resolve, reject) {
        const uri = config.uri;
        const mongoClient = new MongoClient(uri);
        mongoClient.connect(err => {
            const collection = mongoClient.db("qttDB").collection("player");
            collection.deleteMany({ account_id: steamId }).then(results => {
                const playerHeroCollection = mongoClient.db("qttDB").collection("guild");
                playerHeroCollection.deleteMany({ account_id: steamId }).then(() => { resolve("done"); });
            });
        });
    });
}
function removeAccount(interaction) {
    const interactionData = interaction.options.data;
    const steamId = interactionData.find(x => x.name === 'account_id')?.value;
    if (!interaction.guildId) {
        return `Could not find guild Id`;
    }
    const uri = config.uri;
    const mongoClient = new MongoClient(uri);
    mongoClient.connect(err => {
        const guildCollection = mongoClient.db("qttDB").collection("guild");
        const query = { guildId: interaction.guildId };
        const update = {
            $pull: { accounts: { "profile.account_id": steamId } }
        };
        guildCollection.updateOne(query, update).then(x => { mongoClient.close(); });
    });
    return `Removing account info for: ${steamId}`;
}
function fetchOpenDotaAccount(steamId, guildId) {
    let playerUrl = `https://api.opendota.com/api/players/${steamId}`;
    let heroUrl = `https://api.opendota.com/api/players/${steamId}/heroes`;
    fetch(playerUrl)
        .then(res => res.text())
        .then(text => {
        fetch(heroUrl).
            then(heroRes => heroRes.text())
            .then(heroText => {
            savePlayer(text, heroText, steamId, guildId);
        });
    });
    ;
}
function savePlayer(text, heroText, steamId, guildId) {
    console.log(text);
    let jsonResults = JSON.parse(text);
    const uri = config.uri;
    const mongoClient = new MongoClient(uri);
    console.log(heroText);
    let heroJsonResults = JSON.parse(heroText);
    heroJsonResults.forEach(element => {
        element.account_id = steamId;
        element.hero_id = parseInt(element.hero_id);
    });
    jsonResults.heroes = heroJsonResults;
    const query = { guildId: guildId };
    const update = {
        $set: { guildId: guildId },
        //$addToSet: {accounts: jsonResults}
        $setOnInsert: { accounts: [] }
    };
    const options = { upsert: true };
    mongoClient.connect(err => {
        const collection = mongoClient.db("qttDB").collection("guild");
        collection.updateOne(query, update, options).then(x => {
            let insertAccountQuery = {
                guildId: guildId, "accounts.profile.account_id": { $ne: steamId }
            };
            let insertAccountUpdate = {
                $push: { accounts: jsonResults }
            };
            collection.updateOne(insertAccountQuery, insertAccountUpdate).then(x => {
                let updateAccountQuery = {
                    guildId: guildId, "accounts.profile.account_id": steamId
                };
                let updateAccountUpdate = {
                    $set: { "accounts.$": jsonResults }
                };
                collection.updateOne(updateAccountQuery, updateAccountUpdate).then(x => {
                    mongoClient.close();
                });
            });
        });
    });
}
function newQuestion(interaction) {
    const questions = [questionMostPlayedHero, questionLeastPlayedHero, questionBestWinrateAgainst, questionWorstWinrateAgainst];
    if (!interaction.guildId) {
        return `Could not find guild Id`;
    }
    let question = questions[Math.floor(Math.random() * questions.length)];
    new Promise(function (resolve, reject) {
        question(interaction.guildId, resolve, reject);
    }).then(async (resultUntyped) => {
        //TODO: Figure out if there's a way to not have to cast this. Can I be aware of this?
        let result = resultUntyped;
        shuffle(result.choices);
        let formattedQuestion = `${result.question}\n:red_circle: ${result.choices[0].name}\n:yellow_circle: ${result.choices[1].name}\n:green_circle: ${result.choices[2].name}\n:blue_circle: ${result.choices[3].name}`;
        let message = await interaction.reply({ content: formattedQuestion, fetchReply: true });
        if (!message) {
            return; //This should never happen
        }
        message.react('🔴');
        message.react('🟡');
        message.react('🟢');
        message.react('🔵');
        message = await message.fetch();
        /*message.awaitReactions({ filter, time: 30000, errors: ['time'] })
        .then(collected => {
            const reaction = collected.first();

            if (reaction.emoji.name === '🔴') {
                message.reply('You reacted with a thumbs up.');
            } else {
                message.reply('You reacted with a thumbs down.');
            }
        })
        .catch(collected => {
            message.reply('You reacted with neither a thumbs up, nor a thumbs down.');
        });*/
        await wait(30000);
        if (result.correctChoice) {
            await interaction.editReply(`${formattedQuestion}\n\nThe correct answer is: ${result.correctChoice.name}\n${result.choices[0].name}: ${result.choices[0].value}\n${result.choices[1].name}: ${result.choices[1].value}\n${result.choices[2].name}: ${result.choices[2].value}\n${result.choices[3].name}: ${result.choices[3].value}`);
        }
    });
}
function refreshAccounts(interaction) {
    const uri = config.uri;
    const client = new MongoClient(uri);
    client.connect(err => {
        const collection = client.db("qttDB").collection("guild");
        collection.find({ guildId: interaction.guildId })
            .project({ accountIds: '$accounts.profile.account_id' })
            .toArray(function (err, result) {
            client.close();
            result?.forEach(result => {
                console.log(result);
                result?.accountIds.forEach((accountId) => {
                    fetchOpenDotaAccount(accountId, interaction.guildId);
                });
            });
        });
    });
    return 'Refreshing accounts for your guild.';
}
function questionMostPlayedHero(guildId, resolve, reject) {
    const uri = config.uri;
    const client = new MongoClient(uri);
    let response = {
        question: "",
        answer: "",
        choices: []
    };
    client.connect(err => {
        const collection = client.db("qttDB").collection("player_hero");
        var mysort = { games: -1 };
        collection.aggregate([
            { $group: {
                    _id: "$hero_id",
                    games: { $sum: "$games" }
                } },
            { $lookup: {
                    from: 'heroes',
                    localField: '_id',
                    foreignField: 'id',
                    as: 'herodetails'
                }
            },
            {
                $sort: {
                    games: -1
                }
            }
        ]).limit(4).toArray(function (err, result) {
            if (err)
                throw err;
            if (!result)
                throw "No result";
            response.question = `Who is your group's most played hero?`;
            response.answer = `Your group's most played hero is: `;
            result.forEach(choice => {
                response.choices.push({
                    name: choice.herodetails[0].localized_name,
                    value: choice.games
                });
            });
            response.correctChoice = response.choices[0];
            client.close();
            resolve(response);
        });
    });
}
function questionLeastPlayedHero(guildId, resolve, reject) {
    const uri = config.uri;
    const client = new MongoClient(uri);
    let response = {
        question: "",
        answer: "",
        choices: []
    };
    client.connect(err => {
        const collection = client.db("qttDB").collection("player_hero");
        var mysort = { games: -1 };
        collection.aggregate([
            { $group: {
                    _id: "$hero_id",
                    games: { $sum: "$games" }
                } },
            { $lookup: {
                    from: 'heroes',
                    localField: '_id',
                    foreignField: 'id',
                    as: 'herodetails'
                }
            },
            {
                $sort: {
                    games: 1
                }
            }
        ]).limit(4).toArray(function (err, result) {
            if (err)
                throw err;
            if (!result)
                throw "No result";
            response.question = `Who is your group's least played hero?`;
            response.answer = `Your group's least played hero is: `;
            result.forEach(choice => {
                response.choices.push({
                    name: choice.herodetails[0].localized_name,
                    value: choice.games
                });
                response.correctChoice = response.choices[0];
            });
            client.close();
            resolve(response);
        });
    });
}
function questionWorstWinrateAgainst(guildId, resolve, reject) {
    const uri = config.uri;
    const client = new MongoClient(uri);
    let response = {
        question: "",
        answer: "",
        choices: []
    };
    client.connect(err => {
        const collection = client.db("qttDB").collection("player_hero");
        var mysort = { games: -1 };
        collection.aggregate([
            { $group: {
                    _id: "$hero_id",
                    games: { $sum: "$against_games" },
                    wins: { $sum: "$against_win" }
                } },
            { $lookup: {
                    from: 'heroes',
                    localField: '_id',
                    foreignField: 'id',
                    as: 'herodetails'
                }
            },
            { $project: { herodetails: 1, winRate: { $divide: ["$wins", "$games"] } } },
            {
                $sort: {
                    winRate: 1
                }
            }
        ]).limit(4).toArray(function (err, result) {
            if (err)
                throw err;
            if (!result)
                throw "No result";
            response.question = `Who is your group's toughest opposing hero by winrate?`;
            response.answer = `Your group's roughest matchup is: `;
            result.forEach(choice => {
                response.choices.push({
                    name: choice.herodetails[0].localized_name,
                    value: `${(choice.winRate * 100).toFixed(2)}%`
                });
                response.correctChoice = response.choices[0];
            });
            client.close();
            resolve(response);
        });
    });
}
function questionBestWinrateAgainst(guildId, resolve, reject) {
    const uri = config.uri;
    const client = new MongoClient(uri);
    let response = {
        question: "",
        answer: "",
        choices: []
    };
    client.connect(err => {
        const collection = client.db("qttDB").collection("player_hero");
        var mysort = { games: 1 };
        collection.aggregate([
            { $group: {
                    _id: "$hero_id",
                    games: { $sum: "$against_games" },
                    wins: { $sum: "$against_win" }
                } },
            { $lookup: {
                    from: 'heroes',
                    localField: '_id',
                    foreignField: 'id',
                    as: 'herodetails'
                }
            },
            { $project: { herodetails: 1, winRate: { $divide: ["$wins", "$games"] } } },
            {
                $sort: {
                    winRate: -1
                }
            }
        ]).limit(4).toArray(function (err, result) {
            if (err)
                throw err;
            if (!result)
                throw "No result";
            response.question = `Who is your group's easiest opposing hero by winrate?`;
            response.answer = `Your group's easiest matchup is: `;
            result.forEach(choice => {
                response.choices.push({
                    name: choice.herodetails[0].localized_name,
                    value: `${(choice.winRate * 100).toFixed(2)}%`
                });
                response.correctChoice = response.choices[0];
            });
            client.close();
            resolve(response);
        });
    });
}
/*
function questionCommonHeroPairs(resolve, reject) {
    const uri = config.uri;
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    let response = {
        question: "",
        answer: "",
        choices: [],
        correctChoice: 0
    };
    client.connect(err => {
        const collection = client.db("qttDB").collection("player_hero");
        var mysort = { games: 1 };
        collection.aggregate([
            { $group: {
                _id: "$hero_id",
                games: {$sum: "$against_games"},
                wins: {$sum: "$against_win"}
            }},
            { $lookup:
            {
                from: 'heroes',
                localField: '_id',
                foreignField: 'id',
                as: 'herodetails'
            }
            },
            { $project: { herodetails: 1, winRate: { $divide: [ "$wins", "$games" ] } } },
            {
                $sort:
                {
                    winRate : -1
                }
            }
            ]).limit(4).toArray(function(err, result) {
                if (err) throw err;

                response.question = `Who is your group's easiest opposing hero by winrate?`;
                response.answer =  `Your group's easiest matchup is: `;
                result.forEach(choice => {
                    response.choices.push({
                        name: choice.herodetails[0].localized_name,
                        value: `${(choice.winRate * 100).toFixed(2)}%`
                    })
                response.correctChoice = response.choices[0];
                });
        client.close();
        resolve(response);
        });
    });
}*/
client.on("messageReactionAdd", async (reaction, Member) => {
    if (Member.bot)
        return;
    reaction.message.reactions.cache.map(x => {
        if (x.emoji.name != reaction.emoji.name && x.users.cache.has(Member.id))
            x.users.remove(Member.id);
    });
});
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand())
        return;
    const { commandName } = interaction;
    if (commandName === 'add_account') {
        let response = addAccount(interaction);
        await interaction.reply(response);
    }
    else if (commandName === 'remove_account') {
        let response = removeAccount(interaction);
        await interaction.reply(response);
    }
    else if (commandName === 'new_question') {
        newQuestion(interaction);
    }
    else if (commandName === 'refresh_accounts') {
        let response = refreshAccounts(interaction);
        await interaction.reply(response);
    }
});
client.login(config.token);
