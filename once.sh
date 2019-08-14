#!/bin/bash
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
cd /app
echo get Hallenverzeichniss on $(date)
/usr/local/bin/yarn --cwd /app/ run gymList
echo echo Done with getting Hallenverzeichniss Data on $(date)
echo -------------------------------------------------------------------------------------
