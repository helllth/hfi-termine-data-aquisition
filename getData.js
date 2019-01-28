import fetch from 'node-fetch';
import convert from 'xml-js';
import _ from 'lodash';
import fs from 'fs';
import md5 from 'md5';
import FormData from 'form-data';
import AdmZip from 'adm-zip';
import csv from 'csvtojson';


String.prototype.replaceAll = function(search, replacement) {
  var target = this;
  return target.split(search).join(replacement);
};

console.log("started");
var manualDates = JSON.parse(fs.readFileSync("in/manual.json"));
let today = new Date();
console.log('today.getDay', today.getDay());

if (today.getDay() === 0) {
  today.setDate(today.getDate() - 1);
}
today.setHours(0);
today.setMinutes(0);

let nextSunday = endOfWeek(today);
let lastMonday = new Date(nextSunday.getFullYear(), nextSunday.getMonth(), nextSunday.getDate() - 6);
let nextMonday = new Date(nextSunday.getFullYear(), nextSunday.getMonth(), nextSunday.getDate() + 1);
let nextButOneSunday = endOfWeek(nextSunday);
let nextButOneMonday = new Date(nextButOneSunday.getFullYear(), nextButOneSunday.getMonth(), nextButOneSunday.getDate() + 1);

console.log('today', today + "");
console.log('lastMonday', lastMonday + "");
console.log('nextSunday', nextSunday + "");
console.log('nextButOneSunday', nextButOneSunday + "");
let msg = getGamesForTeam(210032);
let jsg = getGamesForTeam(210047);
Promise
  .all([msg, jsg])
  .then(values => {
    const all = values[0].concat(values[1], manualDates);

    const allSorted = all.sort((a, b) => {
      const x = Date.parse(a.ts) || 0;
      const y = Date.parse(b.ts) || 0;
      return x < y
        ? -1
        : x > y
          ? 1
          : 0;
    })
    const thisWeek = all.filter((game) => {
      const testtime = Date.parse(game.ts);
      return testtime > lastMonday.getTime() && testtime <= nextMonday.getTime(); //monday because of the time
    });
    const nextWeek = all.filter((game) => {
      const testtime = Date.parse(game.ts);
      return testtime > nextMonday.getTime() && testtime <= nextButOneMonday.getTime(); //monday because of the time
    });
    const realToday = new Date();
    realToday.setHours(0);
    realToday.setMinutes(0);
    const openGames = all.filter((game) => {
      const testtime = Date.parse(game.ts);
      return testtime >= realToday.getTime();
    });


    writeTable("aktuelle.Woche", getTableCSV(thisWeek));
    writeTable("naechste.Woche", getTableCSV(nextWeek));
   // writeTable("gesamtSpielplan", getTableCSV(all));
    writeTable("noch.zu.spielen", getTableCSV(openGames));


    const teams = ['HF Illtal', 'HF Illtal 2', 'HF Illtal 3', 'HF Illtal 4', 'mJA HF Illtal', 'mJA HF Illtal 2',  'mJB HF Illtal',  'mJD HF Illtal', 'mJE HF Illtal', 'gJF HF Illtal']
    for (const team of teams){
      const openGamesForTeam = all.filter((game) => {
        const testtime = Date.parse(game.ts);
        const teamtest=`<b>${team}</b>`;
        return testtime >= realToday.getTime() && (getHomeTeam(game)===teamtest || getAwayTeam(game)===teamtest);
      });
      writeTable(`noch.zu.spielen.${team.replaceAll(' ','_')}`, getTableCSV(openGamesForTeam));

    }


  });

//msg=210032

function writeTable(name, csvdata) {
  fs.writeFile(`out/${name}.csv`, csvdata, 'utf8', () => console.log(`${name}.csv geschrieben`));
}

