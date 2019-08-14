#!/bin/bash
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

cd /app
echo get Calendar Data on $(date)
/usr/local/bin/yarn --cwd /app/ run calData
echo echo Done with getting Calendar Data on $(date)
echo get Leaderboard Data on $(date)
/usr/local/bin/yarn --cwd /app/ run lbData
echo echo Done with getting Leaderboard Data on $(date)
echo -------------------------------------------------------------------------------------
