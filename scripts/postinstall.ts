/**
 * Cross-platform postinstall script.
 * Runs `gbrain apply-migrations` when gbrain is globally installed,
 * otherwise prints a helpful hint to stderr.
 */
import { spawnSync } from "child_process";

const result = spawnSync("gbrain", ["apply-migrations", "--yes", "--non-interactive"], {
  stdio: "inherit",
});

if (result.error) {
  // gbrain not found in PATH — expected for local dev installs
  process.stderr.write(
    "[gbrain] postinstall skipped. If installed via bun install -g github:...: " +
      "run `gbrain doctor` and `gbrain apply-migrations --yes` manually. " +
      "See https://github.com/garrytan/gbrain/issues/218\n",
  );
} else {
  process.exit(result.status ?? 0);
}
