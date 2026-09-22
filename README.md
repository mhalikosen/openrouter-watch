# openrouter-watch

Watches the providers behind an OpenRouter model and mails when one of them
changes its price, its throughput or its latency, or when a provider appears or
disappears. OpenRouter itself only alerts on balance, budget and deprecation.

## How it works

Once a day (`WATCH_CRON`, in `WATCH_TIMEZONE`) the app asks
`GET /api/v1/models/{model}/endpoints` for every model in `WATCH_MODELS`,
reduces each provider to the figures it watches, and compares them with the
snapshot it kept from the previous run under `SNAPSHOT_DIR`.

| what | reported when |
|---|---|
| prompt or completion price | any change, exact |
| throughput p50 (tokens/s) | moves by `WATCH_SPEED_THRESHOLD_PERCENT` or more |
| latency p50 (ms) | moves by `WATCH_SPEED_THRESHOLD_PERCENT` or more |
| a provider | appears or disappears |

One mail per run, every model with a change in it, nothing when nothing moved.
The snapshot is written only after the mail went out, so a failed send is
reported again on the next run rather than lost. The first run for a model
takes the baseline and stays silent.

Throughput and latency arrive only on a request that carries an OpenRouter API
key. Without `OPENROUTER_API_KEY` the app still runs and watches prices alone;
any inference key of the account will do. OpenRouter recomputes both figures
over a 30 minute window, so they are stable between calls and move when the
window rolls.

Prices are per token in the API and per million tokens in the mail
(`$0.42/M`). A provider that lists the same tag twice is kept apart with a
`#2` suffix.

## Running

    pnpm install
    cp .env.example .env
    pnpm once          # build, then one run against .env, exit code 1 if a model failed
    pnpm start:prod    # the scheduled process, after pnpm build

`MAIL_TRANSPORT=console` prints the mail to the log instead of sending it,
which is how a change is checked locally. `smtp` sends through `SMTP_*` with
`MAIL_FROM`, Postmark's SMTP endpoint included.

    pnpm lint          # oxlint, type-aware, and prettier
    pnpm test          # build, then the specs under dist with node --test

## Layout

    src/main.ts                 bootstrap: --once runs and exits, otherwise schedules
    src/app/                    the root module
    src/config/                 the environment, validated at boot
    src/openrouter/             the endpoints call
    src/snapshot/               the JSON file per model
    src/mail/                   console or SMTP transport
    src/watch/                  the run, the diff and the mail text

Files are `<module>.<concept>.<kind>.ts`; every class carries its module's
name. Deployment is not decided yet; the process runs anywhere Node 24 does.
