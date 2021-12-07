import fetch from "node-fetch";
import fs from "fs";

import config from "./config.json"
import { Client, CommandInteraction, CommandInteractionOption, Intents, Message } from 'discord.js';
import {MongoClient, MongoClientOptions} from 'mongodb';
import path from 'path';
import util from 'util';

const dirname = path.resolve();
const heroDataFolder = "heroes";
const heroDirectoryPath = path.join(dirname, 'heroes');
const wait = util.promisify(setTimeout);

const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MESSAGE_REACTIONS],
	partials: ['MESSAGE', 'CHANNEL', 'REACTION'] });


let heroesText = fs.readFileSync(`dotaconstants\\build\\heroes.json`,'utf8');
const heroes = Object.values(JSON.parse(heroesText));

// When the client is ready, run this code (only once)
client.once('ready', () => {
	console.log('Ready!');
});

type NameValuePair = {
    name: string,
    value: string
}

type Question = {
    question: string,
    answer: string,
    choices: Array<NameValuePair>,
    correctChoice?: NameValuePair
};

type PlayerHero = {
    hero_id:string | number
    account_id:number
}

type Guild = {
    guildId: string ,
    accounts: Array<number>
}


function shuffle(array:Array<any>) {
    let currentIndex = array.length,  randomIndex;
  
    // While there remain elements to shuffle...
    while (currentIndex != 0) {
  
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
  
      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
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

function addAccount(interaction:CommandInteraction) {
    const interactionData:Readonly<Array<CommandInteractionOption>> = interaction.options.data;
    let steamId:number;
    if(!interaction.guildId) {
        return `Could not find guild Id`;
    }
    if (interactionData && interactionData.length > 0) {
        steamId = interactionData.find(x => x.name === 'account_id')?.value as number;
    } else {
        return `Could not find steamId in message.`;
    }
    if(!steamId) {
        return `Could not find steamId in message.`;
    }
    removeAccountPromise(steamId).then(() => {fetchNewOpenDotaAccount(steamId, interaction.guildId as string)});
    
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

function removeAccountPromise (steamId:number): Promise<String> {
    return new Promise(function(resolve, reject) {
        const uri = config.uri;
        const mongoClient = new MongoClient(uri);
        mongoClient.connect(err => {
            const collection = mongoClient.db("qttDB").collection("player");
            collection.deleteMany({ account_id: steamId}).then(results => {
                const playerHeroCollection = mongoClient.db("qttDB").collection("player_hero");
                playerHeroCollection.deleteMany({account_id: steamId}).then(() => {resolve("done")});
            });
        });
    });
}

function removeAccount(interaction:CommandInteraction) {
    const interactionData:Readonly<Array<CommandInteractionOption>> = interaction.options.data;
	const steamId:number = interactionData.find(x => x.name === 'account_id')?.value as number;
    removeAccountPromise(steamId);

    return `Removing account info for: ${steamId}`;
}

function fetchNewOpenDotaAccount(steamId:number, guildId:string) {
    let playerUrl = `https://api.opendota.com/api/players/${steamId}`;
    fetch(playerUrl)
        .then(res => res.text())
        .then(text => savePlayer(text, steamId, guildId));

    let heroUrl = `https://api.opendota.com/api/players/${steamId}/heroes`;

    fetch(heroUrl)
        .then(res => res.text())
        .then(text => savePlayerHeroes(text, steamId));

    const query = { guildId: guildId };
    const update =  {    
                        $set: { guildId: guildId },
                        $addToSet: {accounts: steamId}
                    };
    const options = { upsert: true };

    const uri = config.uri;
    const mongoClient = new MongoClient(uri);
    mongoClient.connect(err => {
    const collection = mongoClient.db("qttDB").collection("guild");
    collection.updateOne(query, update, options).then(x =>  {
        mongoClient.close();
    });
    });
}

function savePlayer(text:string, steamId:number, guildId:string) {
    console.log(text);
    let jsonResults = JSON.parse(text);
    const uri = config.uri;
    const mongoClient = new MongoClient(uri);
    mongoClient.connect(err => {
    const collection = mongoClient.db("qttDB").collection("player");
    collection.insertOne(
        jsonResults.profile
    ).then( items =>  {
        mongoClient.close();
    });
    });
}


function savePlayerHeroes(text:string, steamId:number) {
    console.log(text);
    let jsonResults:Array<PlayerHero> = JSON.parse(text);
    jsonResults.forEach(element => {
        element.account_id = steamId;
        element.hero_id = parseInt(element.hero_id as string);
    });
    const uri = config.uri;
    const mongoClient = new MongoClient(uri);
    mongoClient.connect(err => {
    const collection = mongoClient.db("qttDB").collection("player_hero");
    collection.insertMany(
        jsonResults
    ).then( items =>  {
        mongoClient.close();
    });
    });
}

function newQuestion(interaction:CommandInteraction) {

    const questions = [questionMostPlayedHero, questionLeastPlayedHero, questionBestWinrateAgainst, questionWorstWinrateAgainst];
    if(!interaction.guildId) {
        return `Could not find guild Id`;
    }
    let question = questions[Math.floor(Math.random()*questions.length)];
    new Promise(function(resolve, reject){
        question(interaction.guildId as string, resolve, reject);
    }).then(async resultUntyped => {
        //TODO: Figure out if there's a way to not have to cast this. Can I be aware of this?
        let result = resultUntyped as Question;
        shuffle(result.choices);
        let formattedQuestion = `${result.question}\n:red_circle: ${result.choices[0].name}\n:yellow_circle: ${result.choices[1].name}\n:green_circle: ${result.choices[2].name}\n:blue_circle: ${result.choices[3].name}`
        let message:Message = await interaction.reply({ content: formattedQuestion, fetchReply: true }) as Message;
        if(!message) {
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
        if(result.correctChoice) {
            await interaction.editReply(`${formattedQuestion}\n\nThe correct answer is: ${result.correctChoice.name}\n${result.choices[0].name}: ${result.choices[0].value}\n${result.choices[1].name}: ${result.choices[1].value}\n${result.choices[2].name}: ${result.choices[2].value}\n${result.choices[3].name}: ${result.choices[3].value}`);
        }		
    });
} 

function questionMostPlayedHero(guildId:string, resolve: (arg0: Question) => void, reject: any) {
        
    const uri = config.uri;
    const client = new MongoClient(uri);

    let response:Question = {
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
            games: {$sum: "$games"}
            }},
            { $lookup:
            {
                from: 'heroes',
                localField: '_id',
                foreignField: 'id',
                as: 'herodetails'
            }
            },
            {
                $sort:
                {
                    games : -1
                }
            }
            ]).limit(4).toArray(function(err, result) {
                if (err) throw err;
                if (!result) throw "No result";

                response.question = `Who is your group's most played hero?`;
                response.answer =  `Your group's most played hero is: `;
                result.forEach(choice => {
                    response.choices.push({
                        name: choice.herodetails[0].localized_name,
                        value: choice.games
                    })
                });
                response.correctChoice = response.choices[0];
        client.close();
        resolve(response);
        });
    });
}

