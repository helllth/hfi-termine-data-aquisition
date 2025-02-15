import fs from 'fs-extra';
import fetch from 'node-fetch';
import { writeFileWithMD5 } from './tools';

// read config
let teams = fs.readJsonSync('in/teams.json');
let seasonConf = fs.readJsonSync('in/seasonConf.json');

const saison = seasonConf.current;

// Ensure all necessary directories exist
// Current season directories
fs.ensureDirSync('out/jsonRaw/current/leaderboards/');
fs.ensureDirSync('out/jsonRaw/current/games.and.results/hfi/');
fs.ensureDirSync('out/jsonRaw/config');
fs.ensureDirSync('out/json/current/leaderboards/');
fs.ensureDirSync('out/json/current/games.and.results/hfi/');
fs.ensureDirSync('out/json/config');

// Specific season directories
fs.ensureDirSync(`out/jsonRaw/${saison}/leaderboards/`);
fs.ensureDirSync(`out/jsonRaw/${saison}/games.and.results/hfi/`);
fs.ensureDirSync(`out/json/${saison}/leaderboards/`);
fs.ensureDirSync(`out/json/${saison}/games.and.results/hfi/`);

console.log('Processing data for season:', saison);

const planUrl = "https://api.h4a.mobi/spo/spo-proxy_public.php?cmd=data&lvTypeNext=team&lvIDNext=";
const leaderboardUrl = "https://api.h4a.mobi/spo/spo-proxy_public.php?cmd=data&lvTypeNext=class&subType=table&lvIDNext=";

// Helper function to transform games data
function transformGamesData(rawData) {
    if (!rawData || !rawData.dataList) return [];

    return rawData.dataList.map(game => ({
        nr: game.gNo,
        datum: `${game.gDate}, ${game.gTime}h`,
        halle: game.gGymnasiumNo,
        heim: game.gHomeTeam,
        gast: game.gGuestTeam,
        toreHeim: game.gHomeGoals,
        toreGast: game.gGuestGoals,
        gID: game.gID,
        linkPI: `https://spo.handball4all.de/misc/sboPublicReports.php?sGID=${game.gID}`
    }));
}

// Main async function to process all teams
async function processTeams() {
    for (const category of Object.keys(teams[saison])) {
        console.log('\nCategory:', teams[saison][category].name);

        for (const teamKey of Object.keys(teams[saison][category].teams)) {
            const team = teams[saison][category].teams[teamKey];
            console.log(`\nProcessing Team: ${team.name} (${team.leaguename})`);
            console.log(`API ID: ${team.h4a_id}`);

            try {
                // Fetch leaderboard data
                const leaderboardFullUrl = leaderboardUrl + team.h4a_class;
                console.log(`\nFetching leaderboard data from: ${leaderboardFullUrl}`);
                const leaderboardResponse = await fetch(leaderboardFullUrl);
                const leaderboardData = await leaderboardResponse.json();

                // Write raw leaderboard data
                writeFileWithMD5(
                    `out/jsonRaw/current/leaderboards/${teamKey}.json`,
                    JSON.stringify(leaderboardData, null, 2)
                );
                writeFileWithMD5(
                    `out/jsonRaw/${saison}/leaderboards/${teamKey}.json`,
                    JSON.stringify(leaderboardData, null, 2)
                );

                // For now, we're keeping the leaderboard data as is
                writeFileWithMD5(
                    `out/json/current/leaderboards/${teamKey}.json`,
                    JSON.stringify(leaderboardData, null, 2)
                );
                writeFileWithMD5(
                    `out/json/${saison}/leaderboards/${teamKey}.json`,
                    JSON.stringify(leaderboardData, null, 2)
                );
                console.log(`Leaderboard data saved for ${team.name}`);

                // Fetch games and results data
                const gamesFullUrl = planUrl + team.h4a_team_id;
                console.log(`Fetching games data from: ${gamesFullUrl}`);
                const gamesResponse = await fetch(gamesFullUrl);
                const gamesData = await gamesResponse.json();

                // Write raw games data
                writeFileWithMD5(
                    `out/jsonRaw/current/games.and.results/hfi/${teamKey}.json`,
                    JSON.stringify(gamesData, null, 2)
                );
                writeFileWithMD5(
                    `out/jsonRaw/${saison}/games.and.results/hfi/${teamKey}.json`,
                    JSON.stringify(gamesData, null, 2)
                );

                // Transform and write simplified games data
                const simplifiedGamesData = transformGamesData(gamesData[0]); // Taking first element as it contains the team data
                writeFileWithMD5(
                    `out/json/current/games.and.results/hfi/${teamKey}.json`,
                    JSON.stringify(simplifiedGamesData, null, 2)
                );
                writeFileWithMD5(
                    `out/json/${saison}/games.and.results/hfi/${teamKey}.json`,
                    JSON.stringify(simplifiedGamesData, null, 2)
                );
                console.log(`Games and results data saved for ${team.name}`);
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
