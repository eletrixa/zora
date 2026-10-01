<!-- Module: collector/README.md · Tested: n/a -->
# zora collector

Reads the listing pages in `pages.json`, plus the partner guide hub page
(`https://www.groupon.com/hubs/partner-storefront-api`, which answers HTTP 403 to a generic
client, so every request carries a browser User-Agent), and posts what it saw to
`<host>/ingest/observations`. Runs on the machine zora, once a day, never inside the Worker.

## Before you install the timer

- Confirm `ZAL_INGEST_TOKEN` is set, either in the environment the systemd user service inherits,
  or as one line in `~/s/.env.master`. The token is never logged or printed by the collector.
- Run once by hand first: `bun collector/run.ts`. It exits non-zero if nothing was accepted; read
  the printed lines to see which pages failed.

## Install

```
mkdir -p ~/.config/systemd/user
cp collector/zorasocial-collector.service collector/zorasocial-collector.timer ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now zorasocial-collector.timer
```

Check it: `systemctl --user list-timers zorasocial-collector.timer` and
`journalctl --user -u zorasocial-collector.service`.

## Remove

```
systemctl --user disable --now zorasocial-collector.timer
rm ~/.config/systemd/user/zorasocial-collector.service ~/.config/systemd/user/zorasocial-collector.timer
systemctl --user daemon-reload
```
