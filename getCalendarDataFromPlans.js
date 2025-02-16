import fs from 'fs-extra';
import fetch from 'node-fetch';
import path from 'path';
import { writeFileWithMD5 } from './tools.js';
import seasonConf from './in/config/seasonConf.json';
import teams from './in/config/teams.json';
import hallenliste from './out/json/hallenverzeichnis.json';

const saison = seasonConf.current;

// Calculate week ranges once at the start
const now = new Date();
const currentWeekStart = new Date(now);
currentWeekStart.setHours(0, 0, 0, 0);
const daysSinceMonday = (now.getDay() + 6) % 7; // Days since last Monday (Monday=0, Sunday=6)
currentWeekStart.setDate(now.getDate() - daysSinceMonday); // Go back to last Monday

const currentWeekEnd = new Date(currentWeekStart);
currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
currentWeekEnd.setHours(23, 59, 59, 999);

const nextWeekStart = new Date(currentWeekEnd);
nextWeekStart.setDate(currentWeekEnd.getDate() + 1);
nextWeekStart.setHours(0, 0, 0, 0);

const nextWeekEnd = new Date(nextWeekStart);
nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
nextWeekEnd.setHours(23, 59, 59, 999);

console.log('Date ranges for game filtering:');
console.log('Current week:', formatDate(currentWeekStart), 'to', formatDate(currentWeekEnd));
console.log('Next week:', formatDate(nextWeekStart), 'to', formatDate(nextWeekEnd));
console.log('----------------------------------------');

// Ensure output directories exist
fs.ensureDirSync('out/json');
fs.ensureDirSync('out/json/config');

// Copy config files with MD5
const configDir = 'in/config';
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

// Helper function to get weekday in German
function getWeekday(dateStr) {
    const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    const [day, month, year] = dateStr.split('.');
    const date = new Date(2000 + parseInt(year), parseInt(month) - 1, parseInt(day));
    return days[date.getDay()];
}

// Helper function to parse date and time from datum string
function parseDateAndTime(datum) {
    try {
        // Remove weekday prefix if present (e.g., "So, " or "Sa, ")
        const dateTimeStr = datum.replace(/^[A-Za-z]{2}, /, '');

        // Input format: "15.02.25, 18:30h" or "31.05.25, h" or "31.05.25"
        const [datePart, timePart] = dateTimeStr.includes(',') ? dateTimeStr.split(',') : [dateTimeStr, ''];
        const [day, month, year] = datePart.split('.');

        // Handle case where time is missing or invalid
        const timeStr = timePart.replace('h', '').trim();
        const time = timeStr || 'TBD';  // Use TBD for missing times

        // For timestamp calculations, use 00:00 if time is TBD
        const [hours, minutes] = timeStr ? time.split(':').map(num => num.padStart(2, '0')) : ['00', '00'];

        // Create date string in ISO format
        const isoDate = `20${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hours}:${minutes}:00`;
        const date = new Date(isoDate);

        if (isNaN(date.getTime())) {
            throw new Error('Invalid date');
        }

        const weekday = getWeekday(`${day}.${month}.${year}`);

        return {
            date: `${day}.${month}.${year}`,
            time: time,  // This will be either the actual time or "TBD"
            timestamp: date,
            weekday: weekday
        };
    } catch (error) {
        console.warn(`Warning: Could not parse date "${datum}", using fallback date`);
        const fallbackDate = new Date();
        return {
            date: datum,
            time: 'TBD',
            timestamp: fallbackDate,
            weekday: ''
        };
    }
}

