#!/bin/sh
# Stands in for the user's browser when the browser tests run on the session process (task 9.3,
# design decision 11). AskBoard's opener starts `$BROWSER <link>` with an argument vector, never a
# shell (AD-8); this appends what it was given to the file ASKBOARD_E2E_LINKS names, one line per
# call: the argument count, a tab, the arguments. With no file named it opens nothing, so it can
# also serve as a job-wide BROWSER on CI, where no board is shown without one (AD-18).
printf '%s\t%s\n' "$#" "$*" >>"${ASKBOARD_E2E_LINKS:-/dev/null}"