function getTableCSV(games) {
  if (games.length > 0) {
    let csv = 'Datum,Uhrzeit,Halle,Ort,Heim,Gast\n';
    let currentDate = undefined;
    for (const game of games) { 
      if (currentDate !== game.Datum) {
        currentDate = game.Datum;
        var options = {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        };
        const parsedTimeStamp = new Date(Date.parse(game.ts));
        csv = csv + `"<font color=""#e3000b"">${getWeekday(parsedTimeStamp)}, ${pad(parsedTimeStamp.getDate()) + "." + pad(parsedTimeStamp.getMonth() + 1) + "." + parsedTimeStamp.getFullYear()}</font>",#colspan#,#colspan#,,,\n`;
      }

      if (game.Hallenname!==undefined && game.Hallenname.indexOf('Uchtelfangen')!==-1){
        game.Ort='Uchtelfangen';
      }
      csv = csv + `,${game.Zeit||'???' + ' Uhr'},"<div title=""${game.Strasse||'???'}"">${game.Hallenname||'???'}</div>",${game.Ort||'???'},"${getHomeTeam(game)}","${getAwayTeam(game)}"\n`
    }
    return csv;
  } else {
    return 'Datum,Uhrzeit,Halle,Ort,Heim,Gast\n"<div align=""center"">keine Spiele</div>",#c' +
      'olspan#,#colspan#,#colspan#,#colspan#,#colspan#';
  }
}
function pad(n) {
  return n < 10
    ? "0" + n
    : n;
}

function getHomeTeam(game) {
  return getTeamName(game, game.Heim);
}
function getAwayTeam(game) {
  return getTeamName(game, game.Gast);
}
function getTeamName(game, team) {
  if (team.indexOf("Illtal") === -1) {
    return team;
  } else {
    if (team.indexOf("MSG") !== -1) {
      team = team.replace('MSG ', '');
      return `<b>${team}</b>`
    } else {
      team = team.replace('JSG ', '');
      return `<b>${getJSGPrefix(game)} ${team}</b>`
    }
  }

}
function getJSGPrefix(game) {

  return game
    .Staffel
    .substr(0, game.Staffel.indexOf("-"));
}
function getWeekday(date) {
  switch (date.getDay()) {
    case 0:
      return "Sonntag";
    case 1:
      return "Montag";
    case 2:
      return "Dienstag";
    case 3:
      return "Mittwoch";
    case 4:
      return "Donnerstag";
    case 5:
      return "Freitag";
    case 6:
      return "Samstag";

    default:
      break;
  }
}
function endOfWeek(date) {
  let d = new Date(date.valueOf())
  var lastday = d.getDate() - (d.getDay() - 1) + 6;
  return new Date(d.setDate(lastday));

}

async function getGamesForTeam(teamId) {
  const url = "http://spo.handball4all.de/Spielbetrieb/mannschaftsspielplaene.php";
  let fd = new FormData();
  // 'm=16' -F 'nm=0' -F 'clubno=210032' -F 'lgym=1' -F 'own=1' -F 'onefile=1' -F
  // 'hvwsubmit=dw'
  fd.append('m', 16);
  fd.append('nm', 0);
  fd.append('clubno', teamId);
  fd.append('lgym', 1);
  fd.append('own', 1);
  fd.append('onefile', 1);
  fd.append('hvwsubmit', 'dw');

  const response = await fetch(url, {
    method: 'post',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_5) AppleWebKit/537.36 (KHTML, like ' +
          'Gecko) Chrome/56.0.2924.87 Safari/537.36'
    },
    body: fd
  });
  const buffer = await response.buffer();

  var zip = new AdmZip(buffer);
  var zipEntries = zip.getEntries();
  for (var i = 0; i < zipEntries.length; i++) {
    const txt = zip.readAsText(zipEntries[i], 'binary');
    const jsonObj = await csv({noheader: false, delimiter: ';'}).fromString(txt)
    // console.log('JSON',jsonObj);
    for (let entry of jsonObj) {
      const day = entry
        .Datum
        .substr(0, 2);
      const month = entry
        .Datum
        .substr(3, 2);
      const year = "20" + entry
        .Datum
        .substr(6, 2);
      var hour = entry
        .Zeit
        .substr(0, 2)
      var minute = entry
        .Zeit
        .substr(3, 2)
      entry.ts = new Date(year, month - 1, day, hour, minute).toLocaleString("de-DE", {timeZone: "Europe/Berlin"});
    }
    return jsonObj;

  }
}
