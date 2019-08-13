#!/bin/sh

cd /app
echo get Calendar Data on $(date)
yarn run calData
echo echo Done with getting Calendar Data on $(date)
echo get Leaderboard Data on $(date)
yarn run lbData
echo echo Done with getting Leaderboard Data on $(date)
echo -------------------------------------------------------------------------------------
