import fs from 'fs-extra';
import { writeFileWithMD5 } from './tools';

// read config
let teams = fs.readJsonSync('in/teams.json');
let seasonConf = fs.readJsonSync('in/seasonConf.json');
let hallenliste = fs.readJsonSync('out/json/hallenverzeichnis.json');

const saison = seasonConf.current;

// Helper function to parse date and time from datum string
function parseDateAndTime(datum) {
    try {
        // Input format: "15.02.25, 18:30h" or "31.05.25, h"
        const [datePart, timePart] = datum.split(', ');
        const [day, month, year] = datePart.split('.');
        
        // Handle case where time is missing or invalid
        const time = timePart.replace('h', '').trim() || '00:00';
        
        // Ensure two digits for hours and minutes
        const [hours, minutes] = time.split(':').map(num => num.padStart(2, '0'));
        
        // Create date string in ISO format
        const isoDate = `20${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hours}:${minutes}:00`;
        const date = new Date(isoDate);
        
        if (isNaN(date.getTime())) {
            throw new Error('Invalid date');
        }
        
        return {
            date: `${day}.${month}.${year}`,
            time: `${hours}:${minutes}`,
            timestamp: date,
            timestampNoLocale: date.toISOString()
        };
    } catch (error) {
        console.log(`Warning: Could not parse date "${datum}", using fallback date`);
        // Return a fallback date far in the future to avoid breaking the app
        const fallbackDate = new Date('2099-12-31T00:00:00Z');
        return {
            date: datum.split(',')[0],
            time: '00:00',
            timestamp: fallbackDate,
            timestampNoLocale: fallbackDate.toISOString()
        };
    }
}

// Helper function to get hall details
function getHallDetails(hallenNr) {
    const hall = hallenliste[hallenNr] || {};
    return {
        name: hall.name || '',
        plz: hall.plz || '',
        ort: hall.ort || '',
        strasse: hall.strasse || '',
        telefon: hall.telefon || '',
        haftmittel: hall.haftmittel || ''
    };
}

// Helper function to transform game data
function transformGameData(game, teamKey) {
    const dateInfo = parseDateAndTime(game.datum);
    const hallInfo = getHallDetails(game.halle);

    return {
        Nummer: game.nr,
        Staffel: teamKey, // We might need to map this differently
        Datum: dateInfo.date,
        Zeit: dateInfo.time,
        Hallennummer: game.halle,
        Heim: game.heim,
        Gast: game.gast,
        Hallenname: hallInfo.name,
        Plz: hallInfo.plz,
        Ort: hallInfo.ort,
        Strasse: hallInfo.strasse,
        Telefon: hallInfo.telefon,
        "Haftmittel?": hallInfo.haftmittel,
        ts: `${dateInfo.date}, ${dateInfo.time}:00`,
        tsNoLocale: dateInfo.timestampNoLocale
    };
}

// Helper function to check if a date is in the current or next week
function isInCurrentOrNextWeek(date) {
    const now = new Date();
    const currentWeekStart = new Date(now);
    currentWeekStart.setHours(0, 0, 0, 0);
    currentWeekStart.setDate(now.getDate() - now.getDay() + 1); // Monday of current week

    const nextWeekStart = new Date(currentWeekStart);
    nextWeekStart.setDate(currentWeekStart.getDate() + 7);

    const nextWeekEnd = new Date(nextWeekStart);
    nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
    nextWeekEnd.setHours(23, 59, 59, 999);

    return {
        currentWeek: date >= currentWeekStart && date < nextWeekStart,
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
            const gamesFile = `out/json/current/games.and.results/hfi/${teamKey}.json`;
            
            if (!fs.existsSync(gamesFile)) {
                console.log(`No games file found for team ${teamKey}`);
                continue;
            }

            try {
                const games = fs.readJsonSync(gamesFile);
                
                games.forEach(game => {
                    const dateInfo = parseDateAndTime(game.datum);
                    const weekInfo = isInCurrentOrNextWeek(dateInfo.timestamp);
                    const transformedGame = transformGameData(game, teamKey);

                    if (weekInfo.currentWeek) {
                        currentWeekGames.push(transformedGame);
                    } else if (weekInfo.nextWeek) {
                        nextWeekGames.push(transformedGame);
                    }
                });
            } catch (error) {
                console.error(`Error processing games for team ${teamKey}:`, error);
            }
        }
    }

    // Sort games by date and time
    const sortByDateTime = (a, b) => new Date(a.tsNoLocale) - new Date(b.tsNoLocale);
    currentWeekGames.sort(sortByDateTime);
    nextWeekGames.sort(sortByDateTime);

    // Write the files
    writeFileWithMD5('out/aktuelle.Woche.json', JSON.stringify(currentWeekGames, null, 2));
    writeFileWithMD5('out/naechste.Woche.json', JSON.stringify(nextWeekGames, null, 2));
}

// Ensure output directory exists
fs.ensureDirSync('out');

// Run the main function
processGames().catch(error => {
    console.error('Error in main process:', error);
    process.exit(1);
});