// Helper function to format date
function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}h`;
}

// Helper function to get hall details
function getHallDetails(hallenNr) {
    if (!hallenNr) return {
        name: '',
        plz: '',
        ort: '',
        strasse: '',
        telefon: '',
        haftmittel: ''
    };

    // Find the hall in our list
    const hall = hallenliste.find(h => h['#Nummer'] === hallenNr);
    if (!hall) {
        console.log(`Warning: Could not find hall with number ${hallenNr}`);
        return {
            name: '',
            plz: '',
            ort: '',
            strasse: '',
            telefon: '',
            haftmittel: ''
        };
    }

    return {
        name: hall.Name || '',
        plz: hall.Plz || '',
        ort: hall.Stadt || '',
        strasse: hall.Strasse || '',
        telefon: hall.Telefon || '',
        haftmittel: hall.Haftmittel || ''
    };
}

// Helper function to transform game data
function transformGameData(game, teamKey) {
    const dateInfo = parseDateAndTime(game.datum);
    const hallInfo = getHallDetails(game.halle);

    // Find the team's league name and prefix from teams.json
    let leagueName = '';
    let prefix = '';
    for (const category of Object.keys(teams[saison])) {
        if (teams[saison][category].teams[teamKey]) {
            const team = teams[saison][category].teams[teamKey];
            leagueName = team.leaguename;
            prefix = team.calLeaguePrefix || '';
            break;
        }
    }

    // Combine prefix and league name
    const staffel = prefix ? `${prefix} - ${leagueName}` : leagueName;

    // Add scores to team names if results are available and not empty
    const heim = game.toreHeim && game.toreHeim.trim() ? `${game.heim}\n${game.toreHeim}` : game.heim;
    const gast = game.toreGast && game.toreGast.trim() ? `${game.gast}\n${game.toreGast}` : game.gast;

    return {
        Nummer: game.nr,
        Staffel: staffel,
        Datum: dateInfo.date,
        Zeit: dateInfo.time,
        Hallennummer: game.halle,
        Heim: heim,
        Gast: gast,
        Hallenname: hallInfo.name,
        Plz: hallInfo.plz,
        Ort: hallInfo.ort,
        Strasse: hallInfo.strasse,
        Telefon: hallInfo.telefon,
        "Haftmittel?": hallInfo.haftmittel,
        ts: `${dateInfo.date}, ${dateInfo.time}:00`,
        tsNoLocale: dateInfo.timestamp.toISOString(),
        weekday: dateInfo.weekday
    };
}

// Helper function to check if a date is in the current or next week
function isInCurrentOrNextWeek(date) {
    return {
        currentWeek: date >= currentWeekStart && date <= currentWeekEnd,
        nextWeek: date >= nextWeekStart && date <= nextWeekEnd
    };
}

// Main function to process games
async function processGames() {
    const currentWeekGames = [];
    const nextWeekGames = [];

    // Process each team category
    for (const category of Object.keys(teams[saison])) {
        // Process each team
        for (const teamKey of Object.keys(teams[saison][category].teams)) {
            const gamesFile = `out/json/${saison}/games.and.results/hfi/${teamKey}.json`;

            if (!fs.existsSync(gamesFile)) {
                console.log(`No games file found for team ${teamKey}`);
                continue;
            }

            const games = fs.readJsonSync(gamesFile);

            // First filter games by week
            games.forEach(game => {
                const dateInfo = parseDateAndTime(game.datum);
                const weekInfo = isInCurrentOrNextWeek(dateInfo.timestamp);

                if (weekInfo.currentWeek) {
                    currentWeekGames.push(Object.assign({}, game, {
                        teamKey,
                        dateInfo
                    }));
                } else if (weekInfo.nextWeek) {
                    nextWeekGames.push(Object.assign({}, game, {
                        teamKey,
                        dateInfo
                    }));
                }
            });
        }
    }

    // Then transform only the filtered games
    const transformedCurrentWeekGames = currentWeekGames.map(game =>
        transformGameData(game, game.teamKey)
    );
    const transformedNextWeekGames = nextWeekGames.map(game =>
        transformGameData(game, game.teamKey)
    );

    // Sort games by date and time
    const sortByDateTime = (a, b) => new Date(a.tsNoLocale) - new Date(b.tsNoLocale);
    transformedCurrentWeekGames.sort(sortByDateTime);
    transformedNextWeekGames.sort(sortByDateTime);

    // Write the files
    writeFileWithMD5('out/json/aktuelle.Woche.json', JSON.stringify(transformedCurrentWeekGames, null, 2));
    writeFileWithMD5('out/json/naechste.Woche.json', JSON.stringify(transformedNextWeekGames, null, 2));
}

// Run the main function
processGames().catch(error => {
    console.error('Error in main process:', error);
    process.exit(1);
});