function questionLeastPlayedHero(guildId:string, resolve: (arg0: Question) => void, reject: any) {
    const uri = config.uri;
    const client = new MongoClient(uri);

    let response:Question = {
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
            games: {$sum: "$games"}
            }},
            { $lookup:
            {
                from: 'heroes',
                localField: '_id',
                foreignField: 'id',
                as: 'herodetails'
            }
            },
            {
                $sort:
                {
                    games : 1
                }
            }
            ]).limit(4).toArray(function(err, result) {
                if (err) throw err;
                if (!result) throw "No result";

                response.question = `Who is your group's least played hero?`;
                response.answer =  `Your group's least played hero is: `;
                result.forEach(choice => {
                    response.choices.push({
                        name: choice.herodetails[0].localized_name,
                        value: choice.games
                    })
                response.correctChoice = response.choices[0];
                });
        client.close();
        resolve(response);
        });
    });
}


function questionWorstWinrateAgainst(guildId:string, resolve: (arg0: Question) => void, reject: any) {
    const uri = config.uri;
    const client = new MongoClient(uri);

    let response:Question = {
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
                    winRate : 1
                }
            }
            ]).limit(4).toArray(function(err, result) {
                if (err) throw err;
                if (!result) throw "No result";

                response.question = `Who is your group's toughest opposing hero by winrate?`;
                response.answer =  `Your group's roughest matchup is: `;
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
}

function questionBestWinrateAgainst(guildId:string, resolve: (arg0: Question) => void, reject: any) {
    const uri = config.uri;
    const client = new MongoClient(uri);

    let response:Question = {
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
                if (!result) throw "No result";

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
    if(Member.bot) return;
    reaction.message.reactions.cache.map(x=>{
        if(x.emoji.name != reaction.emoji.name&&x.users.cache.has(Member.id)) x.users.remove(Member.id)
    })
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'add_account') {
        let response = addAccount(interaction)
        await interaction.reply(response);
    } else if (commandName === 'remove_account') {
        let response = removeAccount(interaction)
        await interaction.reply(response);
    } else if (commandName === 'new_question') {
        newQuestion(interaction);
    }
});

client.login(config.token);