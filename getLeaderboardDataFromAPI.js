import fs from 'fs-extra';
import fetch from 'node-fetch';
import path from 'path';
import { writeFileWithMD5, shortenTeamName } from './tools';

// read config
let teams = fs.readJsonSync('in/teams.json');
let seasonConf = fs.readJsonSync('in/seasonConf.json');

const saison = seasonConf.current;

// Create output directories
fs.ensureDirSync('out/jsonRaw');
fs.ensureDirSync('out/json');
fs.ensureDirSync('out/json/config');

// Create season specific directories
fs.ensureDirSync(`out/jsonRaw/${saison}/leaderboards/`);
fs.ensureDirSync(`out/jsonRaw/${saison}/games.and.results/hfi/`);
fs.ensureDirSync(`out/json/${saison}/leaderboards/`);
fs.ensureDirSync(`out/json/${saison}/games.and.results/hfi/`);

// Copy config files with MD5
const configDir = 'in';
const targetDir = 'out/json/config';
fs.ensureDirSync(targetDir);

const configFiles = fs.readdirSync(configDir);
configFiles.forEach(file => {
    const sourcePath = path.join(configDir, file);
    const targetPath = path.join(targetDir, file);
    if (fs.statSync(sourcePath).isFile()) {
        const content = fs.readFileSync(sourcePath, 'utf8');
        writeFileWithMD5(targetPath, content);
    }
});

console.log('Processing data for season:', saison);

const planUrl = "https://api.h4a.mobi/spo/spo-proxy_public.php?cmd=data&lvTypeNext=team&lvIDNext=";
const leaderboardUrl = "https://api.h4a.mobi/spo/spo-proxy_public.php?cmd=data&lvTypeNext=class&subType=table&lvIDNext=";

// Helper function to get weekday in German
function getWeekday(dateStr) {
    const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    const [day, month, year] = dateStr.split('.');
    const date = new Date(2000 + parseInt(year), parseInt(month) - 1, parseInt(day));
    return days[date.getDay()];
}

// Helper function to transform team names consistently
function transformTeamName(team) {
    // Specific replacements first
    team = team.replace('SG JSG HF Illtal - HSG Dudweiler-Fischbach', 'JSG HF Illtal');
    team = team.replace('JSG Dirmingen-Schaumberg', 'JSG Dirm.-Schaumb.');

    // Illtal-specific transformations
    if (team.indexOf('Illtal') !== -1) {
        if (team.indexOf('MSG') !== -1) {
            team = team.replace('MSG ', '');
        }
    }

    return team;
}

// Helper function to transform games data
function transformGamesData(rawData, team) {
    if (!rawData || !rawData.dataList) return [];

    return rawData.dataList.map(game => {
        const weekday = getWeekday(game.gDate);
        const transformedGame = {
            nr: game.gNo,
            datum: `${weekday}, ${game.gDate}, ${game.gTime}h`,
            halle: game.gGymnasiumNo,
            heim: transformTeamName(game.gHomeTeam).replace(
                team.gamesNameReplacementFrom || '',
                team.gamesNameReplacementTo || ''
            ),
            gast: transformTeamName(game.gGuestTeam).replace(
                team.gamesNameReplacementFrom || '',
                team.gamesNameReplacementTo || ''
            ),
            toreHeim: game.gHomeGoals,
            toreGast: game.gGuestGoals,
            gID: game.gID,
            linkPI: `https://spo.handball4all.de/misc/sboPublicReports.php?sGID=${game.gID}`
        };
        return transformedGame;
    });
}

// Helper function to transform leaderboard data
function transformLeaderboardData(rawData, team) {
    if (!rawData || !rawData.dataList) return [];

    return rawData.dataList.map(entry => ({
        platz: String(entry.tabScore),
        name: transformTeamName(entry.tabTeamname).replace(
            team.leaderboardNameReplacementFrom || '',
            team.leaderboardNameReplacementTo || ''
        ),
        spiele: String(entry.numPlayedGames),
        siege: String(entry.numWonGames),
        unentschieden: String(entry.numEqualGames),
        niederlagen: String(entry.numLostGames),
        torePlus: String(entry.numGoalsShot),
        toreMinus: String(entry.numGoalsGot),
        punktePlus: String(entry.pointsPlus),
        punkteMinus: String(entry.pointsMinus)
    }));
}

// Main async function to process all teams
async function processTeams() {
    for (const category of Object.keys(teams[saison])) {
        console.log('\nCategory:', teams[saison][category].name);

        for (const teamKey of Object.keys(teams[saison][category].teams)) {
            const team = teams[saison][category].teams[teamKey];
            console.log(`\nProcessing Team: ${team.name} (${team.leaguename})`);
            console.log(`API ID: ${team.h4a_team_id}`);

            try {
                // Fetch leaderboard data
                const leaderboardFullUrl = leaderboardUrl + team.h4a_class;
                console.log(`\nFetching leaderboard data from: ${leaderboardFullUrl}`);
                const leaderboardResponse = await fetch(leaderboardFullUrl);
                const leaderboardData = await leaderboardResponse.json();

                // Only process and write leaderboard if dataList is not empty
                if (leaderboardData && leaderboardData[0] && leaderboardData[0].dataList && leaderboardData[0].dataList.length > 0) {
                    const transformedLeaderboardData = transformLeaderboardData(leaderboardData[0], team);

                    // Write leaderboard data
                    writeFileWithMD5(
                        `out/json/${saison}/leaderboards/${teamKey}.json`,
                        JSON.stringify(transformedLeaderboardData, null, 2)
                    );
                } else {
                    console.log('Skipping leaderboard generation - empty dataList');
                }

                // Fetch games data
                const planFullUrl = planUrl + team.h4a_team_id;
                console.log(`Fetching games data from: ${planFullUrl}`);
                const planResponse = await fetch(planFullUrl);
                const planData = await planResponse.json();

                // Only process and write games if dataList is not empty
                if (planData && planData[0] && planData[0].dataList && planData[0].dataList.length > 0) {
                    const transformedGamesData = transformGamesData(planData[0], team);

                    // Write games data
                    writeFileWithMD5(
                        `out/json/${saison}/games.and.results/hfi/${teamKey}.json`,
                        JSON.stringify(transformedGamesData, null, 2)
                    );
                } else {
                    console.log('Skipping games data generation - empty dataList');
                }

                // Write raw data
                writeFileWithMD5(
                    `out/jsonRaw/${saison}/leaderboards/${teamKey}.json`,
                    JSON.stringify(leaderboardData, null, 2)
                );
                writeFileWithMD5(
                    `out/jsonRaw/${saison}/games.and.results/hfi/${teamKey}.json`,
                    JSON.stringify(planData, null, 2)
                );
            } catch (error) {
                console.error(`Error fetching data for ${team.name}:`, error.message);
            }
        }
    }
}

// Run the main function
processTeams().catch(error => {
    console.error('Error in main process:', error);
    process.exit(1);
});
