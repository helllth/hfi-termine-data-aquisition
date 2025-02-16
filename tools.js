import fs from 'fs-extra';
import md5 from 'md5';

export const writeFileWithMD5 = (
	name,
	data,
	encoding = 'utf8',
	finished = () => console.log(`${name} geschrieben`)
) => {
	fs.writeFileSync(name + '.md5', 'v2_' + md5(data), { encoding });
	fs.writeFileSync(name, data, { encoding });
	finished();
};

export const shortenTeamName = (teamName, maxLength = 11) => {
    if (teamName.length <= maxLength) return teamName;
    
    const prefixes = ['HF', 'TV', 'SF', 'SG', 'HSG', 'HV', 'HG', 'HB', 'TuS', 'FSG'];
    for (const prefix of prefixes) {
        if (teamName.startsWith(prefix + ' ')) {
            const shortened = teamName.substring(prefix.length + 1);
            if (shortened.length <= maxLength) {
                return shortened;
            }
        }
    }
    return teamName;
};
